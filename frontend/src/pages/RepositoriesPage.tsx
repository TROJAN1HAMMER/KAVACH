import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Database, ExternalLink, Plus, ScanLine } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonTable } from "../components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../components/ui/Table";
import { RevealSection, RevealItem } from "../components/landing/RevealSection";
import { RepositoryActivityChart } from "../components/charts/RepositoryActivityChart";
import { useRepositories, useSetScheduledScan } from "../hooks/useRepositories";
import { useScanJobs } from "../hooks/useScanJobs";
import { usePermissions } from "../hooks/usePermissions";
import { NewScanModal } from "../components/scans/NewScanModal";
import { formatDateTime, formatScore } from "../lib/utils";
import type { Repository, ScanJobStatusResponse } from "../types/api";

function riskTone(riskLevel: string | null): "neutral" | "success" | "warning" | "danger" {
  switch (riskLevel?.toUpperCase()) {
    case "CRITICAL":
    case "HIGH":
      return "danger";
    case "MEDIUM":
      return "warning";
    case "LOW":
      return "success";
    default:
      return "neutral";
  }
}

const PROVIDER_LABEL: Record<Repository["provider"], string> = {
  github: "GitHub",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  upload: "Direct upload",
};

export default function RepositoriesPage() {
  const { data: repositories, isLoading, isError } = useRepositories();
  const setScheduledScan = useSetScheduledScan();
  // Repository-specific security posture — the latest completed scan per
  // repository, joined onto the repositories table below. Same hook/call
  // shape used by every other dashboard page, just a new call site.
  const { data: scanJobsData } = useScanJobs({ status: "completed", limit: 100 });
  const latestScanByRepo = useMemo(() => {
    const byRepo = new Map<string, ScanJobStatusResponse>();
    const sorted = [...(scanJobsData?.scan_jobs ?? [])].sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""));
    for (const job of sorted) {
      if (!byRepo.has(job.repository_id)) byRepo.set(job.repository_id, job);
    }
    return byRepo;
  }, [scanJobsData]);
  const repositoryActivity = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of scanJobsData?.scan_jobs ?? []) {
      counts.set(job.repository_name, (counts.get(job.repository_name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, scanCount]) => ({ name, scanCount }))
      .sort((a, b) => b.scanCount - a.scanCount)
      .slice(0, 8);
  }, [scanJobsData]);
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canCreateScan = hasPermission("scan:create");

  const [modalOpen, setModalOpen] = useState(false);
  const [rescanTarget, setRescanTarget] = useState<Repository | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Lets the command palette's "Start New Scan"/"Connect Repository" quick
  // actions deep-link straight into this page's existing modal instead of
  // just landing on the list. Adjusted during render (React's documented
  // alternative to an effect for "reset/react to a prop changing," same
  // pattern AppShell uses for `lastPathname`) rather than in a `useEffect`,
  // guarded by `autoOpenHandled` so it only ever fires once per visit even
  // though `searchParams` keeps the same identity across re-renders.
  const [autoOpenHandled, setAutoOpenHandled] = useState(false);
  if (!autoOpenHandled && searchParams.get("new-scan") === "1") {
    setAutoOpenHandled(true);
    if (canCreateScan) {
      setRescanTarget(null);
      setModalOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("new-scan");
    setSearchParams(next, { replace: true });
  }

  return (
    <div>
      <PageHeader
        title="Repositories"
        description="Every repository KAVACH has scanned, from a URL submission or a direct archive upload."
        action={
          canCreateScan ? (
            <Button onClick={() => { setRescanTarget(null); setModalOpen(true); }}>
              <Plus className="size-4" />
              New scan
            </Button>
          ) : undefined
        }
      />

      {isError && (
        <Card className="mb-4 border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          Failed to load repositories. Check your connection and try again.
        </Card>
      )}

      {isLoading ? (
        <SkeletonTable rows={6} columns={5} />
      ) : repositories && repositories.length === 0 ? (
        <EmptyState
          icon={<Database className="size-10" />}
          title="No repositories yet"
          description="Start your first scan by submitting a repository URL or uploading an archive."
          action={
            canCreateScan ? (
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="size-4" />
                New scan
              </Button>
            ) : undefined
          }
        />
      ) : (
        <RevealSection>
          {/* Always mounted alongside the table below (not conditionally
              added once `repositoryActivity` finishes loading) so it joins
              the same stagger group `RevealSection` observes on first
              paint — a `RevealItem` mounted later, after data resolves,
              would never receive that initial reveal transition and could
              stay stuck at its `hidden` (opacity: 0) variant. */}
          <RevealItem className="mb-4">
            {repositoryActivity.length > 0 && (
              <Card>
                <CardHeader title="Repository activity" description="Completed scans per repository." />
                <CardContent>
                  <RepositoryActivityChart repositories={repositoryActivity} />
                </CardContent>
              </Card>
            )}
          </RevealItem>
          <RevealItem>
            <Card>
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Repository</TableHeaderCell>
                    <TableHeaderCell>Provider</TableHeaderCell>
                    <TableHeaderCell>Default branch</TableHeaderCell>
                    <TableHeaderCell>Security posture</TableHeaderCell>
                    <TableHeaderCell>Nightly rescan</TableHeaderCell>
                    <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {repositories?.map((repo) => (
                    <TableRow key={repo.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          {repo.name}
                          {repo.url && (
                            <a
                              href={repo.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-muted-foreground hover:text-primary"
                              aria-label="Open repository"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge tone="neutral">{PROVIDER_LABEL[repo.provider]}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{repo.default_branch || "—"}</TableCell>
                      <TableCell>
                        {(() => {
                          const latestScan = latestScanByRepo.get(repo.id);
                          if (!latestScan) return <span className="text-xs text-muted-foreground">Not yet scanned</span>;
                          return (
                            <div className="flex items-center gap-2">
                              <Badge tone={riskTone(latestScan.brs_risk_level)}>{latestScan.brs_risk_level ?? "—"}</Badge>
                              <div className="text-xs text-muted-foreground">
                                <div className="tabular-nums text-foreground">BRS {formatScore(latestScan.brs_score)}</div>
                                <div>{formatDateTime(latestScan.finished_at)}</div>
                              </div>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-input accent-primary"
                            checked={repo.scheduled_scan_enabled}
                            disabled={!repo.url || setScheduledScan.isPending}
                            onChange={(e) =>
                              setScheduledScan.mutate({ repositoryId: repo.id, enabled: e.target.checked })
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            {repo.url ? "Enabled" : "Requires URL"}
                          </span>
                        </label>
                      </TableCell>
                      <TableCell className="text-right">
                        {canCreateScan && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRescanTarget(repo);
                              setModalOpen(true);
                            }}
                            disabled={!repo.url}
                          >
                            <ScanLine className="size-3.5" />
                            Scan again
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2"
                          onClick={() => navigate(`/scans?repository=${repo.id}`)}
                        >
                          View scans
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </RevealItem>
        </RevealSection>
      )}

      <NewScanModal open={modalOpen} onClose={() => setModalOpen(false)} defaultRepoUrl={rescanTarget?.url ?? undefined} />
    </div>
  );
}
