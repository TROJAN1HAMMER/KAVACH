import { Modal } from "../ui/Modal";
import { SeverityBadge } from "../ui/Badge";
import { Badge } from "../ui/Badge";
import { formatScore, truncateMiddle } from "../../lib/utils";
import type { Finding } from "../../types/api";

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
        </div>
      )}
    </Modal>
  );
}
