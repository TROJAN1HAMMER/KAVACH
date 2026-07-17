# KAVACH 🛡️

**Enterprise AI-Powered DevSecOps Security Platform for Banking & Financial Institutions**

[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.139-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Celery](https://img.shields.io/badge/Celery-5.6-37814A?logo=celery&logoColor=white)](https://docs.celeryq.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Helm%20chart-326CE5?logo=kubernetes&logoColor=white)](https://helm.sh/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Status](https://img.shields.io/badge/status-active%20development-yellow)]()
[![License](https://img.shields.io/badge/license-Proprietary-lightgrey)]()

---

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Folder Structure](#folder-structure)
- [Installation](#installation)
- [Running Locally](#running-locally)
- [API Documentation](#api-documentation)
- [Banking Risk Score](#banking-risk-score)
- [AI Layer](#ai-layer)
- [Compliance Engine](#compliance-engine)
- [Dashboard](#dashboard)
- [Reports](#reports)
- [Security](#security)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Project Overview

KAVACH is a distributed, AI-augmented DevSecOps security platform purpose-built for banking and financial-services engineering teams. It scans application source repositories for vulnerabilities across nine independent tools, correlates and deduplicates the results, and turns raw findings into the thing a bank actually needs to act on: a quantified, business-aware risk number, mapped to the specific regulatory controls it violates, with an AI-generated explanation of what it means and how to fix it.

### The problem

Traditional DevSecOps tooling stops at the finding. A SAST scanner reports "SQL injection, CVSS 8.2" and moves on. That output is genuinely difficult for a bank to act on at scale:

- **CVSS alone doesn't reflect business risk.** A CVSS 8.2 in an internal reporting tool is not the same risk as a CVSS 6.5 in the payments-settlement module. Traditional tools have no concept of *which module this is* or *what it's worth to the business*.
- **Compliance mapping is manual.** Regulators (RBI, PCI-DSS, SWIFT CSP) require evidence that specific controls are met. Mapping a raw scanner finding to "PCI-DSS Requirement 6.2" is normally a spreadsheet exercise done by a human, after the fact.
- **Findings pile up faster than they can be triaged.** A single scan across nine tools on a real codebase can produce hundreds of raw, overlapping, differently-worded findings for the same underlying issue.
- **Remediation guidance is generic.** "Use parameterized queries" doesn't tell a developer *where*, *why this specific instance matters*, or *what the business impact of not fixing it is*.

KAVACH addresses all four by running scan results through a dedicated **Risk Engine**, **Compliance Engine**, and **AI Layer** before a human ever sees them — turning a pile of raw tool output into a scored, mapped, explained, and prioritized set of findings.

### The Banking Risk Score (BRS)

The BRS is KAVACH's core differentiator. It is a **0–100 blended score**, deliberately *not* a repackaged CVSS number. Each finding is scored as a weighted average across **seven factors** — raw CVSS, exploitability, the criticality of the business module it was found in (payments, authentication, reporting, ...), internet exposure, the number of compliance frameworks it violates, the asset value of the affected module, and historical incident count for that module — configurable per-deployment via `RiskFactorWeight` rows, not hardcoded. See [Banking Risk Score](#banking-risk-score) for the full methodology.

Alongside BRS, KAVACH separately computes a **Zero-Day Risk Score** — a predictive estimate (dependency staleness, known-CVE density, risky package categories, configuration risk, code vulnerability density) of exposure to *undisclosed* vulnerabilities, since a codebase can be BRS-clean today and still be sitting on a ticking dependency-rot problem.

### How KAVACH differs from traditional DevSecOps tools

| | Traditional SAST/SCA tools | KAVACH |
|---|---|---|
| Output | Raw findings, per-tool, unranked | Cross-tool deduplicated, BRS-ranked, compliance-mapped findings |
| Risk scoring | CVSS only | 7-factor business-aware BRS + a separate zero-day prediction |
| Compliance | Manual mapping after the fact | Deterministic, automatic mapping to RBI/PCI-DSS/SWIFT CSP at scan time |
| Explanation | Technical description only | AI-generated plain-language explanation + business impact + remediation, cached |
| Trigger | Manual / CI step | Manual upload, direct URL submission, scheduled nightly rescans, **and** GitHub push webhooks |
| Execution | Usually a single sequential job | 9 scanners fanned out in parallel across a priority-queued distributed worker pool |
| Reporting | Whatever one tool emits | 7 report formats (executive PDF, technical PDF, SARIF, CycloneDX SBOM, unified JSON, compliance JSON, CSV) from one scan |
| Lifecycle | Findings live forever in one flat list | Nightly archive sweep reclaims report artifacts past a retention window; scan/finding history is retained |

---

## Key Features

Every feature below is implemented in the current codebase — none of this is aspirational.

**Scanning**
- **Static Code Analysis** — Semgrep (`app/services/scanning/static_scanner.py`) and ast-grep (`ast_grep_scanner.py`) for pattern-based source analysis, plus Joern for deep code-property-graph analysis where available.
- **Dependency Analysis** — pip-audit-based scanning (`dependency_scanner.py`) against known-vulnerability databases, plus dedicated OSV (`osv_scanner.py`) and NVD (`nvd_scanner.py`) lookups.
- **Configuration Scanning** — YAML/config-file misconfiguration detection (`yaml_scanner.py`, `config_scanner.py`).
- **Secret Detection** — hardcoded credential/key/token scanning (`secrets_scanner.py`).
- **Container/Docker Scanning** — Dockerfile and image configuration analysis (`docker_scanner.py`).
- **Supply Chain Security** — CycloneDX SBOM generation for every scan, cross-referenced with dependency findings.
- **Cross-Tool Aggregation** — a dedicated aggregation layer (`app/services/aggregation/`) correlates and deduplicates findings reported by *multiple* tools for the same underlying issue, rather than fingerprinting per-source.

**Risk & Compliance**
- **Banking Risk Score (BRS)** — 7-factor, business-aware, per-finding and per-scan risk scoring (`app/services/risk/brs_engine.py`).
- **Zero-Day Risk Prediction** — a separate predictive score for undisclosed-vulnerability exposure (`app/services/risk/zero_day_predictor.py`).
- **Compliance Mapping** — deterministic per-finding mapping to RBI IT Framework 2021, PCI-DSS v4.0, and SWIFT CSP clauses (`app/services/compliance/compliance_mapper.py`), plus scan-level control-by-control PASS/FAIL evaluation (`compliance_engine.py`).
- **Configurable Risk Modules** — business-module criticality/asset-value weighting and per-factor BRS weights are stored in Postgres and editable via API (`app/api/v1/endpoints/risk_config.py`), not hardcoded constants.

**AI**
- **AI-Powered Security Explanations** — plain-language, business-context explanations of each finding.
- **AI Remediation Suggestions** — concrete, actionable fix guidance per finding.
- **Multi-provider AI Gateway** — Claude, OpenAI, and Gemini (cloud) plus Ollama and vLLM (self-hosted/local), selectable via a single `AI_MODE` setting (`app/services/ai/gateway.py`).
- **Response Caching & Template Fallback** — a semantic cache avoids re-explaining near-identical findings, and a rule-based template library provides zero-cost explanations when no AI provider is configured or reachable.
- **On-demand Streaming Explanations** — a Server-Sent-Events endpoint streams a live AI explanation for a single finding.

**Orchestration & Execution**
- **Async Scan Execution** — every scan runs asynchronously against a Celery-backed job queue; the submitting request returns immediately.
- **Queue-based Processing** — priority-queued distributed workers (`kavach.critical`/`kavach.high`/`kavach.normal`/`kavach.low`), with 9 scanners fanned out in parallel per scan via a Celery chord.
- **Multi-scan Support** — repository URL submission, direct `.zip` upload, and pre-bundled sandbox payloads.
- **GitHub Webhook Intake** — HMAC-verified inbound webhook (`app/api/v1/endpoints/webhooks.py`) that automatically queues a scan on `push` events.
- **Scheduled Rescans** — nightly Celery Beat sweep re-scans any repository opted in to scheduled scanning.
- **Real-time Status Updates** — a WebSocket endpoint streams live per-scanner and job-level progress to the dashboard as a scan runs; polling REST endpoints are available as a fallback.
- **Stalled-job Detection** — a periodic sweep detects and retries/fails jobs whose worker died without raising.
- **Archive Sweep** — a nightly job reclaims report artifacts (not scan/finding history) past a configurable retention window.

**Reporting & Dashboard**
- **Report Generation** — PDF (executive + technical), SARIF, CycloneDX SBOM, unified findings JSON, compliance report JSON, and CSV, generated asynchronously per scan.
- **Repository Management** — a persistent repository list, decoupled from any single scan, with per-repository scheduled-scan opt-in.
- **Risk Trends** — portfolio-wide BRS trend charts and per-repository risk history.
- **Dashboard & Analytics** — a full React SPA (Repositories, Scan Queue, Risk Dashboard, Compliance Dashboard, Finding Explorer, Executive Summary) with dark/light theming.
- **Notifications** — Slack, email (SMTP), and generic HMAC-signed webhook notifications on scan completion/failure and stalled-worker detection.

**Platform**
- **Enterprise Authentication** — JWT access/refresh tokens, local email/password auth, OAuth2/OIDC and LDAP SSO (SAML scaffolded, pending an XML security toolkit), 5-role RBAC.
- **Observability** — Prometheus metrics, OpenTelemetry distributed tracing, structured JSON logging correlated with trace IDs, 3 pre-built Grafana dashboards, and Alertmanager rules.
- **OpenAPI Documentation** — a fully-tagged, described OpenAPI 3 schema, exportable via `scripts/generate_openapi.py`.

---

## Architecture

KAVACH is a distributed, queue-driven pipeline. A scan can enter the system from three places — a user submitting a URL/archive through the API, the React dashboard, or a verified GitHub push webhook — and all three converge on the same orchestration path.

```mermaid
flowchart TD
    A["Repository Providers<br/>(GitHub / GitLab / Bitbucket / direct upload)"] --> B["FastAPI Gateway<br/>(REST + WebSocket + Webhook intake)"]
    B --> C["Authentication<br/>(JWT · RBAC · OAuth2/OIDC · LDAP)"]
    C --> D["Scan Orchestrator<br/>(prepare → download/extract → dispatch)"]
    D --> E["Redis Queue<br/>(priority: critical / high / normal / low)"]
    E --> F["Distributed Workers<br/>(9 scanners fanned out in parallel)"]
    F --> G["Aggregation Layer<br/>(cross-tool dedup & correlation)"]
    G --> H["Business Logic<br/>(Banking Risk Score + Zero-Day prediction)"]
    H --> I["AI Layer<br/>(explanation · business impact · remediation)"]
    I --> J["Compliance Engine<br/>(RBI · PCI-DSS · SWIFT CSP mapping)"]
    J --> K["Report Generation<br/>(PDF · SARIF · SBOM · JSON · CSV)"]
    K --> L["Dashboard<br/>(React — Risk, Compliance, Findings, Executive)"]
    H --> M["Notifications<br/>(Slack · Email · Webhook)"]
    K --> N["Archive Sweep<br/>(nightly report-artifact reclamation)"]

    style A fill:#2a78d6,color:#fff
    style E fill:#e34948,color:#fff
    style H fill:#eda100,color:#000
    style I fill:#4a3aa7,color:#fff
    style J fill:#1baf7a,color:#fff
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
    Agg->>Agg: Banking Risk Score + Zero-Day prediction
    Agg->>AI: batch finding insight generation
    AI-->>Agg: explanation, business impact, remediation
    Agg->>Agg: compliance mapping (RBI/PCI-DSS/SWIFT)
    Agg->>DB: persist Findings + ScanResult, mark job completed
    Agg->>Queue: dispatch report generation (async)
    Agg->>Client: WebSocket progress + notification (Slack/Email/Webhook)

    Reports->>DB: render PDF/SARIF/SBOM/JSON/CSV, mark reports completed
    Client->>API: GET /reports/{id}/download/{type}
```

---

## Technology Stack

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
| Axios | 1.18 | HTTP client with JWT refresh interceptor |
| Framer Motion | 12.40 | Animation |
| Lucide React | 1.21 | Icons |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Runtime |
| FastAPI | 0.139 | API framework |
| Uvicorn | 0.51 | ASGI server |
| SQLAlchemy | 2.0 (async) | ORM |
| Alembic | 1.18 | Database migrations (9 revisions) |
| Pydantic | 2.13 | Schema validation |
| Celery | 5.6 | Distributed task queue |
| structlog | 26.1 | Structured JSON logging |
| python-jose | 3.5 | JWT signing/verification |
| passlib[bcrypt] | — | Password hashing |
| ldap3 | — | LDAP SSO bind/search |
| reportlab | 5.0 | PDF report generation |
| boto3 | 1.43 | S3/MinIO report storage |

### Database & Queue

| Technology | Version | Purpose |
|---|---|---|
| PostgreSQL | 16 | Primary datastore |
| asyncpg | 0.31 | Async Postgres driver |
| Redis | 7 | Celery broker/result backend, per-scanner live status |

### AI

| Provider | Mode | Notes |
|---|---|---|
| Anthropic Claude | Cloud | via plain REST (`httpx`), no SDK dependency |
| OpenAI | Cloud | GPT-4o-mini class models |
| Google Gemini | Cloud | Gemini 1.5 Flash class models |
| Ollama | Local/self-hosted | Llama 3, Mistral, Phi-3, Mixtral tags validated |
| vLLM | Local/self-hosted | OpenAI-compatible local inference server |

Provider order is resolved by `AI_MODE` (`hybrid` default — local first, cloud fallback; `cloud`; or `local`), with a semantic cache and rule-based template fallback so the platform degrades gracefully with no provider configured at all.

### Infrastructure

| Technology | Purpose |
|---|---|
| Docker / Docker Compose | Local multi-service stack (Postgres, Redis, API, 2 worker pools, beat, Flower, frontend) |
| Kubernetes (Helm chart) | Production deployment — 21 templates covering Deployments, StatefulSets, HPA, PDB, NetworkPolicy, Ingress, migration Job |
| Prometheus / Grafana | Metrics + 3 pre-built dashboards (API, Celery, Risk Trend) |
| OpenTelemetry | Distributed tracing (OTLP gRPC exporter) |
| Alertmanager | 7 alert rules (error rate, latency, backlog, scanner failures, disk, beat down) |
| Flower | Celery task/worker monitoring UI |

### Security

| Mechanism | Implementation |
|---|---|
| Authentication | JWT access + refresh tokens, local email/password |
| SSO | OAuth2/OIDC (generic, any standards-compliant IdP), LDAP (real bind+search) |
| RBAC | 5 roles — admin, auditor, developer, security_engineer, read_only |
| Rate limiting | Redis fixed-window limiter, per-IP |
| Webhook verification | HMAC-SHA256 (`X-Hub-Signature-256` inbound, `X-KAVACH-Signature` outbound) |
| Audit logging | Every auth event and mutating admin action logged to Postgres |

### Testing

| Tool | Purpose |
|---|---|
| pytest / pytest-asyncio | Test runner |
| `tests/test_brs_engine.py` | 29 pure-function unit tests for BRS scoring |
| `tests/integration/` | 9 integration tests against real Postgres/Redis/Celery — full pipeline, webhook intake, archive sweep |
| ESLint / TypeScript compiler | Frontend static analysis |

---

## Folder Structure

```text
kavach-uco/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── endpoints/        # scan.py, reports.py, repositories.py, risk_config.py, webhooks.py
│   │   │   └── router.py         # aggregates every v1 router
│   │   ├── auth/                 # router, sso_router, admin_router, dependencies, permissions, security, service
│   │   │   └── sso/              # oauth2_provider.py, ldap_provider.py, saml_provider.py
│   │   ├── core/                 # logging, metrics, telemetry, error_handlers, exceptions
│   │   ├── data/                 # compliance_rules/*.yaml, compliance_mappings.json
│   │   ├── db/                   # async engine/session, base, mixins
│   │   ├── integrations/         # github/, gitlab/, bitbucket/ repo-download clients
│   │   ├── middleware/           # metrics, permission, rate_limit, request_context
│   │   ├── models/                # SQLAlchemy models (repository, scan_job, finding, scan_result, report, user, ...)
│   │   ├── orchestrator/         # Redis-backed per-scanner status store
│   │   ├── repositories/          # data-access layer per model
│   │   ├── schemas/               # Pydantic request/response DTOs
│   │   ├── services/
│   │   │   ├── aggregation/       # cross-tool dedup/correlation engine
│   │   │   ├── ai/                # gateway, providers/ (claude/openai/gemini/ollama/vllm), cache, templates
│   │   │   ├── audit/             # audit log writer
│   │   │   ├── compliance/        # compliance_engine, compliance_mapper, rule_loader
│   │   │   ├── notifications/     # slack, email, webhook providers + notification_service
│   │   │   ├── reports/           # report_generator, storage (local/S3)
│   │   │   ├── risk/              # brs_engine, zero_day_predictor
│   │   │   └── scanning/          # 9 scanner integrations + aggregator
│   │   ├── tasks/                 # Celery tasks: scan, scanner, aggregator, report, maintenance, scheduled_scan, archive
│   │   ├── workers/                # celery_app.py — queues, beat schedule
│   │   └── main.py                 # FastAPI app, middleware, lifespan
│   ├── alembic/versions/           # 9 migrations
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
│   │   │   ├── charts/             # BrsTrendChart, SeverityDistributionChart, ComplianceBarChart
│   │   │   ├── layout/             # AppShell, Sidebar, Topbar, ProtectedRoute, ThemeToggle
│   │   │   ├── scans/              # NewScanModal, ScanDetailPanel, FindingDetailModal
│   │   │   └── ui/                 # Button, Card, Badge, Table, Modal, StatTile, ...
│   │   ├── contexts/                # AuthContext, ThemeContext
│   │   ├── hooks/                   # useAuth, useTheme, useScanJobs, useFindings, useScanProgressSocket, ...
│   │   ├── lib/api/                  # axios client + per-resource API modules
│   │   ├── pages/                    # Repositories, ScanQueue, Risk, Compliance, FindingExplorer, Executive, Login
│   │   └── types/api.ts               # shared TypeScript contracts mirroring backend schemas
│   ├── Dockerfile
│   └── package.json
├── helm/kavach/
│   ├── templates/                    # 21 templates — Deployments, StatefulSets, HPA, PDB, NetworkPolicy, Ingress, ...
│   ├── dashboards/                    # Grafana dashboard JSON (API, Celery, Risk Trend)
│   └── values.yaml
├── k8s/                                # rendered manifest snapshots
└── README.md
```

---

## Installation

### Requirements

- Python 3.11+
- Node.js 20+
- PostgreSQL 16 (or use the provided Docker Compose service)
- Redis 7 (or use the provided Docker Compose service)
- Docker + Docker Compose (recommended for local development)

### Clone

```bash
git clone https://github.com/TROJAN1HAMMER/KAVACH.git
cd KAVACH
```

### Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # then edit .env — see Environment variables below
alembic upgrade head       # apply all 9 migrations
```

### Frontend setup

```bash
cd frontend
npm install
```

### Redis

Either run the Docker Compose service (below) or point `REDIS_URL` in `.env` at any Redis 7 instance.

### Database

Either run the Docker Compose `postgres` service, or provision your own PostgreSQL 16 instance and set `DATABASE_URL` accordingly before running `alembic upgrade head`.

### Docker

The fastest path to a fully working local stack — Postgres, Redis, API, both worker pools, beat, Flower, and the frontend — is Docker Compose:

```bash
cd backend
docker compose up --build
```

### Environment variables

All settings live in `backend/.env` (see `backend/.env.example` for the full, documented list). The essentials to change before running anything real:

```env
DATABASE_URL=postgresql+asyncpg://kavach:kavach_secret@localhost:5432/kavach_db
REDIS_URL=redis://localhost:6379/0

JWT_SECRET_KEY=change-me-jwt-32chars-minimum-in-production
APP_SECRET_KEY=change-me-in-production-32chars-min

# At least one AI provider, or KAVACH falls back to rule-based templates
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

## Running Locally

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

### Redis & Database

```bash
docker compose up postgres redis -d
```

### Frontend

```bash
cd frontend
npm run dev
```
Dashboard available at `http://localhost:5173`.

### Docker Compose (full stack)

```bash
cd backend
docker compose up --build
```
Brings up `postgres`, `redis`, `api` (`:8000`), `worker-critical`, `worker-default`, `beat`, `flower` (`:5555`), and `frontend` (`:5173`) together.

---

## API Documentation

Every route is versioned under `/api/v1` and (except the GitHub webhook, which is HMAC-verified instead) requires `Authorization: Bearer <access_token>`. The full, always-current schema is served live at `GET /docs` (Swagger UI) and `GET /redoc`, and can be exported to a static file with `python scripts/generate_openapi.py`.

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Create an account (always least-privileged `read_only`) |
| POST | `/api/v1/auth/login` | OAuth2 password flow — returns access + refresh tokens |
| POST | `/api/v1/auth/refresh` | Exchange a refresh token for a new access token |
| GET | `/api/v1/auth/me` | Current authenticated user |

**Example — login**
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=you@bank.example&password=YourPassword123"
```
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

### Scanning

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/scan` | Submit a repository as a `.zip` upload |
| POST | `/api/v1/scan/repository` | Submit a repository by URL |
| POST | `/api/v1/scan/premade/{risk_level}` | Run a bundled sandbox payload (`low`/`medium`/`high`) |
| GET | `/api/v1/scan` | List scan jobs (filterable by status) |
| GET | `/api/v1/scan/{scan_job_id}` | Get scan job status, progress, BRS/compliance summary |
| POST | `/api/v1/scan/{scan_job_id}/cancel` | Cancel a queued or running scan |
| WS | `/api/v1/scan/{scan_job_id}/ws` | Real-time per-scanner and job-level progress |
| GET | `/api/v1/scan/{scan_job_id}/findings` | All findings for a completed scan |
| GET | `/api/v1/scan/{scan_job_id}/compliance` | Live-recomputed compliance evaluation for a scan |
| GET | `/api/v1/scan/{scan_job_id}/findings/{finding_id}/explain/stream` | SSE-streamed AI explanation for one finding |

**Example — submit a repository by URL**
```bash
curl -X POST http://localhost:8000/api/v1/scan/repository \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/acme/payments-service", "priority": "high"}'
```
```json
{
  "scan_job_id": "3a5e2162-99ec-46f7-b134-a8b32aecc313",
  "repository_id": "260357c7-7d92-4505-8b95-44c689dfa8b9",
  "status": "queued",
  "priority": "high",
  "message": "Repository validated, scan job queued"
}
```

**Example — scan status response**
```json
{
  "scan_job_id": "3a5e2162-99ec-46f7-b134-a8b32aecc313",
  "repository_name": "payments-service",
  "status": "completed",
  "progress_percent": 100,
  "total_findings": 4,
  "brs_score": 89.31,
  "brs_risk_level": "Critical",
  "zero_day_risk_score": 10.5,
  "zero_day_risk_level": "Low",
  "summary": {
    "total": 4, "CRITICAL": 2, "HIGH": 1, "MEDIUM": 1, "LOW": 0, "INFO": 0,
    "by_category": { "hardcoded_secret": 2, "sql_injection": 1, "vulnerable_dependency": 1 }
  },
  "worker_status": {
    "semgrep": { "status": "completed", "findings_count": 2 },
    "joern": { "status": "failed", "error": "..." }
  }
}
```

### Webhooks

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/webhooks/github` | GitHub push-event receiver (HMAC-verified via `X-Hub-Signature-256`) |

### Reports

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/reports/{scan_job_id}` | Per-report-type generation status |
| GET | `/api/v1/reports/{scan_job_id}/download/{report_type}` | Download (or S3 redirect for) a generated report |

### Repositories

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/repositories` | List known repositories |
| PATCH | `/api/v1/repositories/{repository_id}/scheduled-scan` | Enable/disable nightly rescans |

### Risk Configuration

| Method | Path | Description |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/v1/risk/modules` | Manage business-module criticality/asset-value config |
| GET/PATCH | `/api/v1/risk/factor-weights/{factor_name}` | Manage BRS factor weights |
| POST | `/api/v1/risk/preview` | Score a synthetic finding against current config |

---

## Banking Risk Score

The BRS is computed per finding, then rolled up into one scan-level score.

### Methodology

Each finding is scored as a **weighted average across 7 factors**, each normalized to 0–10:

| Factor | What it measures |
|---|---|
| `cvss` | The finding's own CVSS score, clamped 0–10 |
| `exploitability` | Whether the finding is a known-exploited pattern/CVE |
| `business_criticality` | The criticality weight of the business module the finding was found in (e.g. Payments > Reporting) |
| `internet_exposure` | Whether the affected module is internet-facing |
| `compliance_impact` | How many regulatory frameworks (RBI/PCI-DSS/SWIFT) the finding violates |
| `asset_value` | The configured asset value of the affected module |
| `historical_incidents` | Historical incident count recorded against that module |

```
blended = Σ(sub_score[factor] × weight[factor]) / Σ(weight[factor])
BRS     = min(blended × 10, 100)
```

Business-module classification (which module a finding belongs to) and all 7 factor weights are **configurable per deployment** — stored in Postgres (`BusinessModule`, `RiskFactorWeight`) and editable live via `/api/v1/risk/modules` and `/api/v1/risk/factor-weights`, not hardcoded constants. A weighted **average** is used deliberately rather than a product: multiplying normalized terms collapses toward zero unless every factor is high, which doesn't match risk intuition — an actively-exploited RCE in the Payments module should be able to drive risk high on its own.

### Risk categories

| BRS range | Risk level |
|---|---|
| 0 – 34.9 | Low |
| 35.0 – 57.9 | Medium |
| 58.0 – 81.9 | High |
| 82.0 – 100 | Critical |

Thresholds are calibrated against this specific formula (not inherited CVSS-style cutoffs) — `business_criticality` and `asset_value` are flat per-module properties, so even a zero-CVSS finding in the most permissive module still blends to roughly 24.

### Zero-Day Risk Score

A separate, independent 0–100 predictive score estimating exposure to *undisclosed* vulnerabilities, summing six weighted factors: dependency count, known-CVE density, dependency staleness (average age), risky package categories, configuration risk, and code vulnerability density. This deliberately does not feed into BRS — a codebase can score well on known findings and still carry high latent risk from outdated, unaudited dependencies.

---

## AI Layer

KAVACH's AI layer (`app/services/ai/`) is a provider-agnostic gateway, not a hard dependency on any single vendor.

### Claude / multi-provider integration

`app/services/ai/gateway.py` resolves a provider order from a single `AI_MODE` setting:

- **`hybrid`** (default) — try local providers (Ollama/vLLM) first; fall back to cloud (Claude/OpenAI/Gemini) only if local is unreachable or unconfigured.
- **`cloud`** — only Claude/OpenAI/Gemini are ever attempted.
- **`local`** — only Ollama/vLLM are ever attempted, no cloud fallback even if cloud keys happen to be present.

Every provider (`app/services/ai/providers/`) is called over plain REST via `httpx` — no vendor SDK dependency. `AI_PROVIDER_PRIORITY` is an escape hatch to override the resolved order outright (e.g. `"vllm,ollama,claude"`).

### Caching

- **Semantic cache** (`semantic_cache.py`) — near-identical findings (same category/severity/pattern) reuse a previously generated explanation instead of re-querying the provider, with a configurable TTL (`AI_CACHE_TTL_SECONDS`, default 24h).
- **Request deduplication** (`request_lock.py`) — concurrent identical requests within a batch collapse to a single upstream call.

### Prompt optimization

- **Sanitization** (`sanitizer.py`) — strips sensitive data (secrets, PII-shaped strings) from a finding before it's sent to any cloud provider.
- **Chunking** (`chunking.py`) and **token estimation** (`token_estimator.py`) — keep batched explanation requests within provider context limits.
- **Template fallback** (`templates.py`) — a rule-based library of category-specific explanations, business impact, and remediation guidance used whenever no provider is configured or every provider fails — the platform never blocks scan completion on AI availability.

### Local LLM support

Local inference is **implemented today**, not a future item: `ollama_provider.py` and `vllm_provider.py` call a self-hosted Ollama or vLLM server exactly like a cloud provider, selected via `OLLAMA_MODEL`/`VLLM_MODEL` and `AI_MODE=local` or `hybrid`. Validated model tags include Llama 3, Mistral, Phi-3, and Mixtral (Ollama) and their HuggingFace-servable equivalents (vLLM).

---

## Compliance Engine

### Supported frameworks

- **RBI IT Framework 2021** (Reserve Bank of India)
- **PCI-DSS v4.0** (Payment Card Industry Data Security Standard)
- **SWIFT Customer Security Programme (CSP)**

Each framework's controls are defined declaratively in `app/data/compliance_rules/*.yaml`, loaded by `rule_loader.py` — adding or amending a control is a YAML change, not a code change.

### Deterministic mapping

`compliance_mapper.py` maps every finding to the specific clause(s) it violates per framework, purely from the finding's category/severity/CWE — no AI involved, no non-determinism. `compliance_engine.py` then evaluates, per scan, every control in every framework as PASS or FAIL based on whether any finding maps to it, producing a point-in-time compliance snapshot (`overall_compliance_percentage`, per-framework `passed_controls`/`failed_controls`, and per-control evidence linking back to the actual findings).

---

## Dashboard

The React SPA (`frontend/src/pages/`) is code-split per route and covers:

| Page | What it shows |
|---|---|
| **Repositories** | Every repository KAVACH has scanned, with a nightly-rescan toggle and a "scan again" action |
| **Scan Queue** | All scan jobs, filterable by status, with a live detail panel (WebSocket-driven per-scanner progress, cancel action, report downloads once complete) |
| **Risk Dashboard** | Portfolio-wide BRS trend line, top-risk repositories bar chart, and a recent-completed-scans table |
| **Compliance Dashboard** | Per-scan overall compliance percentage, a per-framework compliance bar chart, and a control-by-control PASS/FAIL table with linked evidence |
| **Finding Explorer** | Searchable/filterable finding list for a selected scan, with a detail modal (description, AI explanation/impact/remediation, compliance clauses) |
| **Executive Summary** | Portfolio-level KPIs — repository count, completed-scan count, average BRS, critical-finding count — plus an aggregated severity-distribution chart and top-risk-repository list |
| **Login** | Email/password authentication |

Charts (BRS trend, severity distribution, compliance-by-framework) are built on Recharts against a validated, colorblind-safe categorical/status palette, with light/dark variants and real tooltips.

---

## Reports

Every completed scan generates 7 report artifacts asynchronously (`app/services/reports/report_generator.py`, dispatched via `app/tasks/report_tasks.py`) — generation never blocks scan completion, and each report type is tracked and retried independently.

| Format | Contents |
|---|---|
| **PDF (executive)** | Business-facing summary — BRS, risk level, compliance status, top findings |
| **PDF (technical)** | Full technical finding detail for engineering teams |
| **SARIF** | Static Analysis Results Interchange Format — for IDE/CI integration |
| **SBOM** | CycloneDX Software Bill of Materials |
| **Unified findings JSON** | The full enriched, cross-tool-correlated finding set |
| **Compliance report (JSON)** | The point-in-time compliance snapshot |
| **CSV** | Flat finding export for spreadsheet triage |

Storage is backend-agnostic (`app/services/reports/storage.py`): `local` disk (default) or S3/MinIO, with presigned-URL downloads for the latter. A nightly archive sweep reclaims report *files* (not the underlying scan/finding/compliance database history) past a configurable retention window (`ARCHIVE_AFTER_DAYS`, default 90).

---

## Security

| Area | Implementation |
|---|---|
| **Authentication** | JWT access (short-lived) + refresh (long-lived) tokens; local email/password via bcrypt |
| **SSO** | Generic OAuth2/OIDC authorization-code flow (any standards-compliant IdP); LDAP via real search+bind; SAML routes exist but return 503 pending an XML-security toolkit dependency |
| **RBAC** | 5 fixed roles — `admin`, `auditor`, `developer`, `security_engineer`, `read_only` — enforced both via a coarse app-wide middleware (blocks any mutating request from strictly-read-only roles) and fine-grained per-route `require_permission(...)` dependencies |
| **Rate Limiting** | Redis-backed fixed-window limiter, keyed per client IP, fails open if Redis is unreachable rather than blocking the API |
| **Input Validation** | Pydantic schema validation on every request body; repository URL host allowlisting (GitHub/GitLab/Bitbucket only) |
| **Secrets** | Webhook payloads verified via HMAC-SHA256 (constant-time comparison); outbound notification webhooks HMAC-signed the same way; no secret ever logged |
| **Encryption** | TLS termination at the ingress/load balancer; JWT signed with HS256; passwords hashed with bcrypt |
| **Audit Logging** | Every login attempt (success/failure), role change, and admin action persisted to Postgres with actor, IP, and outcome |

---

## Deployment

### Docker

`backend/docker-compose.yml` defines the full local stack: `postgres`, `redis`, `api`, `worker-critical`, `worker-default`, `beat`, `flower`, and `frontend`. Scale worker capacity horizontally with `docker compose up --scale worker-default=10`.

### Kubernetes

A production-grade Helm chart lives at `helm/kavach/` — 21 templates covering:

- `Deployment`s for the API, both worker pools, beat, Flower, and the frontend
- `StatefulSet`s for Postgres and Redis (or point at externally-managed instances)
- `HorizontalPodAutoscaler` and `PodDisruptionBudget` for the API and default worker pool
- `NetworkPolicy` restricting database/broker access to the chart's own pods
- An `Ingress` routing `/api/*` to the API and `/` to the frontend
- A pre-install/upgrade `Job` running `alembic upgrade head` before any pod expecting the new schema rolls out
- Optional, disabled-by-default observability resources (`ServiceMonitor`, `PrometheusRule`, `AlertmanagerConfig`, a celery-exporter Deployment, and Grafana dashboard ConfigMaps) that assume a pre-existing kube-prometheus-stack

```bash
helm install kavach ./helm/kavach \
  --set secrets.jwtSecretKey=... \
  --set secrets.appSecretKey=... \
  --set secrets.githubWebhookSecret=...
```

### Environment Variables

The full, documented list lives in `backend/.env.example`. Every setting maps 1:1 to a Helm `values.yaml` key under `config:` (non-secret) or `secrets:` (sensitive) — see [Environment variables](#environment-variables) above for the essentials.

### Production considerations

- Set real, unique `JWT_SECRET_KEY` and `APP_SECRET_KEY` values — the defaults are placeholders and will fail obviously-insecure checks in review.
- Point `REPORT_STORAGE_BACKEND=s3` at a real bucket (or MinIO) in any multi-replica deployment — local-disk report storage assumes a single shared volume, which the Helm chart provides via a shared PVC, but S3 removes that constraint entirely.
- Configure `ALLOWED_ORIGINS` to the exact origin(s) your frontend is served from — CORS rejects everything else, including error responses (both are HMAC/credentialed and deliberately strict).
- Scale `worker-default` horizontally for throughput; `worker-critical` is intentionally a smaller, dedicated pool so a backlog of low-priority scans can never starve high-priority ones.
- Wire up the observability stack (`monitoring.*` values) once a kube-prometheus-stack is present in-cluster — it is off by default so the chart installs cleanly without one.

---

## Roadmap

**Implemented today** (see [Key Features](#key-features) for the full list): static/dependency/config/secret/container scanning, cross-tool aggregation, BRS + zero-day scoring, RBI/PCI-DSS/SWIFT compliance mapping, multi-provider AI (cloud + local), GitHub webhook intake, scheduled rescans, real-time WebSocket progress, 7 report formats, JWT/RBAC/OAuth2/LDAP auth, Prometheus/Grafana/OpenTelemetry observability, Docker Compose and Kubernetes/Helm deployment, and a 38-test suite (unit + real-infrastructure integration).

**Planned**
- Full SAML 2.0 assertion validation (currently scaffolded behind a 503 pending an `xmlsec`-backed toolkit dependency)
- GitLab and Bitbucket inbound webhook receivers (outbound download clients for both already exist; only the GitHub push receiver exists today)
- Pull-request-triggered scans (diff-scoped), in addition to the current push-triggered full scans
- Automatic S3 lifecycle-policy management for archived report objects (the archive sweep currently reclaims local files and S3 objects directly; bucket-level lifecycle rules are not yet templated)
- A manual, on-demand archive-sweep trigger endpoint for operators
- Expanded compliance framework coverage beyond RBI/PCI-DSS/SWIFT CSP (e.g. ISO 27001, SOC 2)

---

## Contributing

KAVACH follows standard GitHub contribution practices:

1. **Fork** the repository and create a feature branch from `main` (`git checkout -b feature/your-feature`).
2. **Write real tests** for any new behavior — unit tests for pure logic (see `tests/test_brs_engine.py`), integration tests against real infrastructure for anything DB/queue/API-facing (see `tests/integration/`). PRs that touch scanning, aggregation, risk scoring, or compliance mapping without a corresponding test will be asked for one.
3. **Match existing conventions** — structured logging via `structlog`, async SQLAlchemy sessions via the existing repository pattern, Pydantic schemas for every API boundary, and comments that explain *why*, not *what*.
4. **Run the full check before opening a PR**:
   ```bash
   # backend
   cd backend && pytest && alembic upgrade head
   # frontend
   cd frontend && npm run lint && npx tsc -b --noEmit && npm run build
   ```
5. **Open a pull request** with a clear description of the problem, the approach, and how it was verified. Include migration files for any schema change — never hand-edit an already-applied migration.
6. **Security-sensitive changes** (auth, RBAC, webhook verification, secret handling) should call that out explicitly in the PR description for closer review.

---

## License

Proprietary — All Rights Reserved. This repository does not currently carry an open-source license; all rights to the source code are reserved by the project maintainers. Contact the maintainers before redistributing, sublicensing, or using this code outside its intended engagement.
