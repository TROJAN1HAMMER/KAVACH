import { memo, useMemo } from "react";
import { Activity, ClipboardCheck, Loader2, Workflow } from "lucide-react";
import { StatTile } from "../ui/StatTile";
import { useScanJobs } from "../../hooks/useScanJobs";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Top-line stats for the Overview page — "high-level KPIs and recent
 * activity" per the app's information architecture. Previously two of these
 * four tiles ("Explorable components"/"Parallel scanner engines") just
 * re-displayed the Architecture page's own static component-count trivia —
 * moved out in favor of real, live activity signal, since that's this
 * page's actual job and the Architecture page is the correct, sole home for
 * that data.
 */
export const StatHighlights = memo(function StatHighlights() {
  const { data } = useScanJobs({ limit: 100 });

  const { scansThisWeek, activeScans } = useMemo(() => {
    const jobs = data?.scan_jobs ?? [];
    const weekAgo = Date.now() - ONE_WEEK_MS;
    let thisWeek = 0;
    let active = 0;
    for (const job of jobs) {
      if (job.status === "queued" || job.status === "running") active += 1;
      const startedAt = job.queued_at ?? job.started_at;
      if (startedAt && new Date(startedAt).getTime() >= weekAgo) thisWeek += 1;
    }
    return { scansThisWeek: thisWeek, activeScans: active };
  }, [data]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile label="Scan pipeline stages" value={9} icon={<Workflow className="size-5" />} />
      <StatTile label="Scans this week" value={scansThisWeek} icon={<Activity className="size-5" />} />
      <StatTile label="Active scans now" value={activeScans} icon={<Loader2 className="size-5" />} />
      <StatTile label="Compliance frameworks" value={3} icon={<ClipboardCheck className="size-5" />} />
    </div>
  );
});
