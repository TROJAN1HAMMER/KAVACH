"""
KAVACH — Joern Code Property Graph Scanner
Joern (joern-parse + CPGQL queries) has no pip package — it's a separate
JVM-based CLI that must be installed independently (its own install script,
requires a JDK). This is NOT bundled into requirements.txt or the
Dockerfile in this pass; if the `joern` binary isn't on PATH, this worker
degrades to an empty result set with a warning, exactly like every other
scanner here degrades when its underlying tool is missing.

To enable it for real: install Joern (see joern.io) in the worker image
and ensure `joern` and `joern-parse` are on PATH.

Input:  repository_path (str | Path)
Output: list[RawFinding]
"""

import subprocess
import tempfile
from pathlib import Path
from typing import Union

import structlog

from app.schemas.finding import RawFinding

logger = structlog.get_logger(__name__)

# Minimal starter CPGQL query script: flags calls to a small set of known
# dangerous sinks reachable in the code property graph. A real deployment
# would grow this into a proper query library — this is intentionally a
# starting point, not a claim of Joern's full analysis depth.
JOERN_QUERY_SCRIPT = """
importCpg("{cpg_path}")
val sinks = List("system", "exec", "eval", "unserialize", "pickle.loads")
val results = cpg.call.name(sinks.mkString("|")).map(c => (c.name, c.location.filename, c.lineNumber.getOrElse(-1))).l
results.foreach(r => println(s"JOERN_FINDING|${{r._1}}|${{r._2}}|${{r._3}}"))
"""

DANGEROUS_SINK_CVSS = {
    "system": 8.0,
    "exec": 8.5,
    "eval": 8.5,
    "unserialize": 9.0,
    "pickle.loads": 9.5,
}


def _parse_joern_stdout(stdout: str, repo_path: Path) -> list[RawFinding]:
    findings: list[RawFinding] = []
    for line in stdout.splitlines():
        if not line.startswith("JOERN_FINDING|"):
            continue
        parts = line.split("|")
        if len(parts) != 4:
            continue
        _, sink_name, raw_path, line_str = parts

        try:
            file_path = str(Path(raw_path).relative_to(repo_path))
        except ValueError:
            file_path = raw_path

        try:
            line_number = int(line_str)
        except ValueError:
            line_number = None

        cvss = DANGEROUS_SINK_CVSS.get(sink_name, 7.0)
        findings.append(
            RawFinding(
                title=f"Dangerous Sink Reachable: {sink_name}()",
                severity="HIGH" if cvss < 9.0 else "CRITICAL",
                category="command_injection" if sink_name in ("system", "exec") else "unsafe_deserialization",
                source="joern",
                cvss=cvss,
                file_path=file_path,
                line_number=line_number if line_number and line_number > 0 else None,
                description=(
                    f"Joern's code property graph found a call to '{sink_name}()'. "
                    "Review the call graph to confirm whether attacker-controlled data can reach it."
                ),
            )
        )
    return findings


def run_joern_scan(repo_path: Union[str, Path]) -> list[RawFinding]:
    """
    Run joern-parse to build a CPG, then execute a CPGQL query script
    against it. Returns [] with a warning if Joern isn't installed.
    """
    repo_path = Path(repo_path).resolve()
    logger.info("joern_scanner.start", repo_path=str(repo_path))

    with tempfile.TemporaryDirectory() as tmpdir:
        cpg_path = Path(tmpdir) / "cpg.bin"
        script_path = Path(tmpdir) / "query.sc"

        try:
            parse_result = subprocess.run(
                ["joern-parse", str(repo_path), "--output", str(cpg_path)],
                capture_output=True,
                text=True,
                timeout=300,
            )
            if parse_result.returncode != 0 or not cpg_path.exists():
                logger.warning(
                    "joern_scanner.parse_failed",
                    returncode=parse_result.returncode,
                    stderr_preview=parse_result.stderr[:300] if parse_result.stderr else "",
                )
                return []

            script_path.write_text(
                JOERN_QUERY_SCRIPT.format(cpg_path=str(cpg_path).replace("\\", "\\\\")), encoding="utf-8"
            )

            query_result = subprocess.run(
                ["joern", "--script", str(script_path)],
                capture_output=True,
                text=True,
                timeout=300,
            )

            findings = _parse_joern_stdout(query_result.stdout, repo_path)
            logger.info("joern_scanner.complete", findings=len(findings))
            return findings

        except FileNotFoundError:
            logger.warning("joern_scanner.binary_not_found — Joern is not installed on this worker (see module docstring)")
            return []
        except subprocess.TimeoutExpired:
            logger.error("joern_scanner.timeout")
            return []
        except Exception as exc:
            logger.exception("joern_scanner.error", error=str(exc))
            return []
