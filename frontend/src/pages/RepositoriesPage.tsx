import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Database, ExternalLink, Plus, ScanLine } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonTable } from "../components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../components/ui/Table";
import { RevealSection, RevealItem } from "../components/landing/RevealSection";
import { useRepositories, useSetScheduledScan } from "../hooks/useRepositories";
import { usePermissions } from "../hooks/usePermissions";
import { NewScanModal } from "../components/scans/NewScanModal";
import type { Repository } from "../types/api";

const PROVIDER_LABEL: Record<Repository["provider"], string> = {
  github: "GitHub",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  upload: "Direct upload",
};

export default function RepositoriesPage() {
  const { data: repositories, isLoading, isError } = useRepositories();
  const setScheduledScan = useSetScheduledScan();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canCreateScan = hasPermission("scan:create");

  const [modalOpen, setModalOpen] = useState(false);
  const [rescanTarget, setRescanTarget] = useState<Repository | null>(null);

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
          <RevealItem>
            <Card>
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Repository</TableHeaderCell>
                    <TableHeaderCell>Provider</TableHeaderCell>
                    <TableHeaderCell>Default branch</TableHeaderCell>
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
