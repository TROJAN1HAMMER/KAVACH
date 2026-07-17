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
  zero_day_risk_score: number | null;
  zero_day_risk_level: string | null;
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
