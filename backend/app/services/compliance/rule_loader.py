"""
KAVACH — Compliance Rule Loader
Loads framework rule catalogs from YAML at `app/data/compliance_rules/`.
Pure data loading + validation — no evaluation logic here (that's
compliance_engine.py). Every `.yaml` file in that directory becomes a
supported framework automatically: "engine loads rules dynamically"
means adding a new file there is the entire integration step, no code
change required.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import structlog
import yaml

logger = structlog.get_logger(__name__)

RULES_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "compliance_rules"

# Ascending order — used to evaluate a control's `min_severity` condition.
SEVERITY_ORDER = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]


@dataclass
class ControlTrigger:
    """
    All present fields are AND'd together; within a list field, any one
    match is enough (OR). A trigger with every field empty never matches
    anything — see compliance_engine.py's guard against that being
    silently treated as "matches every finding".
    """

    categories: list[str] = field(default_factory=list)
    min_severity: Optional[str] = None
    sources: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)


@dataclass
class Control:
    requirement_id: str
    title: str
    description: str
    recommendation: str
    trigger: ControlTrigger


@dataclass
class FrameworkRules:
    name: str
    short_code: str
    version: str
    description: str
    controls: list[Control]


def _parse_trigger(raw: dict) -> ControlTrigger:
    return ControlTrigger(
        categories=[c.lower() for c in raw.get("categories", [])],
        min_severity=(raw.get("min_severity") or "").upper() or None,
        sources=[s.lower() for s in raw.get("sources", [])],
        keywords=[k.lower() for k in raw.get("keywords", [])],
    )


def _parse_framework_file(path: Path) -> FrameworkRules:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    fw = raw["framework"]

    controls = [
        Control(
            requirement_id=str(c["requirement_id"]),
            title=c["title"].strip(),
            description=" ".join(c["description"].split()),
            recommendation=" ".join(c["recommendation"].split()),
            trigger=_parse_trigger(c.get("trigger", {})),
        )
        for c in raw.get("controls", [])
    ]

    return FrameworkRules(
        name=fw["name"],
        short_code=fw["short_code"],
        version=str(fw.get("version", "")),
        description=fw.get("description", ""),
        controls=controls,
    )


_frameworks_cache: Optional[dict[str, FrameworkRules]] = None


def load_all_frameworks(*, rules_dir: Path = RULES_DIR, force_reload: bool = False) -> dict[str, FrameworkRules]:
    """
    Cached after first call — re-parsing YAML on every scan's compliance
    evaluation would be wasteful, since rule files change far less often
    than scans run. Pass `force_reload=True` after editing a rules file
    without restarting the process (e.g. in a REPL or test).
    """
    global _frameworks_cache
    if _frameworks_cache is not None and not force_reload:
        return _frameworks_cache

    frameworks: dict[str, FrameworkRules] = {}
    if not rules_dir.exists():
        logger.error("compliance_rule_loader.rules_dir_missing", path=str(rules_dir))
        _frameworks_cache = frameworks
        return frameworks

    for yaml_file in sorted(rules_dir.glob("*.yaml")):
        try:
            fw = _parse_framework_file(yaml_file)
            frameworks[fw.short_code] = fw
        except Exception as exc:
            logger.error("compliance_rule_loader.parse_error", file=str(yaml_file), error=str(exc))

    logger.info("compliance_rule_loader.loaded", frameworks=list(frameworks.keys()))
    _frameworks_cache = frameworks
    return frameworks
