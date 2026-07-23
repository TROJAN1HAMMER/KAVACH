import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { RadialGauge } from "../charts/RadialGauge";
import { ProgressBar } from "../ui/ProgressBar";
import { Badge } from "../ui/Badge";
import { useChartTheme } from "../../hooks/useChartTheme";
import { SEVERITY_ORDER, severityStyle } from "../../lib/severity";
import { cn } from "../../lib/utils";
import type { ExecutiveEvidenceSnapshot, Severity } from "../../types/api";

// Mirrors `SeverityBadge` (components/ui/Badge.tsx) exactly but appends a
// count — kept local rather than changing that shared primitive's props,
// since it's used unmodified in several other places in the app.
function SeverityCountBadge({ severity, count }: { severity: Severity; count: number }) {
  const style = severityStyle(severity);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        style.bg,
        style.text,
        style.ring,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {style.label}: {count}
    </span>
  );
}

function BrsTrendIndicator({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3.5" />
        Flat vs. last week
      </span>
    );
  }
  // Higher BRS is worse, so a rising score reads as the "bad" direction.
  const isRising = delta > 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", isRising ? "text-danger" : "text-success")}>
      {isRising ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {isRising ? "+" : ""}
      {delta.toFixed(1)} vs. last week
    </span>
  );
}

/** Replaces the old plain-`Badge`-only evidence summary with the same
 * chart/progress primitives already used on the Risk Dashboard/Scan Detail
 * pages, over the exact same `ExecutiveEvidenceSnapshot` fields — no new
 * data, just a richer presentation of data that was already being sent. */
export function EvidenceHighlights({ evidence }: { evidence: ExecutiveEvidenceSnapshot }) {
  const chartTheme = useChartTheme();

  if (evidence.total_completed_scans === 0) {
    return <p className="text-xs text-muted-foreground">No completed scans exist yet.</p>;
  }

  const severityEntries = SEVERITY_ORDER.filter((severity) => evidence.findings_by_severity[severity] != null);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Evidence used ({evidence.total_completed_scans} scans across {evidence.total_repositories} repositories)
      </p>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex shrink-0 flex-col items-center gap-1">
          <RadialGauge label="Portfolio avg BRS" value={evidence.portfolio_average_brs} mode={chartTheme.mode} size={136} />
          <BrsTrendIndicator
            current={evidence.week_over_week?.average_brs_this_week ?? null}
            previous={evidence.week_over_week?.average_brs_last_week ?? null}
          />
        </div>

        <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:flex-1 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Total findings</p>
            <p className="text-lg font-semibold tabular-nums">{evidence.total_findings}</p>
          </div>
          {evidence.week_over_week && (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Scans this week</p>
                <p className="text-lg font-semibold tabular-nums">{evidence.week_over_week.scans_this_week}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">vs. last week</p>
                <p className="text-lg font-semibold tabular-nums">{evidence.week_over_week.scans_last_week}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {severityEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {severityEntries.map((severity) => (
            <SeverityCountBadge key={severity} severity={severity} count={evidence.findings_by_severity[severity]} />
          ))}
        </div>
      )}

      {evidence.top_risk_repositories.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Top risk repositories</p>
          <div className="flex flex-wrap gap-1.5">
            {evidence.top_risk_repositories.map((repo) => (
              <Badge key={repo.repository_id} tone={repo.latest_brs_score >= 70 ? "danger" : "warning"}>
                {repo.repository_name}: {repo.latest_brs_score.toFixed(0)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {evidence.compliance_by_framework.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-medium text-muted-foreground">Compliance</p>
          {evidence.compliance_by_framework.map((framework) => {
            const total = framework.compliant_repo_count + framework.non_compliant_repo_count;
            const percent = total > 0 ? (framework.compliant_repo_count / total) * 100 : 0;
            return (
              <div key={framework.framework_key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{framework.framework_name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {framework.compliant_repo_count}/{total} compliant
                  </span>
                </div>
                <ProgressBar value={percent} tone={framework.non_compliant_repo_count > 0 ? "warning" : "success"} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
