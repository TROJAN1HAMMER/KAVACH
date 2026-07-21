// Mirrors backend Pydantic schemas (see backend/app/schemas/*.py). Keep field
// names/shapes in sync with the source of truth there, not the other way around.

export type UserRole = "admin" | "auditor" | "developer" | "security_engineer" | "read_only";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  auth_provider: string;
  // Server-computed presentation label + fully-resolved permission set for
  // this user's role (app/auth/permissions.py's ROLE_PERMISSIONS) — treat
  // `permissions` as the source of truth for any "can this role do X" check
  // rather than hardcoding the matrix here.
  role_display_name: string;
  permissions: string[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type RepoProviderType = "github" | "gitlab" | "bitbucket" | "upload";

export interface Repository {
  id: string;
  name: string;
  url: string | null;
  provider: RepoProviderType;
  default_branch: string | null;
  scheduled_scan_enabled: boolean;
}

export type ScanJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type ScanJobPriority = "low" | "normal" | "high";

export interface ScannerStatus {
  status: string; // queued | running | completed | failed | cancelled
  updated_at: number;
  task_id?: string | null;
  error?: string | null;
  findings_count?: number | null;
}

export interface ScanJobStatusResponse {
  scan_job_id: string;
  repository_id: string;
  repository_name: string;
  status: ScanJobStatus;
  priority: ScanJobPriority;

  progress_percent: number;
  current_stage: string | null;

  retry_count: number;
  max_retries: number;
  timeout_seconds: number;

  queued_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  last_heartbeat_at: string | null;
  archived_at: string | null;
  error_message: string | null;

  total_findings: number | null;
  brs_score: number | null;
  brs_risk_level: string | null;
  attack_surface_exposure_score: number | null;
  attack_surface_exposure_level: string | null;
  // Heterogeneous, not a flat severity-count map: alongside the five
  // per-severity integer counts and `total`, it also carries
  // `by_category`/`by_source` (dict of counts), `scanner_status` (dict of
  // strings), and `aggregation` (a nested object) — see
  // lib/severity.ts's `extractSeverityCounts` for the safe way to read
  // just the severity breakdown back out of this.
  summary: Record<string, unknown> | null;

  worker_status: Record<string, ScannerStatus>;
}

export interface ScanJobListResponse {
  total: number;
  scan_jobs: ScanJobStatusResponse[];
}

export interface ScanJobCreateResponse {
  scan_job_id: string;
  repository_id: string;
  status: ScanJobStatus;
  priority: ScanJobPriority;
  message: string;
}

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface ComplianceMapping {
  rbi_clause?: string | null;
  pci_clause?: string | null;
  swift_clause?: string | null;
}

export interface Finding {
  id: string;
  scan_job_id: string;
  title: string;
  severity: Severity;
  category: string;
  source: string;
  cvss: number | null;
  brs: number | null;
  brs_risk_level: string | null;
  file_path: string | null;
  line_number: number | null;
  description: string;
  package: string | null;
  package_version: string | null;
  cve: string | null;
  ai_explanation: string | null;
  ai_business_impact: string | null;
  ai_remediation: string | null;
  compliance: ComplianceMapping | null;
  sources: string[] | null;
  occurrence_count: number;
  cwe_id: string | null;
  cwe_name: string | null;
  owasp_category: string | null;
  owasp_name: string | null;
  mitre_technique_ids: string[] | null;
}

export interface FindingsListResponse {
  scan_job_id: string;
  total: number;
  findings: Finding[];
}

export interface ComplianceEvidence {
  finding_id: string;
  title: string;
  severity: Severity;
}

export interface ComplianceControlResult {
  requirement_id: string;
  title: string;
  description: string;
  status: "PASS" | "FAIL";
  recommendation: string;
  evidence: ComplianceEvidence[];
}

export interface FrameworkComplianceReport {
  framework_name: string;
  short_code: string;
  version: string;
  total_controls: number;
  passed_controls: number;
  failed_controls: number;
  compliance_percentage: number;
  controls: ComplianceControlResult[];
}

export interface ComplianceEngineResult {
  scan_job_id: string;
  overall_compliance_percentage: number;
  frameworks: FrameworkComplianceReport[];
}

export type ReportType =
  | "pdf"
  | "pdf_technical"
  | "sarif"
  | "sbom"
  | "unified_findings"
  | "compliance_report"
  | "csv";

export interface ReportStatusDetail {
  report_type: ReportType;
  status: string;
  error_message?: string | null;
}

export interface ReportPathsResponse {
  scan_job_id: string;
  pdf_available: boolean;
  pdf_technical_available: boolean;
  sarif_available: boolean;
  sbom_available: boolean;
  unified_findings_available: boolean;
  compliance_report_available: boolean;
  csv_available: boolean;
  reports: ReportStatusDetail[];
}

// WebSocket push events — see backend/app/api/v1/endpoints/scan.py's
// scan_progress_ws and app/orchestrator/scan_status.py's publish_update.
export interface WsWorkerStatusEvent {
  type: "worker_status";
  scanner: string;
  status: string;
  updated_at: number;
  task_id?: string | null;
  error?: string | null;
  findings_count?: number | null;
}

export interface WsJobStatusEvent {
  type: "job_status";
  status: ScanJobStatus;
  progress_percent: number;
  current_stage: string | null;
}

export interface WsPingEvent {
  type: "ping";
}

// The server also sends a full ScanJobStatusResponse (no "type" field) as
// the initial snapshot and once more right before closing on a terminal state.
export type ScanProgressEvent =
  | WsWorkerStatusEvent
  | WsJobStatusEvent
  | WsPingEvent
  | ScanJobStatusResponse;

// Mirrors backend app/schemas/analytics.py.
export interface RecentScanSummary {
  scan_job_id: string;
  repository_name: string;
  status: string;
  brs_score: number | null;
  brs_risk_level: string | null;
  finished_at: string | null;
}

export interface MyActivitySummary {
  total_scans: number;
  scans_by_status: Record<string, number>;
  total_findings: number;
  findings_by_severity: Record<string, number>;
  average_scan_duration_seconds: number | null;
  average_brs_score: number | null;
  recent_scans: RecentScanSummary[];
}

export interface TeamMemberActivity {
  user_id: string;
  email: string;
  full_name: string | null;
  total_scans: number;
  total_findings: number;
  average_brs_score: number | null;
}

export interface TeamActivitySummary {
  total_scans: number;
  total_findings: number;
  members: TeamMemberActivity[];
}

// Mirrors backend app/auth/schemas.py.
export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  status: string;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogListResponse {
  total: number;
  limit: number;
  offset: number;
  entries: AuditLogEntry[];
}

// Mirrors backend app/schemas/knowledge.py.
export type KnowledgeDocumentType = "pdf" | "markdown" | "text";
export type KnowledgeDocumentStatus = "pending" | "processing" | "indexed" | "failed";

export interface KnowledgeDocument {
  id: string;
  filename: string;
  document_type: KnowledgeDocumentType;
  version: string;
  author: string | null;
  tags: string[];
  status: KnowledgeDocumentStatus;
  error_message: string | null;
  file_size_bytes: number;
  page_count: number | null;
  chunk_count: number;
  uploaded_by_email: string | null;
  created_at: string;
}

export interface KnowledgeDocumentListResponse {
  total: number;
  documents: KnowledgeDocument[];
}

export interface KnowledgeSearchResult {
  document_id: string;
  filename: string;
  chunk_id: string;
  content: string;
  similarity_score: number;
  page_number: number | null;
  heading: string | null;
  section_path: string | null;
}

export interface KnowledgeSearchResponse {
  query: string;
  took_ms: number;
  results: KnowledgeSearchResult[];
}

// Mirrors backend app/schemas/assistant.py + the SSE event payloads built
// by app/api/v1/endpoints/assistant.py (see lib/api/assistant.ts).
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantCitation {
  document_id: string;
  filename: string;
  page_number: number | null;
  section_path: string | null;
  heading: string | null;
  similarity_score: number;
  rerank_score: number;
  excerpt: string;
}

export interface AssistantRetrievalEvent {
  retrieved_count: number;
  confidence: number;
  citations: AssistantCitation[];
}

export interface AssistantInsufficientContextEvent {
  message: string;
  retrieved_count: number;
  confidence: number;
  latency_ms: number;
}

export interface AssistantDoneEvent {
  confidence: number;
  retrieved_count: number;
  latency_ms: number;
}

// Mirrors backend app/schemas/finding_intelligence.py.
export interface FindingIntelligenceCitation {
  document_id: string;
  filename: string;
  page_number: number | null;
  section_path: string | null;
  heading: string | null;
  similarity_score: number;
  rerank_score: number;
  excerpt: string;
}

// Mirrors backend app/schemas/executive_intelligence.py.
export interface RepositoryRiskEvidence {
  repository_id: string;
  repository_name: string;
  latest_brs_score: number;
  latest_brs_risk_level: string | null;
  latest_scan_finished_at: string | null;
}

export interface ComplianceFrameworkEvidence {
  framework_key: string;
  framework_name: string;
  compliant_repo_count: number;
  non_compliant_repo_count: number;
  total_violations: number;
}

export interface WeeklyTrendPoint {
  week_start: string;
  scan_count: number;
  average_brs: number | null;
  critical_high_findings: number;
}

export interface WeekOverWeekDelta {
  scans_this_week: number;
  scans_last_week: number;
  findings_this_week: number;
  findings_last_week: number;
  average_brs_this_week: number | null;
  average_brs_last_week: number | null;
}

export interface ExecutiveEvidenceSnapshot {
  generated_at: string;
  total_repositories: number;
  total_completed_scans: number;
  total_findings: number;
  findings_by_severity: Record<string, number>;
  portfolio_average_brs: number | null;
  top_risk_repositories: RepositoryRiskEvidence[];
  compliance_by_framework: ComplianceFrameworkEvidence[];
  weekly_trend: WeeklyTrendPoint[];
  week_over_week: WeekOverWeekDelta | null;
}

export interface ExecutiveCitation {
  document_id: string;
  filename: string;
  page_number: number | null;
  section_path: string | null;
  heading: string | null;
  similarity_score: number;
  excerpt: string;
}

export interface ExecutiveEvidenceEvent {
  evidence: ExecutiveEvidenceSnapshot;
  citations: ExecutiveCitation[];
  kb_confidence: number;
  kb_retrieved_count: number;
}

export interface ExecutiveInsufficientEvent {
  message: string;
  latency_ms: number;
}

export interface ExecutiveDoneEvent {
  latency_ms: number;
}

// Mirrors backend app/schemas/rag_operations.py.
export interface BenchmarkStage {
  stage: string;
  avg_duration_ms: number;
  detail: string | null;
}

export interface BenchmarkResult {
  ran_at: string;
  stages: BenchmarkStage[];
  total_duration_ms: number;
  documents_indexed: number;
  llm_configured: boolean;
}

export interface SearchAnalyticsRecentEntry {
  feature: string;
  query: string;
  result_count: number;
  top_score: number | null;
  latency_ms: number;
  created_at: string;
}

export interface SearchAnalyticsSummary {
  total_searches: number;
  average_latency_ms: number | null;
  average_result_count: number | null;
  zero_result_count: number;
  zero_result_rate: number | null;
  recent_searches: SearchAnalyticsRecentEntry[];
}

export interface FeedbackSummary {
  total_feedback: number;
  positive_count: number;
  negative_count: number;
  positive_rate: number | null;
}

export interface FindingIntelligence {
  finding_id: string;
  cwe_id: string | null;
  cwe_name: string | null;
  owasp_category: string | null;
  owasp_name: string | null;
  mitre_technique_ids: string[];
  pci_clause: string | null;
  rbi_clause: string | null;
  swift_clause: string | null;
  why_detected: string;
  plain_english_explanation: string | null;
  business_impact: string | null;
  technical_impact: string | null;
  recommended_remediation: string | null;
  verification_steps: string[];
  code_example: string | null;
  citations: FindingIntelligenceCitation[];
  confidence: number;
  retrieved_count: number;
  grounded: boolean;
  note: string | null;
  latency_ms: number;
}
