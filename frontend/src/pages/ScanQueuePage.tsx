import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ListChecks, Plus } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonTable } from "../components/ui/Skeleton";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../components/ui/Table";
import { RevealSection, RevealItem } from "../components/landing/RevealSection";
import { cn, formatRelativeTime, formatScore } from "../lib/utils";
import { useScanJobs } from "../hooks/useScanJobs";
import { usePermissions } from "../hooks/usePermissions";
import { NewScanModal } from "../components/scans/NewScanModal";
import { ScanDetailPanel } from "../components/scans/ScanDetailPanel";
import type { ScanJobStatus } from "../types/api";

const STATUS_TONE: Record<ScanJobStatus, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  queued: "neutral",
  running: "primary",
  completed: "success",
  failed: "danger",
  cancelled: "warning",
};

const FILTERS: { label: string; value: ScanJobStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Queued", value: "queued" },
  { label: "Running", value: "running" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
  { label: "Cancelled", value: "cancelled" },
];

export default function ScanQueuePage() {
  const navigate = useNavigate();
  const { scanJobId: routeScanJobId } = useParams();
  const [searchParams] = useSearchParams();
  const repositoryFilter = searchParams.get("repository");

  const [statusFilter, setStatusFilter] = useState<ScanJobStatus | "all">("all");
  const [newScanOpen, setNewScanOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const canCreateScan = hasPermission("scan:create");

  const { data, isLoading } = useScanJobs(statusFilter === "all" ? {} : { status: statusFilter });

  const jobs = (data?.scan_jobs ?? []).filter((job) => !repositoryFilter || job.repository_id === repositoryFilter);

  // The route param is the source of truth when present (deep link to
  // /scans/:id); otherwise fall back to whatever row the user clicked —
  // no effect needed to keep the two in sync.
  const [clickedId, setClickedId] = useState<string | null>(null);
  const selectedId = routeScanJobId ?? clickedId;

  const closeDetail = () => {
    setClickedId(null);
    if (routeScanJobId) navigate("/scans", { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Scan Queue"
        description="Every scan job KAVACH has run, with live progress for anything still in flight."
        action={
          canCreateScan ? (
            <Button onClick={() => setNewScanOpen(true)}>
              <Plus className="size-4" />
              New scan
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              statusFilter === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} columns={6} />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-10" />}
          title="No scan jobs found"
          description="Start a new scan to see it appear here in real time."
          action={
            canCreateScan ? (
              <Button onClick={() => setNewScanOpen(true)}>
                <Plus className="size-4" />
                New scan
              </Button>
            ) : undefined
          }
        />
      ) : (
        <RevealSection>
          <RevealItem>
            <Card>
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Repository</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Progress</TableHeaderCell>
                    <TableHeaderCell>BRS score</TableHeaderCell>
                    <TableHeaderCell>Queued</TableHeaderCell>
                    <TableHeaderCell></TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.scan_job_id} clickable onClick={() => setClickedId(job.scan_job_id)}>
                      <TableCell className="font-medium">{job.repository_name}</TableCell>
                      <TableCell>
                        <Badge
                          tone={STATUS_TONE[job.status]}
                          className={cn("capitalize", job.status === "running" && "animate-pulse-slow")}
                        >
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-40">
                        {job.status === "running" || job.status === "queued" ? (
                          <div className="flex items-center gap-2">
                            <ProgressBar value={job.progress_percent} className="w-24" />
                            <span className="text-xs tabular-nums text-muted-foreground">{job.progress_percent}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatScore(job.brs_score)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatRelativeTime(job.queued_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setClickedId(job.scan_job_id)}>
                          View
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

      <Modal open={Boolean(selectedId)} onClose={closeDetail} title="Scan details" size="xl">
        {selectedId && <ScanDetailPanel scanJobId={selectedId} />}
      </Modal>

      <NewScanModal open={newScanOpen} onClose={() => setNewScanOpen(false)} />
    </div>
  );
}
