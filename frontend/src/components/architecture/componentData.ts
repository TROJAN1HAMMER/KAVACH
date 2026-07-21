import {
  Bell,
  Braces,
  Cpu,
  Database,
  FileText,
  FolderArchive,
  GitBranch,
  KeyRound,
  Layers,
  ListTree,
  type LucideIcon,
  Network,
  Radar,
  ScanSearch,
  Server,
  Sparkles,
  Webhook as WebhookIcon,
  BarChart3,
  ShieldAlert,
  ClipboardCheck,
} from "lucide-react";

/** Every individually-explorable node in the System Architecture diagram. */
export type ArchComponentId =
  | "git-provider"
  | "webhook"
  | "api-gateway"
  | "authentication"
  | "scan-orchestrator"
  | "redis-queue"
  | "celery-workers"
  | "semgrep"
  | "ast-grep"
  | "joern"
  | "dependency-analysis"
  | "secrets-detection"
  | "configuration-scanner"
  | "aggregation-layer"
  | "brs-engine"
  | "compliance-engine"
  | "ai-layer"
  | "report-generator"
  | "dashboard"
  | "storage"
  | "notifications";

/** Broad grouping used purely for color-coding / legend purposes. */
export type ArchCategory =
  | "source"
  | "gateway"
  | "queue"
  | "compute"
  | "scanner"
  | "intelligence"
  | "output"
  | "storage";

export interface ArchInteraction {
  id: ArchComponentId;
  note: string;
}

export interface ArchExample {
  label: string;
  language: string;
  code: string;
}

export interface ArchComponent {
  id: ArchComponentId;
  label: string;
  category: ArchCategory;
  icon: LucideIcon;
  /** One-line summary shown in the hover tooltip. */
  tagline: string;
  purpose: string;
  responsibilities: string[];
  input: string;
  output: string;
  technologies: string[];
  interactions: ArchInteraction[];
  example?: ArchExample;
  /** Concise, technically-credible note on latency/throughput characteristics. */
  performanceNotes?: string;
  /** Concise note on the security posture / hardening specific to this component. */
  securityNotes?: string;
  /** Concise note on how this component scales horizontally/vertically. */
  scalabilityNotes?: string;
}

export const CATEGORY_META: Record<
  ArchCategory,
  { label: string; text: string; ring: string; dot: string; glow: string }
> = {
  source: {
    label: "Source",
    text: "text-slate-600 dark:text-slate-300",
    ring: "ring-slate-500/25",
    dot: "bg-slate-500",
    glow: "shadow-slate-500/20",
  },
  gateway: {
    label: "Gateway & Auth",
    text: "text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/25",
    dot: "bg-sky-500",
    glow: "shadow-sky-500/20",
  },
  queue: {
    label: "Queue",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/25",
    dot: "bg-amber-500",
    glow: "shadow-amber-500/20",
  },
  compute: {
    label: "Orchestration",
    text: "text-indigo-600 dark:text-indigo-400",
    ring: "ring-indigo-500/25",
    dot: "bg-indigo-500",
    glow: "shadow-indigo-500/20",
  },
  scanner: {
    label: "Scanner",
    text: "text-orange-600 dark:text-orange-400",
    ring: "ring-orange-500/25",
    dot: "bg-orange-500",
    glow: "shadow-orange-500/20",
  },
  intelligence: {
    label: "Intelligence",
    text: "text-purple-600 dark:text-purple-400",
    ring: "ring-purple-500/25",
    dot: "bg-purple-500",
    glow: "shadow-purple-500/20",
  },
  output: {
    label: "Output",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/25",
    dot: "bg-emerald-500",
    glow: "shadow-emerald-500/20",
  },
  storage: {
    label: "Storage",
    text: "text-teal-600 dark:text-teal-400",
    ring: "ring-teal-500/25",
    dot: "bg-teal-500",
    glow: "shadow-teal-500/20",
  },
};

export const ARCH_COMPONENTS: ArchComponent[] = [
  {
    id: "git-provider",
    label: "Git Provider",
    category: "source",
    icon: GitBranch,
    tagline: "GitHub, GitLab or Bitbucket — where the source code you scan actually lives.",
    purpose:
      "The system of record for source code. KAVACH never stores a permanent copy of your code — it clones what it needs at scan time and discards it afterward.",
    responsibilities: [
      "Hosts the repository, branches, and commit history",
      "Fires a webhook event on push, PR, or merge",
      "Exposes a read-only deploy key / OAuth token KAVACH uses to clone",
    ],
    input: "Developer commits, pushes, and pull requests",
    output: "A webhook payload (repo URL, commit SHA, ref, actor) and a clonable Git ref",
    technologies: ["GitHub", "GitLab", "Bitbucket", "Git", "OAuth 2.0 / deploy keys"],
    interactions: [{ id: "webhook", note: "Emits push/PR events that trigger the pipeline" }],
    performanceNotes:
      "No KAVACH-side latency concern here — clone/fetch performance is bounded by the provider's API and repo size, mitigated by shallow clones scoped to the triggering ref.",
    securityNotes:
      "Deploy keys and OAuth tokens are scoped read-only and stored encrypted; KAVACH never requests write access to the repository.",
    scalabilityNotes:
      "Scales trivially since KAVACH imposes no load beyond normal clone/webhook traffic; large monorepos are handled via shallow, ref-scoped clones rather than full history pulls.",
  },
  {
    id: "webhook",
    label: "Webhook Receiver",
    category: "gateway",
    icon: WebhookIcon,
    tagline: "Catches push/PR events from the Git provider and hands them to the gateway.",
    purpose:
      "A thin ingress endpoint that validates inbound webhook signatures and translates provider-specific payloads (GitHub, GitLab, Bitbucket each shape events differently) into one normalized internal event.",
    responsibilities: [
      "Verifies HMAC webhook signatures against the stored repo secret",
      "Normalizes GitHub/GitLab/Bitbucket payload formats into one schema",
      "Debounces rapid pushes to the same branch",
      "Forwards the normalized event to the FastAPI Gateway",
    ],
    input: "Raw provider webhook JSON + signature header",
    output: "Normalized ScanTriggerEvent { repo_url, ref, commit_sha, provider, actor }",
    technologies: ["FastAPI", "HMAC-SHA256", "Pydantic"],
    interactions: [
      { id: "git-provider", note: "Receives push/PR/merge events" },
      { id: "api-gateway", note: "Forwards the normalized trigger event" },
    ],
    performanceNotes:
      "Signature verification and payload normalization complete in single-digit milliseconds; the debounce window absorbs rapid force-push storms without dropping the final event.",
    securityNotes:
      "HMAC signature verification with constant-time comparison prevents spoofed trigger events; malformed or unsigned payloads are rejected before touching business logic.",
    scalabilityNotes:
      "Stateless request handler that scales horizontally behind the gateway; debounce state is kept in Redis so any replica can process a given repo's events.",
    example: {
      label: "GitHub webhook signature check",
      language: "python",
      code: `def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)`,
    },
  },
  {
    id: "api-gateway",
    label: "FastAPI Gateway",
    category: "gateway",
    icon: Server,
    tagline: "The single HTTP entry point for every scan trigger, dashboard call, and report request.",
    purpose:
      "Front door to the entire platform. Every request — webhook-triggered scan, manual scan from the UI, or a dashboard data fetch — passes through this gateway for routing, validation, and rate limiting.",
    responsibilities: [
      "Exposes the versioned REST API (/api/v1/*) consumed by the frontend and webhooks",
      "Validates request payloads with Pydantic models",
      "Applies per-tenant rate limiting and request logging",
      "Delegates identity checks to the Authentication layer before touching business logic",
    ],
    input: "HTTP requests: webhook events, manual scan requests, dashboard queries",
    output: "Routed, validated calls into the Scan Orchestrator or read APIs; JSON responses",
    technologies: ["FastAPI", "Uvicorn", "Pydantic", "Starlette middleware"],
    interactions: [
      { id: "webhook", note: "Receives normalized trigger events" },
      { id: "authentication", note: "Delegates token/session validation on every request" },
      { id: "scan-orchestrator", note: "Hands off validated scan requests" },
      { id: "dashboard", note: "Serves the read APIs the dashboard renders" },
    ],
    performanceNotes:
      "Async Uvicorn workers keep p95 request latency in the low tens of milliseconds for routing/validation; heavier work is always delegated to the orchestrator rather than handled inline.",
    securityNotes:
      "Every request passes through the Authentication layer and per-tenant rate limiting before reaching business logic, and Pydantic-validated payloads reject unexpected fields by default.",
    scalabilityNotes:
      "Stateless and horizontally scalable behind a load balancer; rate limits and quotas are tracked centrally in Redis so scaling out workers doesn't fragment enforcement.",
    example: {
      label: "Trigger a scan",
      language: "http",
      code: `POST /api/v1/scan/repository HTTP/1.1
Host: api.kavach.internal
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "repository_url": "https://github.com/acme/core-banking",
  "ref": "refs/heads/main",
  "commit_sha": "a1b2c3d",
  "scanners": ["semgrep", "joern", "dependency-analysis"]
}`,
    },
  },
  {
    id: "authentication",
    label: "Authentication",
    category: "gateway",
    icon: KeyRound,
    tagline: "RBAC + SSO — verifies who is calling and what they're allowed to touch.",
    purpose:
      "Centralized identity and access control. Every gateway request is authorized here before it can reach orchestration, findings, or reporting — critical for a platform handling banking source code.",
    responsibilities: [
      "Validates JWT / session tokens on every gateway request",
      "Enforces role-based access control (admin, security-engineer, auditor, viewer)",
      "Brokers SSO login (SAML / OIDC) for enterprise identity providers",
      "Issues short-lived scoped tokens for CI/CD service accounts",
    ],
    input: "Bearer tokens, session cookies, or SSO assertions",
    output: "An authorized principal + role/scope set attached to the request context",
    technologies: ["JWT", "OAuth2 / OIDC", "SAML SSO", "RBAC policy engine"],
    interactions: [
      { id: "api-gateway", note: "Validates every inbound request before it proceeds" },
      { id: "scan-orchestrator", note: "Passes the authorized principal for audit logging" },
    ],
    performanceNotes:
      "JWT validation is a local signature check with no round-trip for most requests; SSO assertions are only exchanged at login time, keeping the hot path fast.",
    securityNotes:
      "Short-lived, scoped tokens limit blast radius if a CI/CD credential leaks; RBAC is enforced on every request rather than cached client-side, closing a common privilege-escalation gap.",
    scalabilityNotes:
      "Stateless token verification scales linearly with gateway replicas; SSO provider round-trips only occur at login, not on every authorized request.",
    example: {
      label: "Token validation dependency",
      language: "python",
      code: `async def require_role(*roles: str):
    def _check(token: str = Depends(oauth2_scheme)):
        claims = decode_jwt(token)
        if claims["role"] not in roles:
            raise HTTPException(403, "insufficient role")
        return claims
    return _check`,
    },
  },
  {
    id: "scan-orchestrator",
    label: "Scan Orchestrator",
    category: "compute",
    icon: Network,
    tagline: "Plans the scan: resolves scanners, checks quotas, and enqueues the job graph.",
    purpose:
      "The brain of a scan request. It decides which scanners apply, in what order, with what timeouts, and creates the durable ScanJob record that every downstream stage reports progress against.",
    responsibilities: [
      "Resolves which of the 9 scanners apply to the repo's language/stack mix",
      "Creates and persists the ScanJob + per-stage task records",
      "Enforces per-tenant concurrency quotas",
      "Publishes the task graph onto the Redis queue for workers to pick up",
    ],
    input: "An authorized scan request (repo URL, ref, requested scanners)",
    output: "A persisted ScanJob record and a set of Celery task messages on Redis",
    technologies: ["Python", "Celery canvas (chains/groups)", "PostgreSQL", "Redis"],
    interactions: [
      { id: "api-gateway", note: "Receives the validated scan request" },
      { id: "redis-queue", note: "Publishes the task graph for workers to consume" },
      { id: "storage", note: "Persists ScanJob metadata and status transitions" },
    ],
    performanceNotes:
      "Scanner resolution and ScanJob creation are lightweight metadata operations; the real work is deferred to the queue so the orchestrator itself never becomes a bottleneck.",
    securityNotes:
      "Per-tenant concurrency quotas prevent one tenant's burst of scans from starving others, and every ScanJob is tagged with the authorized principal for audit trails.",
    scalabilityNotes:
      "Runs as multiple stateless replicas since ScanJob state lives in PostgreSQL; the Celery canvas (chords/groups) lets scan graphs scale to any number of parallel scanner stages.",
    example: {
      label: "Building the task graph",
      language: "python",
      code: `job = ScanJob.create(repo_url=repo.url, ref=ref)
scanners = resolve_scanners(repo.detected_languages)

workflow = chord(
    group(run_scanner.s(job.id, name) for name in scanners),
    aggregate_findings.s(job.id),
)
workflow.apply_async(queue="scan-orchestration")`,
    },
  },
  {
    id: "redis-queue",
    label: "Redis Queue",
    category: "queue",
    icon: Layers,
    tagline: "Durable message broker decoupling the orchestrator from the worker fleet.",
    purpose:
      "Absorbs bursts of scan requests and lets the Celery worker fleet scale independently of the API. Also backs task result storage and inter-stage progress signals shown live on the dashboard.",
    responsibilities: [
      "Brokers Celery task messages between orchestrator and workers",
      "Stores transient task state/results for polling and progress bars",
      "Provides pub/sub channels for real-time scan-progress events",
      "Rate-limits per-queue throughput to protect downstream scanners",
    ],
    input: "Task messages (scanner jobs, aggregation jobs) from the orchestrator",
    output: "Delivered tasks to available workers; task-state updates back to the API",
    technologies: ["Redis 7", "Celery broker/result backend", "Redis Streams (pub/sub)"],
    interactions: [
      { id: "scan-orchestrator", note: "Receives the published task graph" },
      { id: "celery-workers", note: "Dispatches tasks to available worker processes" },
    ],
    performanceNotes:
      "In-memory broker keeps task dispatch latency in single-digit milliseconds even under heavy fan-out; pub/sub channels give near-real-time progress updates without polling the database.",
    securityNotes:
      "Deployed with AUTH and TLS in-transit, network-isolated from public ingress; task payloads carry only job/reference IDs, never source code or secrets.",
    scalabilityNotes:
      "Scales via Redis Cluster sharding or a managed HA replica set; per-queue throughput limits protect downstream scanners from being overwhelmed during traffic spikes.",
    example: {
      label: "Dispatching a scanner task",
      language: "python",
      code: `run_scanner.apply_async(
    args=[job_id, "semgrep"],
    queue="scanners.semgrep",
    priority=5,
    expires=900,  # seconds
)`,
    },
  },
  {
    id: "celery-workers",
    label: "Distributed Workers",
    category: "compute",
    icon: Cpu,
    tagline: "The horizontally-scaled fleet that actually runs each scanner in isolation.",
    purpose:
      "Stateless worker pool, scaled independently per scanner type, that pulls a repo checkout into an ephemeral sandbox and executes one scanner stage per task — the fan-out point where the 9-scanner pipeline runs in parallel.",
    responsibilities: [
      "Clones/checks out the target ref into an isolated, disposable sandbox",
      "Executes the assigned scanner binary/engine and captures raw output",
      "Streams progress + logs back over Redis pub/sub",
      "Uploads raw scanner artifacts to object storage, then reports completion",
    ],
    input: "A Celery task: { job_id, scanner_name, repo_ref }",
    output: "Raw per-scanner findings (JSON/SARIF-like) and log artifacts",
    technologies: ["Celery", "Kubernetes Jobs / Docker sandboxes", "Python", "Bash"],
    interactions: [
      { id: "redis-queue", note: "Pulls tasks and reports progress" },
      { id: "storage", note: "Persists cloned checkouts and raw scanner output" },
      { id: "semgrep", note: "Runs as one of the parallel scanner stages" },
      { id: "ast-grep", note: "Runs as one of the parallel scanner stages" },
      { id: "joern", note: "Runs as one of the parallel scanner stages" },
      { id: "dependency-analysis", note: "Runs as one of the parallel scanner stages" },
      { id: "secrets-detection", note: "Runs as one of the parallel scanner stages" },
      { id: "configuration-scanner", note: "Runs as one of the parallel scanner stages" },
      { id: "aggregation-layer", note: "Reports each stage's findings for aggregation" },
    ],
    performanceNotes:
      "Each scanner stage runs in an isolated, ephemeral sandbox sized to its workload (Joern's CPG build is far heavier than a Secrets scan), avoiding one slow scanner starving the others.",
    securityNotes:
      "Sandboxes are disposable and network-restricted, so a malicious payload in scanned code can't reach other tenants' data or the broader cluster; checkouts are purged after the job completes.",
    scalabilityNotes:
      "The core horizontal-scaling point — Kubernetes can scale each scanner's worker pool independently based on its queue depth, so a Joern backlog doesn't starve Semgrep capacity.",
  },
  {
    id: "semgrep",
    label: "Semgrep",
    category: "scanner",
    icon: ScanSearch,
    tagline: "Pattern-based static analysis for known vulnerable code idioms across languages.",
    purpose:
      "Fast, rule-driven SAST pass. Matches source code against a curated + custom ruleset (OWASP Top 10, banking-specific patterns) to catch known-bad idioms without building a full program model.",
    responsibilities: [
      "Runs a curated + custom Semgrep ruleset across the checked-out repo",
      "Tags each match with a rule ID, severity, and CWE mapping",
      "Emits findings in a normalized JSON schema for aggregation",
    ],
    input: "Repository checkout + ruleset bundle (OWASP, banking-specific, custom)",
    output: "List of findings: { rule_id, file, line, severity, cwe, snippet }",
    technologies: ["Semgrep OSS engine", "Custom YAML rulesets", "SARIF export"],
    performanceNotes:
      "Rule-based matching is the fastest stage in the pipeline — typically seconds per repo — since it doesn't build a full program model.",
    securityNotes:
      "Runs against an isolated, read-only checkout with no network access; custom rulesets are version-controlled and reviewed before deployment to avoid rule-injection risk.",
    scalabilityNotes:
      "Embarrassingly parallel across files, so it scales near-linearly with CPU cores allocated to the worker pod.",
    interactions: [
      { id: "celery-workers", note: "Invoked as a worker task per scan job" },
      { id: "aggregation-layer", note: "Sends normalized findings for merging" },
    ],
    example: {
      label: "Invoking the scanner",
      language: "bash",
      code: `semgrep scan --config=p/owasp-top-ten \\
  --config=./rules/banking-custom.yml \\
  --json --output=semgrep-results.json ./repo-checkout`,
    },
  },
  {
    id: "ast-grep",
    label: "AST-Grep",
    category: "scanner",
    icon: Braces,
    tagline: "Structural, syntax-tree-aware search for patterns regex and Semgrep rules miss.",
    purpose:
      "Complements Semgrep with structural AST matching — useful for catching refactor-resistant anti-patterns (e.g. unsafe SQL string building regardless of variable naming) where a purely textual rule would miss variants.",
    responsibilities: [
      "Parses source into per-language ASTs (tree-sitter based)",
      "Matches structural patterns rather than raw text/regex",
      "Flags anti-patterns like dynamic SQL construction or unsafe deserialization shapes",
    ],
    input: "Repository checkout",
    output: "Structural match findings: { pattern_id, file, ast_span, severity }",
    technologies: ["ast-grep (tree-sitter)", "YAML pattern rules"],
    performanceNotes:
      "Tree-sitter parsing is fast and incremental, keeping this stage close to Semgrep's runtime even on large codebases.",
    securityNotes:
      "Operates on the same isolated, read-only checkout as other scanners with no external network calls during analysis.",
    scalabilityNotes:
      "Parses files independently and in parallel, scaling similarly to Semgrep with available worker CPU.",
    interactions: [
      { id: "celery-workers", note: "Invoked as a worker task per scan job" },
      { id: "aggregation-layer", note: "Sends normalized findings for merging" },
    ],
    example: {
      label: "Structural rule",
      language: "yaml",
      code: `id: unsafe-sql-concat
language: python
rule:
  pattern: $CURSOR.execute($A + $B)
severity: error
message: Possible SQL injection via string concatenation`,
    },
  },
  {
    id: "joern",
    label: "Joern",
    category: "scanner",
    icon: Radar,
    tagline: "Code-property-graph engine for deep taint/dataflow analysis across function boundaries.",
    purpose:
      "The heavyweight analysis stage — builds a Code Property Graph (AST + control-flow + data-flow) so it can trace whether attacker-controlled input actually reaches a dangerous sink across function and file boundaries, not just within one line.",
    responsibilities: [
      "Builds a Code Property Graph (CPG) from the repository",
      "Runs taint-tracking queries from declared sources to sinks",
      "Surfaces cross-function/cross-file vulnerability chains SAST regex misses",
    ],
    input: "Repository checkout compiled/parsed into a CPG",
    output: "Taint-flow findings: { source, sink, path, severity, data_flow_trace[] }",
    technologies: ["Joern CPG engine", "Scala query DSL", "CPGQL"],
    performanceNotes:
      "The heaviest stage in the pipeline — CPG construction is memory- and CPU-intensive and can take minutes on large repos, so it runs with a longer timeout and dedicated resource limits.",
    securityNotes:
      "Runs in its own resource-isolated sandbox given its higher memory footprint, preventing a large/adversarial repo from impacting other concurrent scans on the same node.",
    scalabilityNotes:
      "Scales by giving the Joern worker pool larger memory-optimized nodes rather than just more replicas, since CPG construction is memory-bound, not just CPU-bound.",
    interactions: [
      { id: "celery-workers", note: "Invoked as a worker task per scan job (longer-running)" },
      { id: "aggregation-layer", note: "Sends normalized findings for merging" },
    ],
    example: {
      label: "CPGQL taint query",
      language: "scala",
      code: `importCode("./repo-checkout")
def sources = cpg.method.name("get_user_input").parameter
def sinks   = cpg.call.name("execute_query").argument
sources.reachableByFlows(sinks).p`,
    },
  },
  {
    id: "dependency-analysis",
    label: "Dependency Analysis",
    category: "scanner",
    icon: FolderArchive,
    tagline: "Resolves the dependency tree and flags known CVEs and license risk.",
    purpose:
      "Software composition analysis (SCA). Most real-world breaches trace back to a vulnerable third-party package, so this stage builds the full transitive dependency graph and checks it against vulnerability + license databases.",
    responsibilities: [
      "Parses manifests/lockfiles (package.json, requirements.txt, pom.xml, go.mod, ...)",
      "Resolves the full transitive dependency tree",
      "Cross-references each package version against CVE/advisory databases",
      "Flags copyleft or otherwise risky licenses for compliance review",
    ],
    input: "Manifest and lockfiles found in the repository checkout",
    output: "Findings: { package, version, cve_ids[], severity, fixed_version, license }",
    technologies: ["OSV database", "Syft/Grype-style resolvers", "SPDX license data"],
    performanceNotes:
      "Transitive dependency resolution is the main cost driver; results are cached per lockfile hash so unchanged dependency trees skip re-resolution on subsequent scans.",
    securityNotes:
      "Advisory data is pulled from vetted sources (OSV) on a scheduled sync rather than live per-scan, avoiding a live dependency on an external service during the scan's critical path.",
    scalabilityNotes:
      "Scales horizontally like the other scanners; the CVE/license database is a read replica shared across all workers to avoid a shared bottleneck.",
    interactions: [
      { id: "celery-workers", note: "Invoked as a worker task per scan job" },
      { id: "aggregation-layer", note: "Sends normalized findings for merging" },
      { id: "compliance-engine", note: "License findings feed compliance evidence" },
    ],
  },
  {
    id: "secrets-detection",
    label: "Secrets Detection",
    category: "scanner",
    icon: KeyRound,
    tagline: "Scans history and working tree for hardcoded credentials, keys, and tokens.",
    purpose:
      "Catches the single most common — and most damaging — mistake in banking codebases: a committed credential. Scans both the current tree and commit history so a rotated-but-still-committed secret is still caught.",
    responsibilities: [
      "Scans the working tree and full commit history for high-entropy strings",
      "Matches against provider-specific token signatures (AWS, GCP, Stripe, JWT, DB URIs)",
      "De-duplicates rotated/re-committed secrets across commits",
    ],
    input: "Repository checkout including full git history",
    output: "Findings: { file, commit, secret_type, entropy_score, redacted_match }",
    technologies: ["Entropy analysis", "Regex signature packs", "git log --all scanning"],
    performanceNotes:
      "Full commit-history scanning is the more expensive path; the working-tree pass is fast, so history scans are typically bounded to a configurable recent-commit window on very large repos.",
    securityNotes:
      "Matched secrets are redacted before storage — only an entropy score and truncated match are persisted, never the full credential value.",
    scalabilityNotes:
      "History scans parallelize by commit range across workers on very large repositories to keep wall-clock time bounded.",
    interactions: [
      { id: "celery-workers", note: "Invoked as a worker task per scan job" },
      { id: "aggregation-layer", note: "Sends normalized findings for merging" },
    ],
  },
  {
    id: "configuration-scanner",
    label: "Configuration Scanner",
    category: "scanner",
    icon: ListTree,
    tagline: "Audits IaC and runtime configuration for insecure defaults and drift.",
    purpose:
      "Checks infrastructure-as-code and app configuration (Dockerfiles, Kubernetes manifests, Terraform, CI YAML) against security baselines — misconfiguration is a top cause of cloud breaches, not just application bugs.",
    responsibilities: [
      "Parses Dockerfiles, Kubernetes manifests, Terraform, and CI config",
      "Checks against CIS benchmarks and internal hardening baselines",
      "Flags insecure defaults: open security groups, root containers, missing TLS",
    ],
    input: "IaC/config files discovered in the repository checkout",
    output: "Findings: { file, rule_id, category, severity, remediation }",
    technologies: ["CIS Benchmarks", "Checkov-style policy engine", "Rego/OPA policies"],
    performanceNotes:
      "Policy evaluation against Rego/OPA is lightweight per file; total time scales with the number of IaC/config files rather than repo size.",
    securityNotes:
      "Ships with CIS benchmark baselines maintained independently of customer input, so a compromised repo can't smuggle in a rule that silently disables a check.",
    scalabilityNotes:
      "Stateless and parallel across files like the other scanners; new benchmark rule packs can be added without redeploying the worker image.",
    interactions: [
      { id: "celery-workers", note: "Invoked as a worker task per scan job" },
      { id: "aggregation-layer", note: "Sends normalized findings for merging" },
    ],
  },
  {
    id: "aggregation-layer",
    label: "Aggregation Layer",
    category: "intelligence",
    icon: Layers,
    tagline: "Merges, de-duplicates, and normalizes findings from all 6 parallel scanners.",
    purpose:
      "The convergence point of the fan-out. Six scanners emit six different shapes of findings — this layer normalizes them into one schema, removes duplicate/overlapping findings, and correlates related findings (e.g. a Semgrep hit and a Joern taint path pointing at the same sink).",
    responsibilities: [
      "Normalizes every scanner's output into one canonical Finding schema",
      "De-duplicates overlapping findings reported by multiple scanners",
      "Correlates related findings across scanners into a single issue",
      "Persists the merged finding set before scoring begins",
    ],
    input: "Raw finding sets from Semgrep, AST-Grep, Joern, Dependency, Secrets, Config scanners",
    output: "A single de-duplicated, correlated Finding[] set for the scan job",
    technologies: ["Python", "Fingerprint-based dedup", "PostgreSQL"],
    performanceNotes:
      "Fingerprint-based de-duplication is O(n) per finding rather than pairwise comparison, so merge time scales linearly with total finding volume across the 6 scanners.",
    securityNotes:
      "The first point where cross-scanner findings are persisted together — access to the merged finding set is scoped by the same RBAC roles enforced at the gateway.",
    scalabilityNotes:
      "The natural convergence point of the fan-out; scales by partitioning aggregation work per scan job so multiple concurrent scans don't serialize against each other.",
    interactions: [
      { id: "celery-workers", note: "Receives raw findings from every scanner stage" },
      { id: "brs-engine", note: "Hands off the merged finding set for scoring" },
      { id: "storage", note: "Persists the canonical finding records" },
    ],
  },
  {
    id: "brs-engine",
    label: "Business Risk Score Engine",
    category: "intelligence",
    icon: ShieldAlert,
    tagline: "Turns raw findings into one weighted 0-100 Banking Risk Score.",
    purpose:
      "Translates a long list of technical findings into a single business-facing risk number executives and auditors can track over time — weighting by severity, exploitability, asset criticality, and exposure (internet-facing vs. internal).",
    responsibilities: [
      "Weights each finding by severity, CVSS/exploitability, and blast radius",
      "Adjusts for asset criticality (e.g. payment path vs. internal tool)",
      "Produces the 0-100 BRS score and a risk tier (Low/Medium/High/Critical)",
      "Tracks BRS trend over time per repository",
    ],
    input: "The de-duplicated Finding[] set plus repository criticality metadata",
    output: "{ brs_score, risk_level, contributing_factors[] } attached to the scan job",
    technologies: ["Weighted scoring model", "CVSS v3.1", "Python/NumPy"],
    performanceNotes:
      "A pure in-memory scoring computation over an already-aggregated finding set — sub-second even for scans with hundreds of findings.",
    securityNotes:
      "Scoring weights and asset-criticality inputs are configuration, not user-supplied, preventing a crafted repo from manipulating its own risk score.",
    scalabilityNotes:
      "Stateless and CPU-light; scales trivially alongside the aggregation layer with no additional infrastructure.",
    interactions: [
      { id: "aggregation-layer", note: "Consumes the merged, de-duplicated findings" },
      { id: "compliance-engine", note: "Runs alongside compliance mapping on the same finding set" },
      { id: "ai-layer", note: "Provides the score context the AI layer explains" },
    ],
    example: {
      label: "Simplified scoring formula",
      language: "python",
      code: `def compute_brs(findings, asset_criticality: float) -> float:
    weighted = sum(
        SEVERITY_WEIGHT[f.severity] * EXPLOITABILITY[f.cvss_vector]
        for f in findings
    )
    return min(100, weighted * asset_criticality / len(findings or [1]))`,
    },
  },
  {
    id: "compliance-engine",
    label: "Compliance Engine",
    category: "intelligence",
    icon: ClipboardCheck,
    tagline: "Maps findings onto RBI, PCI-DSS, and SWIFT CSP control requirements.",
    purpose:
      "Banking software answers to regulators, not just to a severity score. This engine maps every finding onto the specific regulatory control it violates, so a security report doubles as audit evidence.",
    responsibilities: [
      "Maintains control-to-finding-pattern mappings for RBI IT Framework, PCI-DSS v4, SWIFT CSP",
      "Marks each control PASS/FAIL with linked evidence findings",
      "Computes per-framework and overall compliance percentage",
    ],
    input: "The de-duplicated Finding[] set plus a framework-to-control rule table",
    output: "Per-framework control results: { requirement_id, status, evidence[] }",
    technologies: ["RBI IT Framework", "PCI-DSS v4", "SWIFT CSP", "Rule-mapping engine"],
    performanceNotes:
      "Control mapping is a lookup against a pre-built rule table, so evaluating hundreds of controls against a finding set is fast and runs alongside BRS scoring rather than blocking it.",
    securityNotes:
      "Control-to-finding mappings are curated and versioned per regulatory framework revision, so audit evidence stays traceable to a specific ruleset version.",
    scalabilityNotes:
      "Adding a new framework (e.g. a new RBI circular) is a data change to the mapping table, not a code or infrastructure change.",
    interactions: [
      { id: "aggregation-layer", note: "Consumes the merged, de-duplicated findings" },
      { id: "report-generator", note: "Supplies compliance sections for generated reports" },
    ],
  },
  {
    id: "ai-layer",
    label: "AI Explanation Layer",
    category: "intelligence",
    icon: Sparkles,
    tagline: "Generates plain-English remediation guidance for every finding and the overall score.",
    purpose:
      "Closes the gap between 'here are 400 findings' and 'here's what to actually do.' An LLM-backed layer explains root cause, business impact, and a concrete fix for each finding, plus a narrative summary of the overall BRS trend.",
    responsibilities: [
      "Generates a plain-English root-cause explanation per finding",
      "Suggests a concrete code-level remediation with a before/after snippet",
      "Writes an executive-readable narrative summary of the scan's risk posture",
      "Redacts sensitive snippets before they're sent to any external model",
    ],
    input: "Findings + BRS context + compliance results for the scan job",
    output: "Human-readable explanations, remediation snippets, and an executive summary",
    technologies: ["LLM inference API", "Prompt templates", "PII/secret redaction filter"],
    performanceNotes:
      "The slowest post-aggregation stage due to LLM inference latency; explanations are generated asynchronously and batched per scan so the dashboard isn't blocked waiting on them.",
    securityNotes:
      "A redaction filter strips secrets and sensitive snippets before any content leaves the platform boundary to an external model provider.",
    scalabilityNotes:
      "Scales by request concurrency/rate limits against the inference API; explanation generation for a large finding set is chunked and parallelized within those limits.",
    interactions: [
      { id: "brs-engine", note: "Reads the computed score to ground its narrative" },
      { id: "compliance-engine", note: "Reads control results to explain compliance gaps" },
      { id: "report-generator", note: "Supplies narrative and remediation content for reports" },
    ],
    example: {
      label: "Explanation request",
      language: "json",
      code: `{
  "finding_id": "f_9182",
  "rule": "sql-injection-string-concat",
  "context": "payments/ledger_query.py:142",
  "mode": "explain_and_remediate"
}`,
    },
  },
  {
    id: "report-generator",
    label: "Report Generator",
    category: "output",
    icon: FileText,
    tagline: "Assembles findings, BRS, compliance, and AI narrative into a shareable report.",
    purpose:
      "Produces the durable artifact stakeholders actually consume outside the dashboard — a PDF/HTML report combining the risk score, compliance status, prioritized findings, and AI-written narrative, suitable for auditors and executives.",
    responsibilities: [
      "Renders a templated report (executive summary, findings, compliance, remediation)",
      "Exports to PDF/HTML/CSV depending on audience",
      "Persists the generated report artifact to storage with a shareable link",
    ],
    input: "BRS results, compliance results, AI narrative, and the finding set",
    output: "A generated report artifact (PDF/HTML/CSV) plus a persisted download link",
    technologies: ["WeasyPrint / HTML-to-PDF", "Jinja2 templates", "Object storage"],
    performanceNotes:
      "HTML-to-PDF rendering is the main cost and is offloaded to a background task so report requests return immediately with a polling link.",
    securityNotes:
      "Generated reports get short-lived, signed download URLs rather than public links, and inherit the requesting user's RBAC scope.",
    scalabilityNotes:
      "Rendering is stateless and horizontally scalable; large reports are streamed to object storage rather than held fully in worker memory.",
    interactions: [
      { id: "brs-engine", note: "Pulls the final risk score into the report" },
      { id: "compliance-engine", note: "Pulls per-framework control results" },
      { id: "ai-layer", note: "Pulls narrative summary and remediation text" },
      { id: "storage", note: "Persists the rendered report artifact" },
      { id: "dashboard", note: "Surfaces the report as a downloadable link" },
    ],
    example: {
      label: "Request a report export",
      language: "http",
      code: `POST /api/v1/reports/generate HTTP/1.1
Authorization: Bearer <jwt>
Content-Type: application/json

{ "scan_job_id": "sj_7f1a", "format": "pdf" }`,
    },
  },
  {
    id: "dashboard",
    label: "Dashboard",
    category: "output",
    icon: BarChart3,
    tagline: "The React frontend where humans actually see risk, compliance, and findings.",
    purpose:
      "The primary human interface to everything the pipeline produced — live scan progress, BRS trends, compliance posture, and drill-into-finding detail, all read through the FastAPI Gateway's query APIs.",
    responsibilities: [
      "Renders live scan progress and historical BRS/compliance trends",
      "Lets engineers triage and drill into individual findings",
      "Surfaces generated reports and notification history",
      "Polls/subscribes to the gateway for near-real-time status updates",
    ],
    input: "Read APIs served by the FastAPI Gateway",
    output: "Rendered UI; user actions (re-scan, acknowledge finding, export report)",
    technologies: ["React 19", "Vite", "TypeScript", "Tailwind CSS"],
    performanceNotes:
      "Read paths are served from cached/aggregated views rather than recomputed from raw findings on every request, keeping page loads fast even for repos with large finding histories.",
    securityNotes:
      "Every render is gated by the same RBAC roles enforced server-side — the frontend never receives data the user's role isn't authorized to see.",
    scalabilityNotes:
      "A static-served SPA behind a CDN with all state fetched through the gateway's read APIs, so frontend scaling is decoupled entirely from backend load.",
    interactions: [
      { id: "api-gateway", note: "Fetches all dashboard data through the gateway" },
      { id: "report-generator", note: "Links to and previews generated reports" },
    ],
  },
  {
    id: "storage",
    label: "Storage",
    category: "storage",
    icon: Database,
    tagline: "Persistent layer for scan metadata, raw artifacts, and generated reports.",
    purpose:
      "The system's durable memory — split between a relational store for structured scan/finding/job records and object storage for bulkier artifacts (raw scanner logs, repo checkouts, rendered reports).",
    responsibilities: [
      "Persists ScanJob, Finding, BRS, and compliance records relationally",
      "Stores raw scanner logs and ephemeral checkout artifacts in object storage",
      "Stores rendered report files with signed, expiring download URLs",
      "Enforces retention policies (e.g. auto-purge raw checkouts after N days)",
    ],
    input: "Writes from the Scan Orchestrator, Workers, Aggregation Layer, and Report Generator",
    output: "Durable records and artifacts retrievable by job ID or report ID",
    technologies: ["PostgreSQL", "S3-compatible object storage", "Redis (hot cache)"],
    performanceNotes:
      "Hot metadata (ScanJob status, live progress) is cache-backed by Redis while bulkier artifacts go straight to object storage, keeping the relational store lean and fast for dashboard queries.",
    securityNotes:
      "Object storage artifacts are encrypted at rest with signed, expiring URLs for access; retention policies auto-purge raw checkouts to limit how long sensitive source code persists.",
    scalabilityNotes:
      "PostgreSQL scales via read replicas for dashboard queries while object storage scales independently and near-infinitely for artifacts, decoupling the two growth curves.",
    interactions: [
      { id: "scan-orchestrator", note: "Stores ScanJob metadata and status" },
      { id: "celery-workers", note: "Stores raw checkouts and scanner artifacts" },
      { id: "aggregation-layer", note: "Stores the canonical merged findings" },
      { id: "report-generator", note: "Stores rendered report artifacts" },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    category: "output",
    icon: Bell,
    tagline: "Pushes scan results and critical findings out to Slack, email, and webhooks.",
    purpose:
      "Closes the loop by proactively pushing results to where teams already work, instead of requiring someone to remember to check the dashboard — especially critical for a newly-discovered high-severity finding.",
    responsibilities: [
      "Sends scan-complete and BRS-threshold-breach alerts to configured channels",
      "Delivers Slack/Teams messages and transactional emails",
      "Fires outbound webhooks for downstream CI/CD or ticketing integrations",
      "Respects per-team notification preferences and quiet hours",
    ],
    input: "Scan-complete events, BRS threshold breaches, and new critical findings",
    output: "Slack/Teams messages, emails, and outbound webhook calls",
    technologies: ["Slack API", "SMTP", "Outbound webhooks", "Celery (async delivery)"],
    performanceNotes:
      "Delivery runs asynchronously via Celery so a slow Slack/SMTP endpoint never blocks the scan pipeline or the dashboard.",
    securityNotes:
      "Notification payloads are summary-level (score, repo, link) rather than full finding detail, limiting sensitive data exposure in third-party channels like Slack.",
    scalabilityNotes:
      "Delivery is queued and retried independently per channel, so a spike in critical findings doesn't overwhelm any single downstream integration.",
    interactions: [
      { id: "brs-engine", note: "Notified when a score crosses a critical threshold" },
      { id: "report-generator", note: "Notified when a report finishes rendering" },
    ],
    example: {
      label: "Slack alert payload",
      language: "json",
      code: `{
  "channel": "#sec-alerts",
  "text": "Critical BRS 92/100 on acme/core-banking (main)",
  "blocks": [{ "type": "section", "text": { "type": "mrkdwn",
    "text": "*acme/core-banking* just scored *92 (Critical)*. <https://kavach/app/risk|View details>" } }]
}`,
    },
  },
];

export function getComponent(id: ArchComponentId): ArchComponent {
  const found = ARCH_COMPONENTS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown architecture component: ${id}`);
  return found;
}

/** Ordered node ids for the main vertical trunk, before the scanner fan-out. */
export const MAIN_FLOW_BEFORE: ArchComponentId[] = [
  "git-provider",
  "webhook",
  "api-gateway",
  "authentication",
  "scan-orchestrator",
  "redis-queue",
  "celery-workers",
];

/** The 6 parallel scanner/analysis stages the workers fan out to. */
export const FAN_OUT: ArchComponentId[] = [
  "semgrep",
  "ast-grep",
  "joern",
  "dependency-analysis",
  "secrets-detection",
  "configuration-scanner",
];

/** Ordered node ids for the main vertical trunk, after aggregation. */
export const MAIN_FLOW_AFTER: ArchComponentId[] = [
  "aggregation-layer",
  "brs-engine",
  "compliance-engine",
  "ai-layer",
  "report-generator",
  "dashboard",
  "notifications",
];
