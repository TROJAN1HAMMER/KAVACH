import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { AlertCircle, FileArchive, Link2, PlayCircle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input, Label, Select } from "../ui/Input";
import { cn } from "../../lib/utils";
import { useSubmitRepositoryScan, useUploadZipScan } from "../../hooks/useScanJobs";
import { scansApi } from "../../lib/api/scans";
import type { ScanJobPriority } from "../../types/api";

type Tab = "url" | "upload" | "sandbox";

export function NewScanModal({
  open,
  onClose,
  defaultRepoUrl,
}: {
  open: boolean;
  onClose: () => void;
  defaultRepoUrl?: string;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("url");
  const [repoUrl, setRepoUrl] = useState(defaultRepoUrl ?? "");
  const [ref, setRef] = useState("");
  const [priority, setPriority] = useState<ScanJobPriority>("normal");
  const [file, setFile] = useState<File | null>(null);
  const [riskLevel, setRiskLevel] = useState<"very_low" | "low" | "medium" | "high" | "critical">("medium");
  const [error, setError] = useState<string | null>(null);
  const [sandboxSubmitting, setSandboxSubmitting] = useState(false);

  const submitRepo = useSubmitRepositoryScan();
  const uploadZip = useUploadZipScan();

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const goToScan = (scanJobId: string) => {
    handleClose();
    navigate(`/scans/${scanJobId}`);
  };

  const handleSubmitUrl = async () => {
    setError(null);
    try {
      const result = await submitRepo.mutateAsync({ repo_url: repoUrl, ref: ref || undefined, priority });
      goToScan(result.scan_job_id);
    } catch (err) {
      setError(isAxiosError(err) && typeof err.response?.data?.detail === "string" ? err.response.data.detail : "Failed to submit scan");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setError(null);
    try {
      const result = await uploadZip.mutateAsync({ file, priority });
      goToScan(result.scan_job_id);
    } catch (err) {
      setError(isAxiosError(err) && typeof err.response?.data?.detail === "string" ? err.response.data.detail : "Failed to upload archive");
    }
  };

  const handleSandbox = async () => {
    setError(null);
    setSandboxSubmitting(true);
    try {
      const result = await scansApi.startPremade(riskLevel);
      goToScan(result.scan_job_id);
    } catch {
      setError("Failed to start sandbox scan");
    } finally {
      setSandboxSubmitting(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof Link2 }[] = [
    { id: "url", label: "From URL", icon: Link2 },
    { id: "upload", label: "Upload ZIP", icon: FileArchive },
    { id: "sandbox", label: "Sandbox demo", icon: PlayCircle },
  ];

  return (
    <Modal open={open} onClose={handleClose} title="Start a new scan" size="lg">
      <div className="mb-5 flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-danger/10 p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {tab === "url" && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="repo-url">Repository URL</Label>
            <Input
              id="repo-url"
              placeholder="https://github.com/org/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ref">Branch / tag / commit (optional)</Label>
              <Input id="ref" placeholder="main" value={ref} onChange={(e) => setRef(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" value={priority} onChange={(e) => setPriority(e.target.value as ScanJobPriority)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </Select>
            </div>
          </div>
          <Button
            className="w-full"
            onClick={handleSubmitUrl}
            isLoading={submitRepo.isPending}
            disabled={!repoUrl.trim()}
          >
            Start scan
          </Button>
        </div>
      )}

      {tab === "upload" && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="zip-file">Repository archive (.zip)</Label>
            <input
              id="zip-file"
              type="file"
              accept=".zip"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-accent-foreground"
            />
          </div>
          <div>
            <Label htmlFor="priority-upload">Priority</Label>
            <Select id="priority-upload" value={priority} onChange={(e) => setPriority(e.target.value as ScanJobPriority)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </Select>
          </div>
          <Button className="w-full" onClick={handleUpload} isLoading={uploadZip.isPending} disabled={!file}>
            Upload &amp; scan
          </Button>
        </div>
      )}

      {tab === "sandbox" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Run KAVACH against a bundled sample application at a chosen risk profile — useful for demos and testing
            new dashboards without a real repository.
          </p>
          <div>
            <Label htmlFor="risk-level">Risk profile</Label>
            <Select id="risk-level" value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as typeof riskLevel)}>
              <option value="very_low">Very low risk</option>
              <option value="low">Low risk</option>
              <option value="medium">Medium risk</option>
              <option value="high">High risk</option>
              <option value="critical">Critical risk</option>
            </Select>
          </div>
          <Button className="w-full" onClick={handleSandbox} isLoading={sandboxSubmitting}>
            Start sandbox scan
          </Button>
        </div>
      )}
    </Modal>
  );
}
