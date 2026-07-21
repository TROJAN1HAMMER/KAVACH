import { Modal } from "../ui/Modal";
import { SeverityBadge } from "../ui/Badge";
import { Badge } from "../ui/Badge";
import { Spinner } from "../ui/Spinner";
import { CitationList } from "../knowledge/CitationItem";
import { useFindingIntelligence } from "../../hooks/useFindings";
import { formatScore, truncateMiddle } from "../../lib/utils";
import type { Finding } from "../../types/api";

function IntelligenceConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const tone = confidence >= 0.75 ? "success" : confidence >= 0.5 ? "warning" : "danger";
  return <Badge tone={tone}>{pct}% confidence</Badge>;
}

/**
 * RAG Milestone 3 — grounded, citation-backed finding explanation.
 * Deliberately separate from the existing ungrounded ai_explanation/
 * ai_business_impact/ai_remediation fields below (Milestone-0 behavior,
 * unchanged) rather than replacing them: this section is retrieval-backed
 * and cites its sources, that one is a quick heuristic/template-backed
 * summary computed at scan time — showing both lets a user tell which is
 * which instead of silently swapping one for the other.
 */
function FindingIntelligenceSection({ findingId }: { findingId: string }) {
  const { data, isLoading, isError } = useFindingIntelligence(findingId, true);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Retrieving knowledge base context and generating a grounded explanation…
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-muted-foreground">AI Intelligence is temporarily unavailable for this finding.</p>;
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Intelligence (RAG-grounded)</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <IntelligenceConfidenceBadge confidence={data.confidence} />
          <span>{data.retrieved_count} chunk(s) retrieved</span>
          <span>{data.latency_ms}ms</span>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this was flagged</p>
        <p className="mt-1 text-sm text-foreground">{data.why_detected}</p>
      </div>

      {(data.cwe_id || data.owasp_category || data.mitre_technique_ids.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {data.cwe_id && <Badge tone="neutral">{data.cwe_id}{data.cwe_name ? ` — ${data.cwe_name}` : ""}</Badge>}
          {data.owasp_category && (
            <Badge tone="neutral">OWASP {data.owasp_category}{data.owasp_name ? ` — ${data.owasp_name}` : ""}</Badge>
          )}
          {data.mitre_technique_ids.map((id) => (
            <Badge key={id} tone="neutral">
              MITRE {id}
            </Badge>
          ))}
        </div>
      )}

      {!data.grounded && data.note && (
        <p className="rounded-lg bg-warning/10 p-3 text-sm text-[#946a00] dark:text-warning">{data.note}</p>
      )}

      {data.grounded && (
        <>
          {data.plain_english_explanation && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plain English explanation</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{data.plain_english_explanation}</p>
            </div>
          )}
          {data.business_impact && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business impact</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{data.business_impact}</p>
            </div>
          )}
          {data.technical_impact && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Technical impact</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{data.technical_impact}</p>
            </div>
          )}
          {data.recommended_remediation && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended remediation</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{data.recommended_remediation}</p>
            </div>
          )}
          {data.verification_steps.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verification steps</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm text-foreground">
                {data.verification_steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
          )}
          {data.code_example && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Code example</p>
              <pre className="mt-1 overflow-x-auto rounded-lg bg-muted p-3 text-xs font-mono text-foreground">
                {data.code_example}
              </pre>
            </div>
          )}
        </>
      )}

      <CitationList citations={data.citations} title="References" />
    </div>
  );
}

export function FindingDetailModal({ finding, onClose }: { finding: Finding | null; onClose: () => void }) {
  return (
    <Modal open={Boolean(finding)} onClose={onClose} title={finding?.title} size="lg">
      {finding && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            <Badge tone="neutral">{finding.category}</Badge>
            <Badge tone="neutral">{finding.source}</Badge>
            {finding.cve && <Badge tone="danger">{finding.cve}</Badge>}
            {finding.cwe_id && <Badge tone="neutral">{finding.cwe_id}</Badge>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">CVSS</p>
              <p className="text-lg font-semibold tabular-nums">{formatScore(finding.cvss)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">BRS contribution</p>
              <p className="text-lg font-semibold tabular-nums">{formatScore(finding.brs)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Occurrences</p>
              <p className="text-lg font-semibold tabular-nums">{finding.occurrence_count}</p>
            </div>
          </div>

          {finding.file_path && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</p>
              <p className="mt-1 font-mono text-sm">
                {truncateMiddle(finding.file_path, 64)}
                {finding.line_number ? `:${finding.line_number}` : ""}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
            <p className="mt-1 text-sm text-foreground">{finding.description}</p>
          </div>

          {finding.ai_explanation && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI explanation</p>
              <p className="mt-1 text-sm text-foreground">{finding.ai_explanation}</p>
            </div>
          )}

          {finding.ai_business_impact && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business impact</p>
              <p className="mt-1 text-sm text-foreground">{finding.ai_business_impact}</p>
            </div>
          )}

          {finding.ai_remediation && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remediation</p>
              <p className="mt-1 text-sm text-foreground">{finding.ai_remediation}</p>
            </div>
          )}

          {finding.compliance && (finding.compliance.rbi_clause || finding.compliance.pci_clause || finding.compliance.swift_clause) && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Compliance mapping
              </p>
              <div className="flex flex-wrap gap-1.5">
                {finding.compliance.rbi_clause && <Badge tone="primary">RBI {finding.compliance.rbi_clause}</Badge>}
                {finding.compliance.pci_clause && <Badge tone="primary">PCI-DSS {finding.compliance.pci_clause}</Badge>}
                {finding.compliance.swift_clause && <Badge tone="primary">SWIFT {finding.compliance.swift_clause}</Badge>}
              </div>
            </div>
          )}

          <FindingIntelligenceSection findingId={finding.id} />
        </div>
      )}
    </Modal>
  );
}
