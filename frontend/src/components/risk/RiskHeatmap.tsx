import { SEVERITY_ORDER, severityStyle } from "../../lib/severity";
import type { Severity } from "../../types/api";

export interface RiskHeatmapRow {
  repositoryId: string;
  repositoryName: string;
  counts: Partial<Record<Severity, number>>;
}

/**
 * Repository x severity grid — a plain CSS-grid table, not a charting-
 * library heatmap, since the only visual language it needs is "more findings
 * = more saturated severity color," which a per-cell background opacity
 * already gives us. Intensity is scaled per-column (against that severity's
 * own max across the visible rows) rather than globally, so a repo with a
 * lot of LOW findings doesn't wash out every CRITICAL cell into looking
 * equally faint by comparison.
 */
export function RiskHeatmap({ rows }: { rows: RiskHeatmapRow[] }) {
  const columnMax: Partial<Record<Severity, number>> = {};
  for (const severity of SEVERITY_ORDER) {
    columnMax[severity] = Math.max(1, ...rows.map((row) => row.counts[severity] ?? 0));
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[480px] gap-1.5"
        style={{ gridTemplateColumns: `minmax(140px, 1fr) repeat(${SEVERITY_ORDER.length}, 88px)` }}
      >
        <div />
        {SEVERITY_ORDER.map((severity) => (
          <div key={severity} className="text-center text-xs font-medium text-muted-foreground">
            {severityStyle(severity).label}
          </div>
        ))}

        {rows.map((row) => (
          <div key={row.repositoryId} className="contents">
            <div className="flex items-center truncate text-sm font-medium text-foreground" title={row.repositoryName}>
              {row.repositoryName}
            </div>
            {SEVERITY_ORDER.map((severity) => {
              const count = row.counts[severity] ?? 0;
              const max = columnMax[severity] ?? 1;
              const intensity = count === 0 ? 0 : 0.15 + (count / max) * 0.65;
              return (
                <div
                  key={severity}
                  className="flex items-center justify-center rounded-md text-sm font-semibold tabular-nums"
                  style={{
                    backgroundColor: count === 0 ? "transparent" : `${severityStyle(severity).hex}${Math.round(intensity * 255).toString(16).padStart(2, "0")}`,
                    color: count === 0 ? "var(--color-muted-foreground)" : "var(--color-foreground)",
                    height: 36,
                  }}
                >
                  {count}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
