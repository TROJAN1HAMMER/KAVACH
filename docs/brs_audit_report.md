# KAVACH — Banking Risk Score Pipeline Audit

**Trigger:** Sandbox scans of `premade_low_risk`, `premade_medium_risk`, `premade_high_risk` produced BRS scores of ≈83, ≈76, ≈84 — Low scored above Medium and nearly tied with High. This audit traces the entire pipeline (payloads → scanners → aggregation → BRS engine → API → dashboard) to find the actual cause(s) before touching the scoring algorithm further.

**Method:** Every claim below is backed by either (a) direct code reading, or (b) real scans triggered against the live API (not simulated), with scan job IDs recorded. Three scan rounds were run: baseline (pre-fix), after the scanner-level fixes, and after the BRS engine fix.

---

## 1. Repository Validation

| Repo | Files | Real vulnerabilities present | Matches its name? |
|---|---|---|---|
| `premade_low_risk` | `requirements.txt` (fastapi 0.110.0, pydantic 2.6.4 — current, unremarkable), `main.py` (two trivial endpoints, no injectable logic), `.env` (clean config), `Dockerfile` | **None.** Zero exploitable code paths. One fixture defect: `CMD ['uvicorn', ...]` uses single-quoted JSON, which is invalid Docker exec-form syntax — cosmetic, not a security issue. | **Yes** — this is a genuinely clean payload. |
| `premade_medium_risk` | adds `random.random()` session IDs (CWE-330), `hashlib.sha1()` (CWE-327), and a real, unsanitized path-traversal read via `os.path.join(base_dir, doc_path)` → `open()` (CWE-22); `requirements.txt` pins `requests==2.26.0` and `jinja2==3.0.1`, both with real disclosed CVEs; Dockerfile exposes port 3306 | **Yes, 3 real code vulns + 2 real vulnerable deps + 1 real misconfig.** | **Yes** — appropriately worse than Low, not as bad as High. |
| `premade_high_risk` | hardcoded AWS key / API key / DB password (CWE-798), `yaml.load()` (CWE-502), `pickle.loads()` (CWE-502), `os.system(f'ping -c 1 {host}')` (CWE-78), ports 22/5432 exposed, `pyyaml==5.3`/`django==3.2`/`cryptography==3.3` (all old, real CVE-laden versions) | **Yes, and the worst of the three — with one caveat.** The intended SQL-injection demo in `login()` builds `f'SELECT * FROM accounts WHERE username = "{username}"'` but the function **never calls `.execute()` or anything else on it** — it just returns the string. As written, no SQL injection is actually reachable; it's inert. This is a genuine fixture defect (see §9), not a scanner miss — there's nothing to detect. | **Mostly** — correctly the worst repo in raw vulnerability content, undermined by the inert SQLi. |

**Conclusion:** The payloads are correctly ordered by *intended and largely actual* severity. The reported score inversion is **not explained by the fixtures being mislabeled** — Low is genuinely clean, Medium and High genuinely escalate. One fixture defect flagged for §9 (High's inert SQLi), two cosmetic ones noted (invalid Dockerfile CMD syntax in Low/Medium).

---

## 2. Scanner Validation

Checked all 9 declared scanner sources: `semgrep`, `ast-grep`, `joern`, `osv`, `nvd`, `secrets`, `docker`, `yaml`, `pip-audit`.

**Binary availability, checked directly in the running environment:**

```
semgrep --version    → command not found
ast-grep --version   → command not found
joern --version      → command not found
```

None of the three binary-dependent tools (semgrep, ast-grep, joern) are installed. This matters because **they don't all fail the same way**:

| Scanner | On missing binary | Verdict |
|---|---|---|
| `joern_scanner.py` | catches `FileNotFoundError`, logs `joern_scanner.binary_not_found`, returns `[]` | **Correct** — honest empty result |
| `ast_grep_scanner.py` | catches `FileNotFoundError`, logs `ast_grep_scanner.binary_not_found`, returns `[]` | **Correct** — honest empty result |
| `static_scanner.py` (semgrep) | catches the failure and **silently substitutes `_fallback_pattern_scan()`**, a naive regex scanner, then labels its output `source="semgrep"` | **Bug** — this is the one scanner that hides its own degradation |

Two confirmed, distinct bugs found in the semgrep path, both in `static_scanner.py`:

**Bug A — mislabeled source (line 491, pre-fix).** The fallback wrote `source="semgrep"  # label as semgrep for unified display`. Every "semgrep" finding in every scan this environment has ever produced is actually regex output, not AST-aware analysis — and nothing in aggregation, the BRS engine, `by_source` metrics, or the dashboard could tell the difference.

**Bug B — comments treated as code, causing phantom duplicates.** The fallback regex-matches raw file lines with no comment-awareness. The payload generator's own explanatory comments are phrased like `# INSECURE: Command injection via os.system (CWE-78)` and `# INSECURE: Unsafe yaml.load (CWE-502)`. The rules `\bos\.system\s*\(` and `\byaml\.load\s*\(` tolerate whitespace before `(`, so `os.system (CWE-78)` and `yaml.load (CWE-502)` in the *comment text* satisfy the pattern on their own — firing once on the comment line and again on the real code line below it. Verified directly:

```
--- BEFORE fix (no comment skip) ---
line 1 MATCHES (comment=True): '# INSECURE: Unsafe yaml.load (CWE-502)'
line 2 MATCHES (comment=False): 'data = yaml.load(user_yaml)'
line 3 MATCHES (comment=True): '# INSECURE: Command injection via os.system (CWE-78)'
line 5 MATCHES (comment=False): 'os.system(cmd)'
--- AFTER fix (comment lines skipped) ---
line 2 MATCHES: 'data = yaml.load(user_yaml)'
line 5 MATCHES: 'os.system(cmd)'
```

**Bug C — coverage gap (not yet fixed, documented for §10).** The fallback's `PATTERN_RULES` list has only 10 entries: hardcoded-api-key, hardcoded-password, hardcoded-aws-key, sql-injection-concat, weak-hash-md5, weak-hash-sha1, unsafe-pickle, command-injection-shell, os-system, yaml-unsafe-load. The semgrep-only `KAVACH_RULES` config (never actually invoked, since semgrep isn't installed) additionally defines `kavach-path-traversal`, `kavach-insecure-random`, and `kavach-weak-cipher-des` — **these three categories are never detected by anything currently running.** This directly costs the Medium repo 2 of its 3 intentional code vulnerabilities (path traversal, insecure randomness) — only the SHA-1 one is caught.

**NVD scanner — working as coded, but the code's own honesty isn't propagated downstream.** `nvd_scanner.py`'s module docstring states outright: *"NVD's keywordSearch matches against CVE descriptions, not a precise CPE lookup ... treat these as leads worth triaging, not confirmed hits."* This is accurate and was not a bug in that file. Direct evidence of the imprecision: the High-risk repo's NVD results include CVE IDs dated 2003–2008 matched against `cryptography` and `django` — packages that did not exist on PyPI in those years. This is an unambiguous keyword-collision false positive, and it is far from rare: the clean Low-risk repo alone got 10 such "leads," 3 of them scored HIGH severity, against two modern, unremarkable dependencies with no real CVEs.

OSV, pip-audit, secrets-scanner, docker-scanner, yaml-scanner: all produced correctly-labeled, well-corroborated output (e.g., the AWS example key in the High payload was correctly flagged CRITICAL by secrets-scanner) and showed no defects.

---

## 3. Aggregation Validation

`app/services/aggregation/`:

- **Deduplication** (`deduplicator.py`): correlates by, in priority order, (1) same CVE + package, (2) same file + line + category, (3) same file + category + title prefix. This is a sound cross-tool correlation key — read and reasoned through, no defect found.
- **Severity normalization** (`severity.py`): canonicalizes any tool's label to CRITICAL/HIGH/MEDIUM/LOW/INFO, with real CVSS (when present) taking precedence over the tool's own label. Sound.
- **Aggregation engine** (`aggregation_engine.py`): groups → enriches → sorts by `severity_score` → tallies `by_severity`/`by_owasp_category`/`by_source`. No defect found.

Before/after, confirmed via live scans: Low 12→11 raw/unified (1 merged), Medium 34→33 (1 merged), High 114→110 pre-fix / 108 immediately after the comment-line fix (the 2-finding drop is exactly the phantom yaml.load/os.system comment matches eliminated — confirmed reproducible). A further High count of 103 in the final validation round reflects NVD's own live, run-to-run result variance (an external API), not an aggregation defect.

**Conclusion: the aggregation layer is not a contributor to the anomaly.**

---

## 4. Banking Risk Score (BRS) Validation

`app/services/risk/brs_engine.py`. Checked each hypothesis explicitly:

- **"Every repo treated as Payments"** — **Ruled out.** `classify_module()` does first-keyword-match against `ModuleConfig.keywords` (e.g. Payments: "payment", "transfer", "upi", ...). None of the sandbox file paths (`main.py`, `.env`, `Dockerfile`, `requirements.txt`) contain any module keyword, so every finding in all three repos correctly falls through to the `General` module (`criticality_weight=4.0`, `asset_value=4.0`) — confirmed by direct code reading of `DEFAULT_MODULES`.
- **Hardcoded/incorrect defaults** — not found; module/weight defaults load from DB config with an in-code fallback, and the fallback values are the ones actually documented and in effect here (no seeded DB overrides exist for this sandbox).
- **Normalization mathematically incorrect** — the scan-level rollup formula (`self-weighted average of finding BRS + a volume bonus, floored at the single worst finding, capped at 100`) was already corrected in the session immediately preceding this audit (fixing an earlier saturation bug); re-verified here, it is internally consistent.
- **Duplicate findings inflating the score** — **partially confirmed**: the 2 phantom comment-line duplicates in the High repo (§2, Bug B) each contributed an extra individual finding to the rollup's volume term. Their removal alone did **not** change High's BRS (84.25 → 84.25) — the rollup's `max(single finding)` floor already dominated, so this bug was real but not the primary driver of the anomaly.
- **NVD "leads" scored as confirmed hits — the primary driver.** `score_finding()` had no mechanism at all to distinguish an OSV/pip-audit-confirmed finding from an NVD keyword-search "lead" — both fed `finding.cvss` into the blended score at full weight. Combined with the rollup's `max(brs_list)` floor (a deliberate, reasonable design so one critical finding can't get diluted by a sea of trivial ones), a **single high-CVSS NVD false positive was enough to set an entire clean repo's final score** — exactly what happened to Low.

**Live before/after (three real scan rounds, same 3 payloads, all via the running API):**

| Repo | Round 1 (baseline) | Round 2 (scanner fixes only) | Round 3 (+ NVD-confidence fix) |
|---|---|---|---|
| Low | 83.10 | 83.10 | **70.80** |
| Medium | 76.00 | 76.00 | **71.50** |
| High | 84.00 | 84.25 | **84.25** |

Round 2 confirms Bug A/B (source mislabeling, comment duplicates) were real but not the score driver — the numbers barely moved. Round 3, after adding a source-aware confidence discount for uncorroborated NVD leads (see §8), **restores the correct ordering: Low < Medium < High.**

Per-repo `by_source` breakdown (Round 3, the validated state):

- **Low** (11 findings): 10 `nvd-scanner`, 1 `docker-scanner`. **91% of this repo's findings are unverified NVD leads**, for a payload with zero real code vulnerabilities and modern, unremarkable dependencies.
- **Medium** (33 findings): 18 `osv-scanner` + 2 `pip-audit` (real, confirmed CVEs against `requests==2.26.0`/`jinja2==3.0.1`), 10 `nvd-scanner`, 2 `docker-scanner`, 1 `semgrep-fallback` (only the SHA-1 rule — path-traversal and insecure-random are structurally invisible, §2 Bug C).
- **High** (103 findings): 81 `osv-scanner` + 3 `pip-audit` (real CVE volume against `pyyaml==5.3`/`django==3.2`/`cryptography==3.3` — old Django alone carries dozens of disclosed CVEs), 3 `secrets-scanner` (hardcoded AWS/API/DB credentials, correctly CRITICAL), 6 `semgrep-fallback`, 10 `nvd-scanner`, 3 `docker-scanner`.

This confirms Medium and High's volume is overwhelmingly *real, confirmed* dependency CVE data (OSV/pip-audit), while Low's volume is overwhelmingly *unverified* NVD noise — exactly the asymmetry the fix targets.

---

## 5. Dashboard Validation

`frontend/src/lib/queryClient.ts`: React Query `staleTime: 30_000`, no manual cache seeding or overrides found. `frontend/src/pages/RiskDashboardPage.tsx` reads `job.brs_score` directly from the API response for sorting, filtering, and the chart tooltip (`Number(value).toFixed(1)`) and table cell (`formatScore(job.brs_score)`) — formatting/rounding only, no recomputation, no fallback-to-default-value path, no hardcoded score anywhere in `frontend/src`. **No defect found in the dashboard layer.**

---

## 6. API Validation

`app/api/v1/endpoints/scan.py:108`: `brs_score=result.brs_score if result else None` — passes the persisted DB value straight through, no transformation. `trigger_premade_scan` creates a fresh `Repository` row on every call (no premade-scan dedup), meaning `historical_incident_count` is always 0 for these — a confound that was checked and ruled out, not a bug. **No defect found in the API layer;** backend-calculated → serialized → DB → frontend is a clean, unmodified pass-through end to end.

---

## 7. End-to-End Trace (`premade_low_risk`, Round 3 validation run)

1. **Payload** — `low_risk.zip`: 2 clean deps, trivial FastAPI endpoints, clean `.env`, minor Dockerfile CMD-quoting defect. Zero real vulnerabilities.
2. **Scan** — `scan_job_id=008f08ed-59d8-440e-a0ef-37e6e09a9f1f`, `repository_id=6256a264-bb96-4339-bd61-368c30b59911`. semgrep/ast-grep/joern absent → static_scanner falls back honestly-labeled (`semgrep-fallback`), finds nothing (no code vulns to find); NVD scanner returns 10 keyword-search "leads" against `fastapi`/`pydantic`; docker-scanner flags the `EXPOSE 8080` + CMD syntax issue.
3. **Aggregation** — 12 raw → 11 unified (1 merge). No dedup errors.
4. **BRS engine** — all 11 findings classify to module `General`. The 10 NVD findings are now recognized as uncorroborated leads (no `osv-scanner`/`pip-audit` in `.sources`) and their CVSS contribution is halved before blending. Rollup: **70.8**.
5. **Database** — persisted on `ScanResult.brs_score`.
6. **API** — `GET /scan/{id}` returns `brs_score: 70.8`, unmodified.
7. **Dashboard** — would render 70.8 directly, sorted correctly below Medium (71.5) and High (84.25).

Every transformation traced; no silent value changes anywhere in the chain.

---

## 8. Root Cause Analysis

Two independent, confirmed root causes, both now fixed:

1. **Primary — NVD keyword-search "leads" scored identically to confirmed vulnerabilities.** `nvd_scanner.py` is explicit in its own docstring that these are unverified — nothing downstream respected that. Because the rollup formula intentionally floors a repo's score at its single worst finding (a sound design choice on its own), one lucky/unlucky keyword collision was enough to set an entire repo's score, regardless of how clean or dirty the rest of the repo actually was. This alone explains Low scoring above Medium.
2. **Secondary — the semgrep fallback silently substituted a cruder scanner and mislabeled its output, and separately double-counted comment lines as code.** Confirmed real, confirmed fixed, but confirmed (via Round 2's unchanged BRS numbers) **not** the primary driver of the reported anomaly — it was a correctness/observability bug in its own right (operators had no way to know semgrep wasn't actually running), not the main cause of the score inversion.

A third, related but *unfixed* gap: the fallback's pattern coverage is missing path-traversal, insecure-random, and weak-cipher-DES detection entirely (§2 Bug C) — this doesn't explain the ordering complaint, but it does mean Medium's real score is still being computed on incomplete evidence (2 of 3 intentional vulnerabilities invisible). Flagged for §10, not fixed in this pass — no evidence it materially affects Medium's relative ranking, and adding entries to a regex list is exactly the kind of change that deserves its own focused pass rather than being bundled into this one.

---

## 9. Required Code Changes

Two files modified, both minimal and directly evidenced:

**`backend/app/services/scanning/static_scanner.py`**
- Added `_LINE_COMMENT_PREFIXES = ("#", "//")` and skip any line whose stripped content starts with one before testing it against `PATTERN_RULES` — eliminates the comment-as-code phantom duplicates (Bug B).
- Changed the fallback's `RawFinding.source` from `"semgrep"` to `"semgrep-fallback"` — an honest label distinguishing real AST-aware semgrep output from the regex approximation (Bug A).

**`backend/app/services/risk/zero_day_predictor.py`**
- One-line follow-on: `code_findings = [f for f in findings if f.source == "semgrep"]` → `f.source in ("semgrep", "semgrep-fallback")`, so the zero-day predictor's code-vulnerability-density factor keeps seeing fallback-sourced findings now that they carry an honest, different label. Without this the relabeling in the file above would have silently zeroed out that factor.

**`backend/app/services/risk/brs_engine.py`**
- Added `_is_uncorroborated_nvd_lead()`: true when a finding's only source is `nvd-scanner`, with no `osv-scanner`/`pip-audit` corroboration for the same CVE/package (checked via `UnifiedFinding.sources`, with a safe fallback to the single `.source` field for plain `RawFinding` unit-test fixtures).
- In `score_finding()`, an uncorroborated NVD lead's `cvss` sub-score is halved (not zeroed — it's still a real signal worth a human's attention) before blending into the 7-factor score.

**Not changed:** the scan-level rollup formula (`calculate_brs()`), the aggregation layer, the API layer, and the dashboard — all were verified clean and none needed modification. The rollup's `max(brs_list)` floor was deliberately left untouched: it's a reasonable design (one confirmed critical shouldn't get diluted by volume), and fixing the *input* it was floored on (NVD confidence) was sufficient to restore correct ordering without touching that formula again so soon after its previous fix.

**Validation:** `pytest` (49/49 passing) run after each change; all three sandbox repos re-scanned live against the running API after each fix round (job IDs and resulting scores recorded in §4).

---

## 10. Sandbox Payload Assessment

Two payload-level issues identified. Per instruction, **not regenerated** — specifications only.

### Issue 1 — `premade_high_risk`'s SQL injection is inert

**Current state:** `login(username)` builds the query string and returns it; nothing ever executes it.

**Specification for a corrected `main.py` snippet** (not the file itself):
- Repository name: `premade_high_risk` (in place, same file)
- Change: add an in-memory/sqlite connection and an actual `cursor.execute(query)` call after building the f-string, so the injection is real and reachable, not just illustrative
- Expected scanner finding after fix: `kavach-sqli-string-format`/`sql-injection-concat` pattern match on the `execute(...)` call (currently the fallback's `sql-injection-concat` rule requires `(execute|query)\s*\([^)]*[\+%][^)]*\)` — an f-string alone won't match it either; the corrected code should build the query with `%`-formatting or concatenation immediately inside the `execute()` call to actually trip the existing regex, or the regex needs a companion fix to also catch f-string-built queries passed to `execute()` — flagged as a follow-on, not resolved here)
- Expected severity: CRITICAL, CVSS ~9.8, CWE-89

### Issue 2 — `premade_medium_risk`'s path-traversal and insecure-random vulnerabilities are undetectable by anything currently running

**Not a payload defect** — the code is a realistic, correctly-written vulnerability. This is a scanner coverage gap (§2 Bug C). No payload change needed; tracked as a scanner fix instead (see Recommended Next Steps).

### Minor, cosmetic (both Low and Medium Dockerfiles)
`CMD ['uvicorn', ...]` / `CMD ['python', 'main.py']` use single-quoted JSON arrays, which is invalid Docker exec-form syntax. Recommend double-quoting for correctness; low priority, does not affect any scanner or score in this pipeline today.

**Confirmed NOT payload issues:** Low is a legitimately clean repo; Medium and High are legitimately, increasingly vulnerable. The ordering complaint was a pipeline defect, not a fixture-labeling defect.

---

## Recommended Next Steps

1. **Ship the three code changes above** (already applied, tested, and live-validated in this environment) — restores correct Low < Medium < High ordering.
2. **Install semgrep, ast-grep, and Joern in the actual deployment environment.** Every scan run today has been operating without any of the three AST-aware tools; the regex fallback is a safety net, not a substitute, and is now at least honestly labeled so this gap is visible in `by_source` going forward.
3. **Extend `PATTERN_RULES`** in `static_scanner.py` with path-traversal, insecure-random, and weak-cipher-DES entries so the fallback (while semgrep remains unavailable) has parity with the semgrep-only rule set — directly closes the Medium-repo detection gap.
4. **Fix `premade_high_risk`'s inert SQL injection** per the Issue 1 specification above, so it demonstrates a real, detectable vulnerability instead of dead code.
5. **Consider tightening the fallback's `sql-injection-concat` regex** to also catch an f-string/`.format()`-built query passed into `execute()`, not just inline `+`/`%` concatenation — needed for Issue 1's fix to actually get detected.
6. **Re-run this same 3-repo baseline after items 2–5** to get a fresh reference range for "what Low/Medium/High should score" once the tooling gaps are closed — the current absolute numbers (70.8/71.5/84.25) are correctly *ordered* but were produced by an environment still missing 3 of 9 scanners; the true baseline once semgrep/ast-grep/Joern are installed will likely look different in absolute terms even though the relative ordering should hold or improve further.
