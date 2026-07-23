# KAVACH — Fact Checklist

Every claim made in `KAVACH_PSB_Hackathon_2026.pptx` is listed below, slide by slide, with the
repository evidence it's grounded in. File paths are relative to the repo root. Line numbers were
correct at the time of this audit (2026-07-23) — re-verify against `git blame` if the codebase has
moved on since.

Legend: ✅ verified in code/docs · ⚠️ disclosed limitation/placeholder — presented honestly on the
slide, not hidden · 📌 forward-looking claim, explicitly labeled as such on the slide.

---

## Slide 1 — Title
- ✅ Tech stack badges (Python 3.11+, FastAPI, React 19, Flutter, Celery, PostgreSQL+pgvector,
  Redis, Kubernetes/Helm, Docker Compose, GitHub Actions CI/CD) — `README.md` badge row, lines 5–15.
- ✅ Problem Statement 3 framing — matches the user-supplied hackathon problem statement verbatim
  in spirit (misconfigurations in OSS dependencies, banking context).

## Slide 2 — About PSB Hackathon
- No repository claims — this slide describes the hackathon itself, sourced from the prompt/user.

## Slide 3 — Problem Statement
- ✅ Framed directly from the PSB Hackathon Problem Statement 3 text supplied by the user; no
  repository-specific claims on this slide.

## Slide 4 — Industry Challenges
- ✅ 75% growth / 1.23M+ malicious packages — Sonatype 2026 State of the Software Supply Chain
  report (external source, cited on-slide).
- ✅ 95% "fix already existed" stat — Sonatype 10th Annual State of the Software Supply Chain
  (2024) (external source, cited on-slide).
- ✅ 37% of breaches involved exploited vulns/misconfig — Verizon 2025 DBIR (external source,
  cited on-slide).
- ✅ 4.1M monthly attacks / 248+ breaches, India BFSI — CERT-In/CSIRT-Fin/SISA Digital Threat
  Report + 2025 industry reporting (external source, cited on-slide).
- All four are third-party statistics, not KAVACH product claims — sources are printed on the
  slide itself for the jury to verify independently.

## Slide 5 — Our Solution
- ✅ 9 scanners, cross-tool aggregation, AI, risk engine, compliance, 7 report formats — see
  Slides 7–9, 11, 14, 20 evidence below; this slide is a summary of those.
- ✅ Flow order (Repository → CI/CD → Scanning → AI → Risk Engine → Compliance → Reports) mirrors
  `README.md` architecture Mermaid diagram, lines 144–171.
- 📌 Screenshot placeholder labeled "Dashboard Overview" — real page at `frontend/src/pages/`
  (`OverviewPage.tsx`), not yet captured.

## Slide 6 — Why Existing Solutions Fall Short
- ✅ Comparison framed as "typical, publicly documented scope," not a claim that competitor tools
  lack all capability — footnote on-slide states this explicitly.
- ✅ "Cross-tool dedup & correlation" — `backend/app/services/aggregation/deduplicator.py:32–49`
  (three-tier match: CVE+package → file+line+category → file+category+title-prefix).
- ✅ "RBI/PCI DSS/SWIFT CSP mapping" — see Slide 14 evidence.
- ✅ "Banking Risk Score, 7 factors" — see Slide 11 evidence.
- ✅ "RAG + confidence-gated" AI — see Slide 13 evidence.

## Slide 7 — System Architecture
- ✅ All 22 named components exist as real modules — cross-checked against `README.md`
  architecture diagram (lines 144–171) and `backend/app/` directory structure (`README.md`
  Project Structure section, lines 391–485).
- ✅ 9 scanners named (Semgrep, Joern, AST-Grep, Dependency Scanner, Configuration Scanner, Secrets
  Detection) — confirmed as the 6 *categories* covering all 9 real Celery tasks; see Slide 9 for
  the precise 9-task breakdown (Dependency Scanner alone = pip-audit + OSV + NVD, 3 tasks).
- ✅ Aggregation Layer — `backend/app/services/aggregation/aggregation_engine.py:34–91`.
- ✅ Banking Risk Score Engine — `backend/app/services/risk/brs_engine.py`.
- ✅ Compliance Engine — `backend/app/services/compliance/compliance_engine.py`.
- ✅ AI Explanation Layer — `backend/app/services/ai/gateway.py`.
- ✅ Knowledge Base (RAG) — `backend/app/services/knowledge_base/`.
- ✅ Executive Intelligence — `backend/app/services/executive_intelligence/`.
- ✅ Report Generator — `backend/app/services/reports/report_generator.py`.
- ✅ Notifications — `backend/app/services/notifications/` (Slack/email/webhook, outbound-only —
  see Slide 21 for the disclosed notifications-inbox gap).
- ✅ Storage (Local/S3) — `backend/app/services/reports/storage.py:46–131`.

## Slide 8 — Scan Pipeline
- ✅ Three entry points (upload, URL, webhook) converging on one path — `README.md` architecture
  section, lines 140–142.
- ✅ GitHub webhook HMAC verification via `X-Hub-Signature-256` — README API table, line 699;
  `backend/app/api/v1/endpoints/webhooks` (github receiver).
- ✅ Celery chord fan-out — `backend/app/tasks/scan_tasks.py:219–239` (`_dispatch_chord`, `group(...)`
  of 9 scanner signatures, `chord(...)` callback).
- ✅ Per-scanner retry (3 attempts, exponential backoff), always returns a result —
  `backend/app/tasks/scanner_tasks.py:56–109` (`_make_scanner_task` factory).
- ✅ Live WebSocket progress backed by Redis — `backend/app/orchestrator/scan_status.py:38–53`
  (status hash + pub/sub channel backing `/scan/{id}/ws`).

## Slide 9 — Parallel Scanning Engine
- ✅ Exactly 9 scanner Celery tasks confirmed in `backend/app/tasks/scanner_tasks.py:216–226`
  (`ALL_SCANNER_TASK_NAMES`) and the chord `group(...)` in `scan_tasks.py:219–231`:
  `kavach.scan.semgrep`, `.ast-grep`, `.joern`, `.pip-audit`, `.osv`, `.nvd`, `.secrets`, `.docker`,
  `.yaml`.
- ✅ Semgrep custom rules + regex fallback (`source="semgrep-fallback"`) —
  `backend/app/services/scanning/static_scanner.py:33–211` (rules), `:462–515` (fallback).
- ✅ Joern optional/graceful-degrade — `backend/app/services/scanning/joern_scanner.py:1–15,
  129–131` (returns `[]` with a warning if the `joern`/`joern-parse` binaries aren't installed).
- ✅ AST-Grep independent rule set — `backend/app/services/scanning/ast_grep_scanner.py:29–69`.
- ✅ Dependency scanner = pip-audit + CycloneDX SBOM + OSV.dev + NVD (3 independent CVE lookups) —
  `dependency_scanner.py`, `osv_scanner.py:51–121`, `nvd_scanner.py:38–40,62–102`.
- ✅ Configuration scanner (K8s/Compose/GitHub Actions) — `yaml_scanner.py:55–269`; Dockerfile
  analyzer — `docker_scanner.py:27–192`.
- ✅ Secrets engine, in-house regex, no external binary — `secrets_scanner.py:34–95` (13 rule
  categories).
- ✅ Named priority queues `kavach.critical/high/normal/low` — `backend/app/workers/celery_app.py:
  47–56` (`QUEUE_BY_PRIORITY`).
- ✅ Dedicated worker pools (critical/high vs normal/low) — `backend/docker-compose.yml:77–120`.
- ⚠️ **Not claimed but worth knowing internally**: a legacy `config_scanner.py` module exists in
  the codebase but is *not* wired into the live chord (superseded by `docker_scanner.py` +
  `yaml_scanner.py`) — don't let a juror who reads the code mistake it for a 10th active scanner.

## Slide 10 — Attack Surface Exposure
- ✅ Renamed from "Zero-Day Prediction" — module docstring,
  `backend/app/services/risk/attack_surface_exposure.py:5–13`.
- ✅ 6 factors with exact formulas/caps — `attack_surface_exposure.py:135–221`
  (dependency_count ×0.18 cap 20; known_cve_density ×4.0 cap 30; dependency_staleness ×4.0 cap 20;
  risky_package_categories ×1.5 cap 15; configuration_risk crit×3.0+high×1.5 cap 10;
  code_vulnerability_density ×2.5 cap 15).
- ✅ Bands: Critical ≥70, High ≥45, Medium ≥20, Low <20 — `_score_to_level()`, lines 224–232.
- ✅ Fixed confidence 0.55, labeled prototype — line 218 comment + line 15 module docstring.
- ✅ Independent of BRS — confirmed no cross-import between `attack_surface_exposure.py` and
  `brs_engine.py`; both called separately in `backend/app/tasks/aggregator_tasks.py:156–163`,
  persisted to distinct `ScanResult` columns (`backend/app/models/scan_result.py:36,38–39`).
- ⚠️ Explicit limitation, stated on-slide: heuristic, not a forecast; no calibrated-classifier
  upgrade shipped yet.

## Slide 11 — Business Risk Score
- ✅ 7 factors + exact default weights — `DEFAULT_FACTOR_WEIGHTS`, `brs_engine.py:135–143` (CVSS
  30%, business_criticality 20%, exploitability 15%, internet_exposure 10%, compliance_impact 10%,
  asset_value 10%, historical_incidents 5%).
- ✅ Weighted-average formula (not product), scaled ×10, clamped to 100 —
  `score_finding()`, lines 260–310; design rationale in module docstring, lines 18–26.
- ✅ Risk bands Critical ≥82 / High 58–82 / Medium 35–58 / Low <35 — `_calculate_risk_level()`,
  lines 348–369; boundary-tested in `backend/tests/test_brs_engine.py:227–247`.
- ✅ Business modules (Payments 10/10 internet-facing, Authentication 8.5/8.0, Customer Data
  7.0/9.0, etc.) — `DEFAULT_MODULES`, lines 86–133.
- ✅ DB-editable at runtime, no redeploy — `backend/app/api/v1/endpoints/risk_config.py` (routes at
  lines 38, 47, 69, 91, 110, 119, 138), mounted at `/api/v1/risk/*`.
- ✅ Real-scan audit trail supporting the calibration claim — `docs/brs_audit_report.md` (§4, §9),
  including live sandbox scan job IDs.

## Slide 12 — AI Intelligence Layer
- ✅ Automated per-finding explanations, pipeline-embedded — `backend/app/services/ai/gateway.py`.
- ✅ Provider list: Claude, OpenAI, Gemini (cloud), Ollama, vLLM (local) — `gateway.py:55–64`
  (`_PROVIDER_CLASSES`).
- ✅ `AI_MODE=hybrid` default (local-first, cloud-fallback) — `gateway.py:67–79`, `config.py:82–99`.
- ✅ Semantic cache — `backend/app/services/ai/semantic_cache.py`.
- ✅ Rule-based template fallback, zero-provider safe — `backend/app/services/ai/templates.py`
  (`TEMPLATE_INSIGHTS`).
- ✅ "AI never scores, never mutates a finding" — structural claim confirmed: AI service layers
  only read `Finding`/`ScanJob` rows to build prompts; BRS/Attack-Surface-Exposure scoring runs in
  `services/risk/`, a code path the AI layer never imports or calls.

## Slide 13 — Knowledge Base (RAG)
- ✅ Ingestion: PDF/Markdown/text only, SHA-256 content-hash dedup, version chaining by filename,
  heading/page-aware chunking — `backend/app/services/knowledge_base/document_manager.py:41–141`,
  `chunking.py:50–173`.
- ✅ Chunk size ~350 tokens / 50 overlap — `settings.knowledge_chunk_size_tokens` /
  `knowledge_chunk_overlap_tokens`, referenced in `chunking.py`.
- ✅ Embedding model `BAAI/bge-small-en-v1.5`, 384-dim, local ONNX via `fastembed` —
  `embedding_manager.py`, `config.py:42–43`.
- ✅ pgvector HNSW cosine search, top 20 retrieved — `vector_store.py:68–115`;
  `assistant_retrieval_candidates=20` (`config.py:63–66`).
- ✅ Reranker `Xenova/ms-marco-MiniLM-L-6-v2`, top 5 kept — `rerank_manager.py`;
  `assistant_top_k=5`.
- ✅ Confidence gate threshold **0.5**, sigmoid normalization — `assistant_min_confidence=0.5`
  (`config.py:73`); `normalize_confidence()` = `1/(1+e^-score)` (`rerank_manager.py:125–138`).
- ✅ Deterministic refusal below threshold, fixed message, LLM never called —
  `assistant_service.py:37,90–91` (`INSUFFICIENT_CONTEXT_MESSAGE`, `is_sufficient()`).
- ✅ Citations carry document/section/page/similarity/rerank score — `Citation` dataclass,
  `assistant_service.py:40–49`.

## Slide 14 — Compliance Engine
- ✅ 3 frameworks, YAML-driven, auto-discovered from folder — `rule_loader.py:20,112` (globs
  `app/data/compliance_rules/*.yaml`).
- ✅ Real control IDs quoted verbatim from YAML: RBI 4.2/5.3/6.4/6.6 (`rbi_it_framework.yaml`),
  PCI 2.2/6.2/8.3/12.8 (`pci_dss_v4.yaml`), SWIFT 2.6/2.7/3.1/6.1 (`swift_csp.yaml`).
- ✅ Trigger matching = category + min-severity + source + keywords, binary PASS/FAIL —
  `compliance_engine.py:80–104` (`_finding_triggers_control`), `:107–127` (`_evaluate_control`).
- ✅ Live-recomputed on every request (not frozen at scan time) — `scan.py:552–577` handler calls
  `evaluate_compliance()` fresh against current YAML rules each call.
- ✅ "Zero code changes to add a framework" — `rule_loader.py` module docstring, lines 1–9.
- ⚠️ **Disclosed limitation, stated on-slide**: "illustrative mapping... not a certified PCI QSA,
  RBI, or SWIFT CSP attestation" — verbatim from YAML file header comments (`rbi_it_framework.yaml`
  lines 1–7, `pci_dss_v4.yaml` lines 1–7, `swift_csp.yaml` lines 1–6). Note this disclaimer lives
  in source comments, not in the user-facing API response — we surface it ourselves on the slide.

## Slide 15 — Role-Based Access Control
- ✅ 5 roles, 13 permission strings — `backend/app/auth/permissions.py:33–56` (`Permission` enum).
- ✅ Exact permission counts per role — `ROLE_PERMISSIONS` frozensets, lines 59–113: admin 13/13,
  security_engineer 11, developer 9, auditor 7, read_only 3.
- ✅ Coarse middleware blocking mutating verbs from read-only-shaped roles —
  `backend/app/middleware/permission_middleware.py` (`MUTATING_METHODS`,
  `BLOCKED_ROLES_FOR_MUTATION`).
- ✅ Fine-grained per-route permission dependency — `require_permission()`,
  `permissions.py:139–161`.
- ✅ Web/mobile clients read the same table only for UX — `frontend/src/lib/rbac.ts:24–58`;
  `mobile/lib/core/rbac/rbac.dart` (ported from the same table, per its own doc comment).
- ✅ Audit logging with actor/IP/outcome — audit log write path + `GET /api/v1/auth/audit-log`
  endpoint gated to `audit_log:read`.

## Slide 16 — Flutter Mobile Application
- ✅ Riverpod, Dio+JWT-refresh interceptor, go_router with role-aware redirects, Freezed models —
  `mobile/lib/core/network/{api_client.dart,auth_interceptor.dart}`,
  `mobile/lib/core/router/app_router.dart`, `mobile/lib/models/`.
- ✅ Fully-wired screens: Login/Signup, Dashboard (`GET /analytics/my-activity`), Repositories
  (`GET /repositories`), Start Scan (`POST /scan` / `/scan/repository`), Scan Queue/Details
  (`GET /scan`, `GET /scan/{id}`, cancel action) — confirmed against `mobile/lib/screens/`.
- ⚠️ **Disclosed placeholders, stated on-slide**: Risk Dashboard, Finding Explorer, Compliance,
  Executive Summary, Notifications, Settings — quoted directly from `mobile/docs/backend_gaps.md`
  (reasons: no cross-scan rollup endpoint, no notifications API, no self-service profile endpoint,
  Executive Intelligence explicitly out of scope for this milestone).
- ✅ SAML routes are known non-functional placeholders — explicitly called out in
  `mobile/docs/backend_gaps.md` item 8, matching backend behavior (503).

## Slide 17 — Frontend Experience
- ✅ 13+ role-aware pages — `frontend/src/App.tsx:54–195` route declarations; `frontend/src/pages/`.
- ✅ WebSocket-driven live scan lifecycle — `useScanProgressSocket` hook + `/scan/{id}/ws`.
- ✅ Framer Motion + Recharts — `frontend/package.json` (`framer-motion ^12.40.0`,
  `recharts ^3.8.1`).
- ✅ Genuine two-palette dark mode, not default scaffolding — `ThemeContext.tsx:15–37`,
  `index.css:1–56` (`@custom-variant dark`, two full `@theme` color-token blocks); charts
  themselves consume `useTheme()` for inline Recharts colors, confirmed in `BrsTrendChart.tsx` etc.
- ✅ 3D Architecture Explorer: adaptive quality tiers — `useQualityTier.ts:8–31`; hover tooltips —
  `HoverTooltip.tsx:30–84`; click-to-focus glassmorphism panel — `NodeSidePanel.tsx:36–142`; GSAP
  camera flights — `CameraRig.tsx:56–183`; 13 custom node geometries —
  `geometries/index.tsx:27–52`.
- ✅ Public, no-login access — confirmed via `PublicArchitecturePage.tsx` route (distinct from the
  authenticated `SystemArchitecturePage.tsx`).

## Slide 18 — CI/CD Integration
- ✅ KAVACH's own pipeline: `backend-test` (pytest) → `helm-validate` → `build-backend`/
  `build-frontend` (PR-safe, no push) → `deploy` (gated to `main`, `helm upgrade` + `helm test`) —
  `.github/workflows/ci-cd.yaml`.
- ✅ GitHub webhook HMAC verification, auto-enqueues a scan — `POST /api/v1/webhooks/github`,
  `X-Hub-Signature-256` verified.
- ✅ SARIF export compatible with GitHub/GitLab code-scanning — `generate_sarif()`,
  `report_generator.py:1023–1121` (valid SARIF 2.1.0).
- ✅ Slack/email/webhook notifications on completion/failure — `backend/app/services/notifications/`.
- ⚠️ **Disclosed limitation, stated on-slide**: no native merge-blocking/branch-protection gate
  shipped today — this is accurate; no such feature was found in the codebase, and the slide says
  so explicitly rather than implying one exists.

## Slide 19 — Live Demonstration Flow
- ✅ Every step maps to a real endpoint: sandbox premade scan (`POST /scan/premade/{level}`), live
  WebSocket progress, BRS/risk tab, finding explanation + AI Assistant, live compliance
  (`GET /scan/{id}/compliance`), executive PDF (`GET /reports/{id}/download/pdf`), dashboard,
  mobile app parity — see `Live_Demo_Guide.md` for the exact click-path.

## Slide 20 — Results
- ✅ "9 → 1" dedup claim — `deduplicator.py` + `enrichment.py`, `aggregation_engine.py:34–91`
  (`duplicates_merged = total_raw_findings - total_unified_findings`).
- ✅ RAG latency figures (~9ms embedding, ~11ms vector search, 15–55ms rerank, p50 100–200ms
  end-to-end with no LLM) — `docs/production_hardening.md` documented benchmark results.
- ✅ 7 report formats generated automatically per scan — `REPORT_BUILDERS` dict,
  `report_generator.py:1382–1390`; confirmed by `backend/tests/test_report_generator.py`.
- ✅ 46.6 req/s, p50 175ms, p95 640ms under 100-request/3-account load test —
  `docs/production_hardening.md` documented load-test results.
- ✅ No fabricated percentage-improvement claims — deliberate choice, stated on-slide.

## Slide 21 — Future Scope
- ✅ "In active development" items — verbatim from `README.md` Roadmap → Current Focus section
  (lines 723–727): Flutter WebSocket wiring, cross-scan rollup endpoint, full SAML validation.
- ✅ "On the roadmap" items — verbatim from `README.md` Roadmap → Future section (lines 729–739):
  notifications inbox, Knowledge Graph, Root Cause Intelligence, Security Copilot ("propose, not
  apply"), enterprise integrations, expanded compliance (ISO 27001/SOC 2).
- 📌 "Proposed direction (vision)" column — IDE plugin, continuous-learning RAG, multi-bank SaaS —
  explicitly labeled on-slide as vision/not-started, distinct from the two verified-roadmap
  columns above. This is the one slide with content beyond current-repo evidence, and it's marked
  as such deliberately.

## Slide 22 — Thank You
- ✅ Team name, members, institute — as supplied directly by the team.
- ✅ GitHub URL — `github.com/TROJAN1HAMMER/KAVACH`, matches `README.md` clone instructions
  (line 503).

---

## Cross-cutting honesty notes (worth having ready if asked)

1. **"9 scanners"** is accurate for the live chord, but a 10th scanner module (`config_scanner.py`)
   exists in the tree unused/superseded — don't be caught off guard if a technical juror finds it
   during a code walkthrough; the honest answer is "legacy, superseded by the Docker and YAML
   scanners, not part of the live pipeline."
2. **Compliance disclaimers** ("illustrative, not certified") live in YAML/code comments, not in
   the user-facing API response or UI. We say this ourselves on Slide 14 rather than waiting to be
   asked.
3. **Attack Surface Exposure confidence is a fixed 0.55** — it is not model-calibrated. If asked
   "how confident is this number," the honest answer is "it's a fixed placeholder confidence,
   documented in code as a prototype value pending a real classifier."
4. **CI/CD does not yet block merges** — webhook-triggered scanning and SARIF export exist; a
   required-status-check gate does not, per the codebase reviewed.
5. **Mobile placeholders are real and disclosed by the team itself** in
   `mobile/docs/backend_gaps.md` — this is a strength to lean into (shows engineering discipline),
   not a weakness to hide.
