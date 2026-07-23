import { useState } from "react";
import { interpolateRgb } from "d3-interpolate";
import { SEVERITY_ORDER, severityStyle } from "../../lib/severity";
import { useChartTheme } from "../../hooks/useChartTheme";
import type { Severity } from "../../types/api";

export interface RiskHeatmapRow {
  repositoryId: string;
  repositoryName: string;
  counts: Partial<Record<Severity, number>>;
}

/**
 * Repository x severity grid — a plain CSS-grid table, not a charting-
 * library heatmap, since the only visual language it needs is "more findings
 * = more saturated severity color." Cell color blends the theme's card
 * surface toward the severity hue via `d3-interpolate`'s `interpolateRgb`
 * (a real RGB blend) rather than an alpha-suffixed hex string, so intensity
 * reads consistently across both themes. Intensity is scaled per-column
 * (against that severity's own max across the visible rows) rather than
 * globally, so a repo with a lot of LOW findings doesn't wash out every
 * CRITICAL cell into looking equally faint by comparison.
 */
export function RiskHeatmap({ rows }: { rows: RiskHeatmapRow[] }) {
  const chartTheme = useChartTheme();
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const columnMax: Partial<Record<Severity, number>> = {};
  for (const severity of SEVERITY_ORDER) {
    columnMax[severity] = Math.max(1, ...rows.map((row) => row.counts[severity] ?? 0));
  }

  const blendFor = (hex: string) => interpolateRgb(chartTheme.surface, hex);

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
              const intensity = count === 0 ? 0 : 0.15 + (count / max) * 0.85;
              const hex = severityStyle(severity).hex;
              const cellKey = `${row.repositoryId}-${severity}`;
              const isHovered = hoveredCell === cellKey;

              return (
                <div
                  key={severity}
                  className="group relative"
                  onMouseEnter={() => count > 0 && setHoveredCell(cellKey)}
                  onMouseLeave={() => setHoveredCell(null)}
                  onFocus={() => count > 0 && setHoveredCell(cellKey)}
                  onBlur={() => setHoveredCell(null)}
                  tabIndex={count > 0 ? 0 : undefined}
                >
                  <div
                    className="flex items-center justify-center rounded-md text-sm font-semibold tabular-nums transition-transform duration-200"
                    style={{
                      backgroundColor: count === 0 ? "transparent" : blendFor(hex)(intensity),
                      color: count === 0 ? "var(--color-muted-foreground)" : intensity > 0.55 ? "#ffffff" : "var(--color-foreground)",
                      height: 36,
                      transform: isHovered ? "scale(1.08)" : undefined,
                      boxShadow: isHovered ? `0 0 14px ${hex}80` : undefined,
                      position: "relative",
                      zIndex: isHovered ? 1 : undefined,
                    }}
                  >
                    {count}
                  </div>
                  {count > 0 && (
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card/95 px-2 py-1 text-xs text-foreground opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
                    >
                      {row.repositoryName} — {severityStyle(severity).label}: <span className="font-semibold">{count}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
