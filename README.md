# KAVACH 🛡️

**An AI-assisted DevSecOps security platform built for banking and financial institutions.**

[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.139-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Flutter](https://img.shields.io/badge/Flutter-3.44-02569B?logo=flutter&logoColor=white)](https://flutter.dev/)
[![Celery](https://img.shields.io/badge/Celery-5.6-37814A?logo=celery&logoColor=white)](https://docs.celeryq.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Helm%20chart-326CE5?logo=kubernetes&logoColor=white)](https://helm.sh/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)](.github/workflows/ci-cd.yaml)
[![Status](https://img.shields.io/badge/status-active%20development-yellow)]()
[![License](https://img.shields.io/badge/license-Proprietary-lightgrey)]()

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Architecture](#architecture)
- [AI Capabilities](#ai-capabilities)
- [Role-Based Access Control](#role-based-access-control)
- [Web + Mobile](#web--mobile)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [API](#api)
- [Screenshots](#screenshots)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## Project Overview

KAVACH is a distributed, AI-assisted DevSecOps platform purpose-built for banking and financial-services engineering teams. It scans application source repositories across nine independent security tools, correlates and deduplicates the results into one unified finding set, and turns that output into what a bank actually needs to act on: a quantified, business-aware risk score, mapped to the specific regulatory controls it violates, with a citation-backed explanation of what it means and how to fix it.

### Why traditional scanners fall short

A conventional SAST or SCA tool reports "SQL injection, CVSS 8.2" and stops there. That is genuinely difficult for a bank to act on at scale, for four concrete reasons:

- **CVSS has no concept of business context.** A CVSS 8.2 in an internal reporting tool is not the same risk as a CVSS 6.5 in the payments-settlement path. Traditional tools cannot express *which module this is* or *what it is worth to the business*.
- **Compliance mapping is manual.** Regulators (RBI, PCI DSS, SWIFT CSP) require evidence that specific controls are met. Turning a raw scanner finding into "this violates PCI DSS Requirement 6.2" is normally a spreadsheet exercise performed by a human, after the fact.
- **Findings pile up faster than they can be triaged.** A single scan across nine tools on a real codebase produces hundreds of raw, overlapping, differently-worded findings for the same underlying issue.
- **Remediation guidance is generic.** "Use parameterized queries" does not tell a developer *where*, *why this specific instance matters*, or *what happens if it isn't fixed*.

KAVACH addresses all four by running every scan through a dedicated **Risk Engine**, **Compliance Engine**, and **AI Intelligence Layer** before a human ever sees the results.

### Banking Risk Score (BRS)

The BRS is KAVACH's core differentiator: a **0–100 blended score**, deliberately not a repackaged CVSS number. Each finding is scored as a weighted average across **seven factors** — CVSS, exploitability, the criticality of the business module it was found in, internet exposure, the number of compliance frameworks it violates, the asset value of the affected module, and historical incident count for that module. Every factor weight and module definition is stored in Postgres and editable at runtime via the API — none of it is a hardcoded constant. Full methodology below in [Architecture](#architecture) and in `docs/brs_audit_report.md`.

Why this matters: a CVSS-9.8 SQL injection scores very differently depending on whether it sits in the internet-facing Payments module with two compliance-clause hits and a history of incidents, versus an internal Reporting module nobody else touches. A bare CVSS number cannot express that difference. BRS is what a security team actually triages against.

### How KAVACH differs from a stock SAST/SCA pipeline

| | Traditional SAST/SCA tools | KAVACH |
|---|---|---|
| Output | Raw findings, per-tool, unranked | Cross-tool deduplicated, BRS-ranked, compliance-mapped findings |
| Risk scoring | CVSS only | 7-factor business-aware BRS + a separate Attack Surface Exposure index |
| Compliance | Manual mapping after the fact | Deterministic, automatic mapping to RBI / PCI DSS / SWIFT CSP at scan time |
| Explanation | Technical description only | Automated per-finding explanation, plus an on-demand, citation-backed AI deep-dive |
| Trigger | Manual / single CI step | Manual upload, direct URL submission, scheduled nightly rescans, and GitHub push webhooks |
| Execution | Usually one sequential job | 9 scanners fanned out in parallel across a priority-queued distributed worker pool |
| Reporting | Whatever one tool emits | 7 report formats from a single scan — executive PDF, technical PDF, SARIF, CycloneDX SBOM, unified JSON, compliance JSON, CSV |
| Access | Web only | Web console and a native Flutter mobile client against the same backend |

---

## Features

Every item below exists in the current codebase and is exercised by the platform today.

### Static Code Analysis
Semgrep (custom rule pack, with a regex-based fallback if the binary is unavailable) and ast-grep run independent, structurally-different SAST passes over the same source tree — hardcoded secrets, SQL/command injection, weak cryptography, unsafe deserialization, path traversal, and insecure randomness — deliberately overlapping so one tool's blind spot doesn't become a silent gap. Where a Joern installation is available, a third pass performs code-property-graph reachability analysis from dangerous sinks (`exec`, `eval`, `pickle.loads`, `unserialize`) back to untrusted input.

### Dependency Vulnerability Analysis
Three independent lookups feed the same aggregation layer: **pip-audit** against known-vulnerability databases, a direct **OSV.dev** batch query, and an **NVD** CVE keyword search (rate-limited, treated explicitly as *leads worth triaging*, not confirmed hits). Running three sources instead of one catches vulnerabilities that any single database has not yet indexed.

### Configuration & Infrastructure Security
A structural YAML analyzer inspects Kubernetes manifests (`hostNetwork`, `privileged`, missing resource limits, wildcard RBAC, plaintext secrets in `env`), Docker Compose files, and GitHub Actions workflows (untrusted `${{ github.event... }}` interpolation into `run:` steps, `pull_request_target` misuse). A companion Dockerfile analyzer flags unpinned base images, dangerous `EXPOSE` ports, missing `USER`/`HEALTHCHECK` instructions, and secrets baked into `ENV`/`ARG`.

### Secret Detection
An in-house, gitleaks-style regex engine detects AWS keys, GitHub/GitLab/NPM tokens, Slack tokens and webhooks, Google API keys, Stripe keys, private-key blocks, JWTs, and credentials embedded in URLs — no external binary dependency.

### Supply Chain Analysis
Every scan generates a **CycloneDX SBOM**, cross-referenced against the dependency-scan findings and fed into the Attack Surface Exposure index below.

### Cross-Tool Aggregation
A dedicated aggregation engine correlates findings across all nine tools for the same underlying issue — matching on shared CVE + package, then file + line + category, then file + category + title — before scoring, rather than treating each tool's output as independent. The result is one deduplicated, enriched `UnifiedFinding` set per scan, tagged with every source tool that flagged it and a merged CWE/OWASP/MITRE ATT&CK taxonomy.

### Banking Risk Score (BRS)
Described above — a 7-factor, business-aware, per-finding and per-scan risk score with fully configurable weights and business-module definitions.

### Attack Surface Exposure
A separate, independent 0–100 composite index — dependency count, known-CVE density, dependency staleness, risky package categories, configuration risk, and code vulnerability density — that measures exposure to *undisclosed* vulnerabilities rather than scoring what's already been found. It is explicitly documented as a heuristic exposure index, not a prediction of any specific future exploit, and does not feed into BRS: a codebase can be BRS-clean today and still be sitting on a dependency-rot problem.

### AI-Assisted Security Intelligence
Two complementary AI subsystems, detailed in [AI Capabilities](#ai-capabilities): an always-on explanation engine that annotates every finding automatically as part of the scan pipeline, and a retrieval-augmented (RAG) knowledge layer — AI Assistant chat, per-finding Intelligence, and Executive Intelligence — that answers open-ended questions with citation-backed, confidence-scored evidence pulled from an uploaded knowledge base and the platform's own scan history.

### Regulatory Compliance Mapping
Deterministic, rule-based mapping of every finding to the specific clauses it violates across **PCI DSS v4.0**, the **RBI IT Framework (2021)**, and the **SWIFT Customer Security Programme**, plus a full control-by-control PASS/FAIL evaluation per framework. Control definitions live in YAML, not code — adding or amending a rule is a configuration change. These are KAVACH's own illustrative mappings from finding category to published control text, useful for continuous self-assessment and evidence-gathering — they are not a certified PCI QSA, RBI, or SWIFT CSP attestation, and should not be presented to a regulator as one without independent review.

### Executive Reports
A business-facing PDF summarizing BRS, risk level, compliance posture, and top findings, generated asynchronously for every completed scan.

### Technical Reports
A full-detail PDF listing every finding with its complete CWE/OWASP/MITRE taxonomy, CVSS/BRS, source tools, and remediation — for engineering teams, alongside SARIF (IDE/CI integration), CycloneDX SBOM, unified findings JSON, compliance JSON, and CSV exports.

### Interactive Architecture Visualization
A 3D, explorable system-architecture diagram (React Three Fiber) available both publicly (no login required, for evaluators and recruiters) and inside the authenticated dashboard — click any component to fly the camera to it and see its purpose, inputs/outputs, and a sample API call.

### Role-Based Access Control (RBAC)
Five backend-enforced roles spanning administration, security operations, engineering, and executive oversight — see [Role-Based Access Control](#role-based-access-control).

### Audit Logging
Every authentication attempt (success and failure), role change, and administrative action is persisted to Postgres with actor, IP address, and outcome, queryable via a dedicated audit-log endpoint gated to roles holding `audit_log:read`.

### Flutter Mobile Application
A native Android/iOS client (`mobile/`) built with Flutter and Riverpod, consuming the identical FastAPI backend and RBAC model as the web console — see [Web + Mobile](#web--mobile).

### Cloud-Native Deployment
A production Helm chart (21 templates) covering Deployments, StatefulSets, autoscaling, pod-disruption budgets, network policies, ingress, and a pre-install migration job, plus a rendered plain-manifest snapshot under `k8s/` for teams that want `kubectl apply`-able YAML without Helm.

### REST API
Every route versioned under `/api/v1`, fully described in an OpenAPI 3 schema served live at `/docs` and `/redoc`.

### Modular Scanner Architecture
Each of the nine scanners is an independent Celery task that catches its own failures and always returns a result — one missing tool (for example, no local Joern install) degrades gracefully rather than blocking the pipeline. New scanners plug into the same fan-out/aggregation contract without touching existing ones.

---

## Architecture

A scan can enter the system from three places — a user submitting a URL/archive through the API or dashboard, or a verified GitHub push webhook — and all three converge on the same orchestration path. The AI/RAG layer and the two client applications sit alongside this pipeline rather than inside it: they read from the same Postgres tables the pipeline writes to.

```mermaid
flowchart TD
    A["Repository Providers<br/>(GitHub / GitLab / Bitbucket / direct upload)"] --> B["FastAPI Gateway<br/>(REST + WebSocket + Webhook intake)"]
    B --> C["Authentication<br/>(JWT · RBAC · OAuth2/OIDC · LDAP)"]
    C --> D["Scan Orchestrator<br/>(prepare → download/extract → dispatch)"]
    D --> E["Redis Queue<br/>(priority: critical / high / normal / low)"]
    E --> F["Distributed Workers<br/>(9 scanners fanned out in parallel)"]
    F --> G["Aggregation Layer<br/>(cross-tool dedup & correlation)"]
    G --> H["Risk Engine<br/>(Banking Risk Score + Attack Surface Exposure)"]
    H --> I["Automated Finding Explanations<br/>(multi-provider AI gateway)"]
    I --> J["Compliance Engine<br/>(RBI · PCI DSS · SWIFT CSP mapping)"]
    J --> K["Report Generation<br/>(PDF · SARIF · SBOM · JSON · CSV)"]
    K --> L["Web Dashboard (React)"]
    K --> M["Mobile App (Flutter)"]
    H --> N["Notifications<br/>(Slack · Email · Webhook)"]

    P["Knowledge Base<br/>(uploaded docs → chunk → embed → pgvector)"] --> Q["RAG Layer<br/>(AI Assistant · Finding Intelligence · Executive Intelligence)"]
    G -.scan history.-> Q
    Q --> L
    Q --> M

    style A fill:#2a78d6,color:#fff
    style E fill:#e34948,color:#fff
    style H fill:#eda100,color:#000
    style I fill:#4a3aa7,color:#fff
    style J fill:#1baf7a,color:#fff
    style Q fill:#4a3aa7,color:#fff
```

### Scan lifecycle, in detail

```mermaid
sequenceDiagram
    participant Client as Client / GitHub Webhook
    participant API as FastAPI API
    participant DB as PostgreSQL
    participant Queue as Redis / Celery
    participant Workers as 9 Scanner Workers
    participant Agg as Aggregator
    participant AI as AI Gateway
    participant Reports as Report Workers

    Client->>API: POST /scan/repository (or webhook push)
    API->>DB: create Repository + ScanJob (queued)
    API-->>Client: 200 scan_job_id (returns immediately)
    API->>Queue: dispatch prepare_scan_job

    Queue->>Workers: download/extract + fan out chord (9 scanners)
    Workers-->>Queue: per-scanner findings (success/failure, fault-isolated)
    Queue->>Agg: chord callback — aggregate_scan_results

    Agg->>Agg: cross-tool dedup & correlation
    Agg->>Agg: Banking Risk Score + Attack Surface Exposure
    Agg->>AI: batch finding explanation generation
    AI-->>Agg: explanation, business impact, remediation
    Agg->>Agg: compliance mapping (RBI/PCI DSS/SWIFT)
    Agg->>DB: persist Findings + ScanResult, mark job completed
    Agg->>Queue: dispatch report generation (async)
    Agg->>Client: WebSocket progress + notification (Slack/Email/Webhook)

    Reports->>DB: render PDF/SARIF/SBOM/JSON/CSV, mark reports completed
    Client->>API: GET /reports/{id}/download/{type}
```

### Layer responsibilities

| Layer | Responsibility |
|---|---|
| **Frontend** (React + Vite) | Full-featured web console — every dashboard, the AI Assistant panel, knowledge-base management, admin user management, and the public + authenticated 3D architecture explorer |
| **Flutter Mobile Client** | On-the-go companion — session/RBAC-aware navigation, repositories, scan submission and status, dashboard analytics, against the same API |
| **FastAPI Backend** | REST + WebSocket gateway, auth/RBAC enforcement, request routing to every service below |
| **PostgreSQL (+ pgvector)** | System of record for repositories, scans, findings, users, audit log, and vector-embedded knowledge-base chunks |
| **Redis** | Celery broker/result backend, per-scanner live status, rate-limit counters, AI response/embedding/rerank caches |
| **Scanner Engine** | The 9 fanned-out Celery tasks producing raw, per-tool findings |
| **Aggregation Layer** | Cross-tool correlation, deduplication, and enrichment into unified findings |
| **Risk Engine** | Banking Risk Score and Attack Surface Exposure scoring |
| **Compliance Engine** | YAML-driven control catalog evaluation against RBI / PCI DSS / SWIFT CSP |
| **AI Layer** | Automated per-finding explanations (pipeline-embedded) *and* the RAG-based Assistant / Finding Intelligence / Executive Intelligence surfaces (on-demand) |
| **Report Generator** | Asynchronous rendering of all 7 report formats, storage-backend agnostic (local disk or S3/MinIO) |

---

## AI Capabilities

KAVACH's AI is a strictly explanatory and evidentiary layer. Stated precisely, because it matters for a banking context:

> **AI never calculates a security score. AI never changes a finding. AI only explains, summarizes, retrieves evidence, and assists a human who is still the one deciding what to do.**

This is enforced structurally, not just by convention: the AI service layers only ever *read* `Finding`/`ScanJob` rows to build a prompt — none of them ever commit back to the database, and BRS/CVSS/Attack-Surface-Exposure scoring runs entirely in the Risk Engine, a separate code path the AI layer never calls into.

There are two distinct AI subsystems, addressing two different needs.

### 1. Automated finding explanations (pipeline-embedded)

Every finding gets an explanation automatically, with no user interaction required, as part of the aggregation step. A provider-agnostic gateway (`app/services/ai/gateway.py`) resolves cloud (Claude, OpenAI, Gemini) and local/self-hosted (Ollama, vLLM) providers via a single `AI_MODE` setting (`hybrid` by default — local first, cloud fallback), calling every provider over plain REST with no vendor SDK dependency. A semantic cache avoids re-explaining near-identical findings, and a rule-based template library provides a deterministic, zero-cost explanation whenever no provider is configured or reachable — a scan's completion is never blocked on AI availability.

### 2. Retrieval-Augmented Generation (RAG) knowledge layer

This is where an operator can ask KAVACH open-ended questions and get answers grounded in real, retrievable evidence rather than the model's own memory. Three interactive surfaces share one pipeline:

```mermaid
flowchart LR
    A["User question<br/>(chat / finding / executive)"] --> B["Retrieve<br/>pgvector cosine search, top 20"]
    B --> C["Rerank<br/>cross-encoder, top 5"]
    C --> D{"Confidence gate<br/>sigmoid-normalized rerank score"}
    D -- below threshold --> E["Refuse / deterministic fallback<br/>never calls the LLM"]
    D -- above threshold --> F["Grounded generation<br/>LLM sees ONLY the retrieved chunks"]
    F --> G["Response + citations<br/>document · page · section · similarity score"]
    E --> G

    style D fill:#eda100,color:#000
    style E fill:#e34948,color:#fff
    style F fill:#4a3aa7,color:#fff
```

- **Knowledge Base** — an administrator uploads PDF, Markdown, or plain-text reference material (OWASP guides, internal policy, regulatory text). Each document is deduplicated by content hash (an exact re-upload is rejected, not silently re-indexed), version-chained by filename, chunked with heading/section/page-aware splitting, and embedded locally with an ONNX model (`BAAI/bge-small-en-v1.5`, no external API call) into a Postgres/pgvector index.
- **AI Assistant** — a chat panel that retrieves the top 20 chunks by cosine similarity, reranks them with a local cross-encoder (`Xenova/ms-marco-MiniLM-L-6-v2`) down to the top 5, and only generates an answer if the reranked confidence clears a threshold. Below it, KAVACH returns a fixed message stating it could not find sufficient information — it never falls back to the model's general knowledge. Every answer streams with its supporting citations, a confidence score, retrieved-document count, and latency.
- **Finding Intelligence** — opening a finding runs the same retrieve → rerank → confidence-gate pipeline against the knowledge base to produce a plain-English explanation, business impact, technical impact, recommended remediation, verification steps, and a code example — all citation-backed. The deterministic facts (CWE, OWASP category, MITRE ATT&CK technique, RBI/PCI/SWIFT clause) come directly from KAVACH's own aggregation engine and are always shown, whether or not the generative gate passes; the narrative fields simply stay empty (with an explicit "not grounded" note) if it doesn't.
- **Executive Intelligence** — answers portfolio-level questions ("What are our biggest risks?", "What changed this week?") grounded first in a deterministic snapshot computed directly from scan history (no LLM involved in the numbers themselves), with knowledge-base retrieval as a secondary evidence source. Exportable to PDF.
- **Production hardening** — Redis-backed response and embedding caching, per-user per-endpoint rate limiting, search analytics, a feedback-collection endpoint, a benchmarking endpoint, and extended `/health/ready` checks for the vector index, embedding model, and rerank model.

**What KAVACH does not ship out of the box:** reference material. The deterministic CWE/OWASP/MITRE/compliance identifiers on every finding come from KAVACH's own scanning and compliance engines regardless of what's in the knowledge base — but the narrative, citation-backed explanations only populate once an administrator has uploaded the source documents to ground them in.

---

## Role-Based Access Control

KAVACH enforces five roles at the backend — both a coarse middleware (blocking any mutating request from a read-only-shaped role outright) and fine-grained per-route permission checks. The web and mobile clients use the same role table purely to hide navigation a role can't use; it is a UX convenience, never the actual security boundary.

| Role | Display name | Typical use |
|---|---|---|
| `admin` | **Administrator** | Full platform access: user/role management, risk configuration, all scanning and reporting capability |
| `security_engineer` | **Security Manager** | Runs and triages scans, manages risk configuration, reads the audit log and team-wide analytics |
| `developer` | **Security Analyst** | Submits scans, reads findings and compliance results, uses the AI Assistant and knowledge base |
| `auditor` | **Executive / Board Member** | Read-only access to risk, compliance, and executive reporting — no scan submission |
| `read_only` | **Read Only** | The self-registration default and minimal-viewer fallback — scan/report visibility only |

---

## Web + Mobile

KAVACH ships two client applications, and both consume the exact same `/api/v1` FastAPI backend, the same JWT/RBAC model, and the same data — there is no mobile-specific API and no feature that exists only for one client by design.

- **Web platform** (`frontend/`) — the full-featured console: every dashboard, the AI Assistant and knowledge-base management, RAG operations/benchmarking, admin user management, and the public + authenticated 3D architecture explorer. This is where compliance officers, security engineers, and administrators do deep work.
- **Flutter mobile application** (`mobile/`) — a native Android/iOS companion for checking on things away from a desk: dashboard analytics, repository and scan-queue status, starting a scan, and viewing scan/risk detail, gated by the same backend-issued role and permissions. Screens the backend does not yet have a matching endpoint for (cross-scan finding/compliance rollups, a notifications inbox, self-service profile editing) ship as clearly-labeled placeholders rather than fabricated data — see `mobile/docs/backend_gaps.md`.

Both are independent, freely deployable clients against one backend — a security engineer can triage a scan on the web console and a manager can check the same scan's BRS from their phone, both reading from the same `ScanJob` row.

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 19.2 | UI framework |
| TypeScript | ~6.0 | Static typing |
| Vite | 8.0 | Build tool / dev server |
| Tailwind CSS | 4.3 | Styling (class-based dark mode) |
| React Router | 7.18 | Client-side routing, route-level code splitting |
| TanStack React Query | 5.101 | Server-state data fetching/caching |
| Recharts | 3.8 | Charts (BRS trend, severity distribution, compliance) |
| three.js / @react-three/fiber / drei | 0.185 / 9.6 / 10.7 | The 3D architecture explorer |
| Axios | 1.18 | HTTP client with JWT refresh interceptor |
| Framer Motion | 12.40 | Animation |
| Lucide React | 1.21 | Icons |

### Mobile

| Technology | Purpose |
|---|---|
| Flutter | Cross-platform (Android/iOS) client framework |
| Riverpod | State management and dependency injection |
| Dio | HTTP client, with a JWT auth/refresh interceptor mirroring the web client's |
| go_router | Declarative routing with backend-role-aware redirects |
| Freezed / json_serializable | Typed models generated to mirror backend Pydantic schemas field-for-field |
| flutter_secure_storage | Encrypted token persistence for session restore |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Runtime |
| FastAPI | 0.139 | API framework |
| Uvicorn | 0.51 | ASGI server |
| SQLAlchemy | 2.0 (async) | ORM |
| Alembic | 1.18 | Database migrations |
| Pydantic | 2.13 | Schema validation |
| Celery | 5.6 | Distributed task queue |
| structlog | 26.1 | Structured JSON logging |
| python-jose | 3.5 | JWT signing/verification |
| passlib[bcrypt] | — | Password hashing |
| ldap3 | — | LDAP SSO bind/search |
| reportlab | 5.0 | PDF report generation |
| boto3 | 1.43 | S3/MinIO report storage |

### Database & Caching

| Technology | Version | Purpose |
|---|---|---|
| PostgreSQL | 16 | Primary datastore |
| pgvector | — | Vector similarity search for the knowledge-base embeddings (HNSW index) |
| asyncpg | 0.31 | Async Postgres driver |
| Redis | 7 | Celery broker/result backend, per-scanner live status, rate limiting, AI/embedding/rerank caches |

### AI / RAG

| Component | Detail |
|---|---|
| Cloud LLM providers | Anthropic Claude, OpenAI, Google Gemini — plain REST via `httpx`, no vendor SDK |
| Local/self-hosted LLM providers | Ollama, vLLM (OpenAI-compatible local inference) |
| Embedding model | `BAAI/bge-small-en-v1.5` via `fastembed` — local ONNX inference, no GPU/torch dependency |
| Reranker | `Xenova/ms-marco-MiniLM-L-6-v2` cross-encoder, also via `fastembed` |
| Vector store | PostgreSQL + `pgvector` (HNSW) |

### Authentication

| Mechanism | Implementation |
|---|---|
| JWT | Access (short-lived) + refresh (long-lived) tokens, HS256 |
| Local auth | Email/password via bcrypt |
| SSO | OAuth2/OIDC (any standards-compliant IdP), LDAP (real bind + search); SAML routes exist but return 503 pending an XML-security toolkit dependency |
| RBAC | 5 roles, enforced by middleware + per-route permission checks |

### Visualization

| Tool | Purpose |
|---|---|
| Recharts | BRS trend, severity distribution, and compliance charts (web) |
| fl_chart | Equivalent charting on the Flutter mobile client |
| react-three-fiber / drei | The interactive 3D architecture explorer |
| Grafana | 3 pre-built dashboards — API, Celery, Risk Trend |

### Deployment / CI/CD

| Tool | Purpose |
|---|---|
| Docker / Docker Compose | Local multi-service stack (Postgres, Redis, API, 2 worker pools, beat, Flower, frontend) |
| Kubernetes (Helm chart) | Production deployment — 21 templates covering Deployments, StatefulSets, HPA, PDB, NetworkPolicy, Ingress, migration Job |
| GitHub Actions | `backend-test` (pytest), `helm-validate` (helm lint + template), `build-backend`/`build-frontend` (Docker images to GHCR), `deploy` (Helm upgrade, gated to `main`) |
| Prometheus / Alertmanager | Metrics + 7 alert rules (error rate, latency, backlog, scanner failures, disk, beat down) |
| OpenTelemetry | Distributed tracing (OTLP gRPC exporter) |
| Flower | Celery task/worker monitoring UI |

---

## Project Structure

```text
kavach-uco/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── endpoints/        # scan, reports, repositories, risk_config, webhooks,
│   │   │   │                     # knowledge, assistant, finding_intelligence,
│   │   │   │                     # executive_intelligence, rag_operations, analytics
│   │   │   └── router.py         # aggregates every v1 router
│   │   ├── auth/                 # router, sso_router, admin_router, dependencies,
│   │   │   │                     # permissions, security, service
│   │   │   └── sso/               # oauth2_provider.py, ldap_provider.py, saml_provider.py
│   │   ├── core/                 # logging, metrics, telemetry, error_handlers, exceptions
│   │   ├── data/                 # compliance_rules/*.yaml, compliance_mappings.json
│   │   ├── db/                   # async engine/session, base, mixins
│   │   ├── integrations/         # github/, gitlab/, bitbucket/ repo-download clients
│   │   ├── middleware/           # metrics, permission, rate_limit, request_context
│   │   ├── models/                # SQLAlchemy models — repository, scan_job, finding,
│   │   │                          # scan_result, report, user, knowledge_document, ...
│   │   ├── orchestrator/         # Redis-backed per-scanner status store
│   │   ├── repositories/          # data-access layer per model
│   │   ├── schemas/               # Pydantic request/response DTOs
│   │   ├── services/
│   │   │   ├── aggregation/       # cross-tool dedup/correlation engine
│   │   │   ├── ai/                # gateway, providers/ (claude/openai/gemini/ollama/vllm),
│   │   │   │                      # cache, templates
│   │   │   ├── assistant/         # RAG-grounded chat pipeline
│   │   │   ├── finding_intelligence/ # RAG-grounded per-finding deep-dive
│   │   │   ├── executive_intelligence/ # evidence-grounded executive Q&A
│   │   │   ├── knowledge_base/    # ingestion, chunking, embedding, vector store
│   │   │   ├── search_analytics/  # RAG search analytics
│   │   │   ├── feedback/          # RAG feedback collection
│   │   │   ├── benchmark/         # RAG benchmark suite
│   │   │   ├── audit/             # audit log writer
│   │   │   ├── compliance/        # compliance_engine, compliance_mapper, rule_loader
│   │   │   ├── notifications/     # slack, email, webhook providers + notification_service
│   │   │   ├── reports/           # report_generator, storage (local/S3)
│   │   │   ├── risk/              # brs_engine, attack_surface_exposure
│   │   │   └── scanning/          # 9 scanner integrations + aggregator
│   │   ├── tasks/                 # Celery tasks: scan, scanner, aggregator, report,
│   │   │                          # maintenance, scheduled_scan, archive
│   │   ├── workers/                # celery_app.py — queues, beat schedule
│   │   └── main.py                 # FastAPI app, middleware, lifespan
│   ├── alembic/versions/           # database migrations
│   ├── scripts/generate_openapi.py
│   ├── tests/
│   │   ├── test_brs_engine.py
│   │   └── integration/            # conftest.py + full-pipeline/webhook/archive tests
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── architecture/scene3d/ # the 3D architecture explorer
│   │   │   ├── charts/             # BrsTrendChart, SeverityDistributionChart, ComplianceBarChart
│   │   │   ├── layout/             # AppShell, Sidebar, Topbar, ProtectedRoute, ThemeToggle
│   │   │   ├── scans/              # NewScanModal, ScanDetailPanel, FindingDetailModal
│   │   │   └── ui/                 # Button, Card, Badge, Table, Modal, StatTile, ...
│   │   ├── contexts/                # AuthContext, ThemeContext, ToastContext
│   │   ├── hooks/                   # useAuth, useTheme, useScanJobs, useFindings,
│   │   │                            # useScanProgressSocket, usePermissions, ...
│   │   ├── lib/api/                  # axios client + per-resource API modules
│   │   ├── lib/rbac.ts                # client-side route/role table (UX gate only)
│   │   ├── pages/                    # Repositories, ScanQueue, Risk, Compliance,
│   │   │                             # FindingExplorer, Executive, Knowledge, Assistant,
│   │   │                             # RagOperations, Architecture, Login
│   │   └── types/api.ts               # shared TypeScript contracts mirroring backend schemas
│   ├── Dockerfile
│   └── package.json
├── mobile/
│   ├── lib/
│   │   ├── core/                     # theme, rbac, network (Dio client + JWT interceptor), router
│   │   ├── models/                    # freezed/json_serializable models mirroring backend schemas
│   │   ├── services/                  # one class per backend router — raw HTTP calls
│   │   ├── repositories/              # domain layer over services, normalized error handling
│   │   ├── providers/                 # Riverpod state (auth, lists, feature data)
│   │   ├── screens/                   # Splash, Landing, Login, Signup, Dashboard, Repositories,
│   │   │                              # Scans, Risk, Findings, Compliance, Reports, Executive,
│   │   │                              # Architecture, Notifications, Profile, Settings, About
│   │   └── widgets/                   # shared UI components, layout shell
│   ├── docs/backend_gaps.md            # endpoints the mobile app needs that don't exist yet
│   └── pubspec.yaml
├── docs/                                # RAG milestone design docs + BRS audit report
├── helm/kavach/
│   ├── templates/                    # 21 templates — Deployments, StatefulSets, HPA, PDB,
│   │                                 # NetworkPolicy, Ingress, migration Job, ...
│   ├── dashboards/                    # Grafana dashboard JSON (API, Celery, Risk Trend)
│   └── values.yaml
├── k8s/                                # rendered manifest snapshot (reference only — Helm is the source of truth)
├── .github/workflows/ci-cd.yaml        # test, lint, build, deploy pipeline
└── README.md
```

---

## Installation

### Requirements

- Python 3.11+
- Node.js 20+
- Flutter 3.24+ (only if building the mobile app)
- PostgreSQL 16 with the `pgvector` extension (or use the provided Docker Compose service)
- Redis 7 (or use the provided Docker Compose service)
- Docker + Docker Compose (recommended for local development)

### Clone

```bash
git clone https://github.com/TROJAN1HAMMER/KAVACH.git
cd KAVACH
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # then edit .env — see Environment variables below
alembic upgrade head       # apply all migrations
```

### Frontend

```bash
cd frontend
npm install
```

### Flutter Mobile

```bash
cd mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs   # generate typed models
```

### Database

Either run the Docker Compose `postgres` service (already configured with `pgvector`), or provision your own PostgreSQL 16 instance with the `pgvector` extension enabled and set `DATABASE_URL` accordingly before running `alembic upgrade head`.

### Redis

Either run the Docker Compose `redis` service, or point `REDIS_URL` in `.env` at any Redis 7 instance.

### Docker

The fastest path to a fully working local stack — Postgres, Redis, API, both worker pools, beat, Flower, and the frontend — is Docker Compose:

```bash
cd backend
docker compose up --build
```

### Environment Variables

All settings live in `backend/.env` (see `backend/.env.example` for the full, documented list). The essentials to change before running anything real:

```env
DATABASE_URL=postgresql+asyncpg://kavach:kavach_secret@localhost:5432/kavach_db
REDIS_URL=redis://localhost:6379/0

JWT_SECRET_KEY=change-me-jwt-32chars-minimum-in-production
APP_SECRET_KEY=change-me-in-production-32chars-min

# At least one AI provider, or KAVACH falls back to rule-based templates
# and RAG features return "insufficient information" rather than hallucinating
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Optional: GitHub webhook intake
GITHUB_WEBHOOK_SECRET=

# Optional: notifications
NOTIFICATIONS_ENABLED=false
SLACK_WEBHOOK_URL=
```

---

## Running the Project

### Backend

```bash
cd backend
uvicorn app.main:app --reload
```
API available at `http://localhost:8000` — interactive docs at `/docs`, ReDoc at `/redoc`.

### Celery (workers + beat)

```bash
# Priority worker pool — critical/high scans
celery -A celery_worker.celery_app worker --loglevel=info --queues=kavach.critical,kavach.high --hostname=critical@%h

# Bulk-throughput worker pool — normal/low scans
celery -A celery_worker.celery_app worker --loglevel=info --queues=kavach.normal,kavach.low --hostname=default@%h

# Scheduler (nightly rescans, stalled-job sweep, archive sweep) — exactly one instance
celery -A celery_worker.celery_app beat --loglevel=info
```

> On Windows, add `--pool=solo` to each worker command.

### Frontend

```bash
cd frontend
npm run dev
```
Dashboard available at `http://localhost:5173`.

### Flutter Mobile

```bash
cd mobile
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1   # Android emulator
flutter run --dart-define=API_BASE_URL=http://localhost:8000/api/v1  # iOS simulator / web preview
```

### Docker Compose (full stack)

```bash
cd backend
docker compose up --build
```
Brings up `postgres`, `redis`, `api` (`:8000`), `worker-critical`, `worker-default`, `beat`, `flower` (`:5555`), and `frontend` (`:5173`) together.

---

## API

Every route is versioned under `/api/v1` and (except the GitHub webhook, which is HMAC-verified instead) requires `Authorization: Bearer <access_token>`. The full, always-current schema is served live at `GET /docs` and `GET /redoc`, and can be exported with `python scripts/generate_openapi.py`.

### Authentication & Users

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Create an account (always least-privileged `read_only`) |
| POST | `/api/v1/auth/login` | OAuth2 password flow — returns access + refresh tokens |
| POST | `/api/v1/auth/refresh` | Exchange a refresh token for a new access token |
| GET | `/api/v1/auth/me` | Current authenticated user, including resolved permissions |
| GET | `/api/v1/auth/admin/users` | List users *(admin)* |
| PATCH | `/api/v1/auth/admin/users/{id}/role` | Change a user's role *(admin)* |
| PATCH | `/api/v1/auth/admin/users/{id}/active` | Enable/disable a user *(admin)* |
| GET | `/api/v1/auth/audit-log` | Query the audit log *(audit_log:read)* |

### Repositories & Scans

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/repositories` | List known repositories |
| PATCH | `/api/v1/repositories/{id}/scheduled-scan` | Enable/disable nightly rescans |
| POST | `/api/v1/scan` | Submit a repository as a `.zip` upload |
| POST | `/api/v1/scan/repository` | Submit a repository by URL |
| POST | `/api/v1/scan/premade/{risk_level}` | Run a bundled sandbox payload (`low`/`medium`/`high`) |
| GET | `/api/v1/scan` | List scan jobs (filterable by status) |
| GET | `/api/v1/scan/{id}` | Scan job status, progress, BRS/compliance summary |
| POST | `/api/v1/scan/{id}/cancel` | Cancel a queued or running scan |
| WS | `/api/v1/scan/{id}/ws` | Real-time per-scanner and job-level progress |
| GET | `/api/v1/scan/{id}/findings` | All findings for a completed scan |

### Compliance & Reports

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/scan/{id}/compliance` | Live-recomputed compliance evaluation for a scan |
| GET | `/api/v1/reports/{id}` | Per-report-type generation status |
| GET | `/api/v1/reports/{id}/download/{type}` | Download (or S3 redirect for) a generated report |

### Risk Configuration & Analytics

| Method | Path | Description |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/v1/risk/modules` | Manage business-module criticality/asset-value config |
| GET/PATCH | `/api/v1/risk/factor-weights/{factor_name}` | Manage BRS factor weights |
| POST | `/api/v1/risk/preview` | Score a synthetic finding against current config |
| GET | `/api/v1/analytics/my-activity` | Personal scan/finding activity summary |
| GET | `/api/v1/analytics/team-activity` | Team-wide activity summary *(team_analytics:read)* |

### AI & Knowledge Base

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/knowledge/upload` | Upload a reference document (PDF/Markdown/text) |
| GET | `/api/v1/knowledge/documents` | List indexed documents |
| POST | `/api/v1/knowledge/search` | Retrieve top-K chunks for a query (no LLM call) |
| POST | `/api/v1/assistant/chat` | Streamed, RAG-grounded chat with citations |
| GET | `/api/v1/findings/{id}/intelligence` | Citation-backed, RAG-grounded finding deep-dive |
| GET | `/api/v1/scan/{id}/findings/{id}/explain/stream` | SSE-streamed automated explanation for one finding |
| POST | `/api/v1/executive-intelligence/*` | Evidence-grounded executive Q&A |
| POST | `/api/v1/rag-operations/benchmark` | Run the RAG benchmark suite *(team_analytics:read)* |
| GET | `/api/v1/rag-operations/search-analytics` | RAG search analytics |
| POST | `/api/v1/feedback` | Submit feedback on an AI response |

### Webhooks & Notifications

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/webhooks/github` | GitHub push-event receiver (HMAC-verified via `X-Hub-Signature-256`) |

There is no notification *inbox* endpoint today — Slack, email, and outbound webhook notifications are configured server-side and fire automatically on scan completion/failure and stalled-worker detection (`NOTIFICATIONS_ENABLED`, `SLACK_WEBHOOK_URL` in `.env`). A pull/list API for in-app notifications is on the [roadmap](#roadmap).

---

## Screenshots

> Add real captures to `docs/screenshots/` and update the paths below — placeholders until then.

| | |
|---|---|
| **Landing Page** <br> ![Landing page](docs/screenshots/landing.png) | **Dashboard** <br> ![Dashboard](docs/screenshots/dashboard.png) |
| **Architecture Explorer** <br> ![3D architecture explorer](docs/screenshots/architecture.png) | **Scan Results** <br> ![Scan results](docs/screenshots/scan-results.png) |
| **Reports** <br> ![Report generation](docs/screenshots/reports.png) | **Flutter App** <br> ![Flutter mobile app](docs/screenshots/mobile.png) |

---

## Roadmap

### Completed

Static/dependency/config/secret/container scanning across 9 tools; cross-tool aggregation; Banking Risk Score + Attack Surface Exposure; RBI/PCI DSS/SWIFT CSP compliance mapping; a full retrieval-augmented-generation knowledge layer (Knowledge Base, AI Assistant, Finding Intelligence, Executive Intelligence) with citations, confidence gating, and production hardening (caching, rate limiting, analytics, feedback, benchmarking); automated per-finding explanations with multi-provider (cloud + local) AI and template fallback; GitHub webhook intake; scheduled rescans; real-time WebSocket scan progress; 7 report formats; JWT/RBAC/OAuth2/LDAP auth; a native Flutter mobile client; Prometheus/Grafana/OpenTelemetry observability; Docker Compose and Kubernetes/Helm deployment; a CI/CD pipeline (test, lint, build, deploy); a growing unit + real-infrastructure integration test suite.

### Current focus

- Wiring the Flutter mobile client's live scan-progress screen to the existing WebSocket endpoint (currently polling-only)
- A cross-scan findings/compliance rollup endpoint, so both clients can show "all findings across my repositories" without composing it from per-scan calls
- Full SAML 2.0 assertion validation (currently scaffolded behind a 503 pending an `xmlsec`-backed toolkit dependency)

### Future

- **A notifications inbox API** — list/mark-read for in-app notifications, and device push-token registration for the mobile client (today, delivery is outbound-only: Slack/email/webhook)
- **Knowledge Graph** — linking findings, CWEs, and compliance clauses into a queryable graph rather than flat per-finding fields
- **Root Cause Intelligence** — tracing a class of finding back to the commit/pattern that introduced it across a repository's history
- **Security Copilot** — an assistant that can propose (not apply) a remediation diff, not just describe one
- **Compliance Copilot** — conversational drafting of audit evidence packages from the compliance engine's own PASS/FAIL data
- **Historical Similar Findings** — surfacing prior findings and their eventual resolution when a new, similar one appears
- **Enterprise Integrations** — GitLab/Bitbucket inbound webhook receivers (outbound download clients already exist), pull-request-triggered diff-scoped scans, Jira/ServiceNow ticket creation, SIEM export
- **Expanded compliance coverage** beyond RBI/PCI DSS/SWIFT CSP (e.g. ISO 27001, SOC 2)
- **Automatic S3 lifecycle-policy management** for archived report objects, and a manual, on-demand archive-sweep trigger for operators

---

## Contributing

1. **Fork** the repository and create a feature branch from `main` (`git checkout -b feature/your-feature`).
2. **Write real tests** for any new behavior — unit tests for pure logic (see `backend/tests/test_brs_engine.py`), integration tests against real infrastructure for anything DB/queue/API-facing (see `backend/tests/integration/`). PRs that touch scanning, aggregation, risk scoring, compliance mapping, or the RAG pipeline without a corresponding test will be asked for one.
3. **Match existing conventions** — structured logging via `structlog`, async SQLAlchemy sessions via the existing repository pattern, Pydantic schemas for every API boundary, freezed/Riverpod conventions on the Flutter side, and comments that explain *why*, not *what*.
4. **Run the full check before opening a PR**:
   ```bash
   # backend
   cd backend && pytest && alembic upgrade head

   # frontend
   cd frontend && npm run lint && npx tsc -b --noEmit && npm run build

   # mobile
   cd mobile && flutter analyze && flutter test
   ```
5. **Open a pull request** with a clear description of the problem, the approach, and how it was verified. Include migration files for any schema change — never hand-edit an already-applied migration.
6. **Security-sensitive changes** (auth, RBAC, webhook verification, secret handling, anything touching the AI confidence gate) should call that out explicitly in the PR description for closer review.

---

## License

Proprietary — All Rights Reserved. This repository does not currently carry an open-source license; all rights to the source code are reserved by the project maintainers. Contact the maintainers before redistributing, sublicensing, or using this code outside its intended engagement.

---

## Acknowledgements

KAVACH is built on top of, and would not exist without, the following open-source projects:

**Scanning & security tooling** — [Semgrep](https://semgrep.dev/), [ast-grep](https://ast-grep.github.io/), [Joern](https://joern.io/), [pip-audit](https://github.com/pypa/pip-audit), [OSV.dev](https://osv.dev/), the [NVD CVE API](https://nvd.nist.gov/developers), [CycloneDX](https://cyclonedx.org/), the [SARIF](https://sarifweb.azurewebsites.net/) specification.

**Backend** — [FastAPI](https://fastapi.tiangolo.com/), [SQLAlchemy](https://www.sqlalchemy.org/), [Celery](https://docs.celeryq.dev/), [Pydantic](https://docs.pydantic.dev/), [PostgreSQL](https://www.postgresql.org/) and [pgvector](https://github.com/pgvector/pgvector), [Redis](https://redis.io/), [ReportLab](https://www.reportlab.com/).

**AI / RAG** — [fastembed](https://github.com/qdrant/fastembed) and the [`BAAI/bge-small-en-v1.5`](https://huggingface.co/BAAI/bge-small-en-v1.5) and [`Xenova/ms-marco-MiniLM-L-6-v2`](https://huggingface.co/Xenova/ms-marco-MiniLM-L-6-v2) models it serves, plus Anthropic, OpenAI, Google, [Ollama](https://ollama.com/), and [vLLM](https://github.com/vllm-project/vllm) for LLM inference.

**Frontend** — [React](https://react.dev/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/), [Recharts](https://recharts.org/), [react-three-fiber](https://docs.pmnd.rs/react-three-fiber) and [three.js](https://threejs.org/), [Framer Motion](https://www.framer.com/motion/).

**Mobile** — [Flutter](https://flutter.dev/) and [Riverpod](https://riverpod.dev/).

**Infrastructure & observability** — [Docker](https://www.docker.com/), [Kubernetes](https://kubernetes.io/) and [Helm](https://helm.sh/), [Prometheus](https://prometheus.io/), [Grafana](https://grafana.com/), [OpenTelemetry](https://opentelemetry.io/), [Flower](https://flower.readthedocs.io/).
