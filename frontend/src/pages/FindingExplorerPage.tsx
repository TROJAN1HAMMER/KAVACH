import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SearchCode } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Input";
import { SeverityBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { FullPageSpinner } from "../components/ui/Spinner";
import { SkeletonTable } from "../components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../components/ui/Table";
import { RevealSection, RevealItem } from "../components/landing/RevealSection";
import { useScanJobs } from "../hooks/useScanJobs";
import { useFindings } from "../hooks/useFindings";
import { FindingDetailModal } from "../components/scans/FindingDetailModal";
import { SEVERITY_ORDER } from "../lib/severity";
import { cn, formatScore, truncateMiddle } from "../lib/utils";
import type { Finding, Severity } from "../types/api";

export default function FindingExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: scanJobsData, isLoading: loadingScans } = useScanJobs({ status: "completed", limit: 100 });

  const completedJobs = useMemo(
    () => (scanJobsData?.scan_jobs ?? []).sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? "")),
    [scanJobsData],
  );

  const selectedScanId = searchParams.get("scan") ?? completedJobs[0]?.scan_job_id ?? "";

  useEffect(() => {
    if (!searchParams.get("scan") && completedJobs[0]) {
      setSearchParams({ scan: completedJobs[0].scan_job_id }, { replace: true });
    }
  }, [completedJobs, searchParams, setSearchParams]);

  const { data: findingsData, isLoading: loadingFindings } = useFindings(selectedScanId || undefined);

  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  const filtered = useMemo(() => {
    const findings = findingsData?.findings ?? [];
    const q = query.trim().toLowerCase();
    return findings.filter((f) => {
      if (severityFilter !== "all" && f.severity !== severityFilter) return false;
      if (!q) return true;
      return (
        f.title.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.file_path?.toLowerCase().includes(q) ||
        f.cve?.toLowerCase().includes(q) ||
        f.package?.toLowerCase().includes(q)
      );
    });
  }, [findingsData, query, severityFilter]);

  if (loadingScans) return <FullPageSpinner />;

  if (completedJobs.length === 0) {
    return (
      <div>
        <PageHeader title="Finding Explorer" description="Search and filter findings across a scan." />
        <EmptyState icon={<SearchCode className="size-10" />} title="No completed scans yet" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Finding Explorer"
        description="Search, filter, and drill into findings for a selected scan."
        action={
          <Select className="w-64" value={selectedScanId} onChange={(e) => setSearchParams({ scan: e.target.value })}>
            {completedJobs.map((job) => (
              <option key={job.scan_job_id} value={job.scan_job_id}>
                {job.repository_name} — {new Date(job.finished_at ?? "").toLocaleDateString()}
              </option>
            ))}
          </Select>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title, category, file path, CVE, or package…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          className="sm:w-48"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as Severity | "all")}
        >
          <option value="all">All severities</option>
          {SEVERITY_ORDER.map((sev) => (
            <option key={sev} value={sev}>
              {sev}
            </option>
          ))}
        </Select>
      </div>

      {loadingFindings ? (
        <SkeletonTable rows={7} columns={6} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No findings match your filters" description="Try clearing the search or severity filter." />
      ) : (
        <RevealSection>
          <RevealItem>
            <Card>
              <div className="border-b border-border px-5 py-3 text-xs text-muted-foreground">
                Showing {filtered.length} of {findingsData?.total ?? 0} findings
              </div>
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Finding</TableHeaderCell>
                    <TableHeaderCell>Severity</TableHeaderCell>
                    <TableHeaderCell>Category</TableHeaderCell>
                    <TableHeaderCell>Location</TableHeaderCell>
                    <TableHeaderCell>CVSS</TableHeaderCell>
                    <TableHeaderCell>Source</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {filtered.map((finding) => (
                    <TableRow key={finding.id} clickable onClick={() => setSelectedFinding(finding)}>
                      <TableCell className={cn("max-w-sm font-medium")}>{finding.title}</TableCell>
                      <TableCell>
                        <SeverityBadge severity={finding.severity} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{finding.category}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {finding.file_path ? truncateMiddle(finding.file_path, 36) : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatScore(finding.cvss)}</TableCell>
                      <TableCell className="text-muted-foreground">{finding.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </RevealItem>
        </RevealSection>
      )}

      <FindingDetailModal finding={selectedFinding} onClose={() => setSelectedFinding(null)} />
    </div>
  );
}
