import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SEVERITY_ORDER, severityStyle } from "../../lib/severity";
import { useChartTheme } from "../../hooks/useChartTheme";
import { useChartEntryAnimation } from "../../hooks/useChartEntryAnimation";
import { ChartGradientDefs } from "./ChartGradientDefs";
import { useChartGradientIds } from "../../hooks/useChartGradientIds";
import { ChartTooltip, ChartTooltipRow } from "./ChartTooltip";
import { formatDateTime } from "../../lib/utils";
import type { Severity } from "../../types/api";

export interface FindingTrendPoint {
  finishedAt: string;
  repositoryName: string;
  counts: Partial<Record<Severity, number>>;
}

// Least severe at the bottom of the stack, most severe on top — the layer
// drawing the reader's eye sits at the top of the stack, not buried under it.
const STACK_ORDER = [...SEVERITY_ORDER].reverse();

type TrendDatum = { finishedAt: string; repositoryName: string; label: string } & Record<Severity, number>;

/** Stacked area of severity counts per completed scan over time — built
 *  from data every consumer of this chart already fetches (no backend
 *  change needed). */
export function FindingTrendsChart({ points, height = 280 }: { points: FindingTrendPoint[]; height?: number }) {
  const chartTheme = useChartTheme();
  const isAnimationActive = useChartEntryAnimation(700);
  const ids = useChartGradientIds();

  const data: TrendDatum[] = points.map((p) => {
    const severityCounts = SEVERITY_ORDER.reduce(
      (acc, severity) => {
        acc[severity] = p.counts[severity] ?? 0;
        return acc;
      },
      {} as Record<Severity, number>,
    );
    return {
      finishedAt: p.finishedAt,
      repositoryName: p.repositoryName,
      label: new Date(p.finishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      ...severityCounts,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <ChartGradientDefs ids={ids} mode={chartTheme.mode} />
        <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
        <XAxis dataKey="label" tick={{ fill: chartTheme.axisColor, fontSize: 12 }} tickLine={false} axisLine={{ stroke: chartTheme.gridColor }} />
        <YAxis allowDecimals={false} tick={{ fill: chartTheme.axisColor, fontSize: 12 }} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          cursor={{ stroke: chartTheme.gridColor, strokeWidth: 1 }}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as TrendDatum | undefined;
            if (!active || !point) return null;
            return (
              <ChartTooltip active={active} title={`${point.repositoryName} · ${formatDateTime(point.finishedAt)}`}>
                {SEVERITY_ORDER.map((severity) => {
                  const count = point[severity];
                  if (!count) return null;
                  return (
                    <ChartTooltipRow key={severity} colorHex={severityStyle(severity).hex} label={severityStyle(severity).label} value={count} />
                  );
                })}
              </ChartTooltip>
            );
          }}
        />
        {STACK_ORDER.map((severity) => (
          <Area
            key={severity}
            type="monotone"
            dataKey={severity}
            stackId="severity"
            stroke={severityStyle(severity).hex}
            strokeWidth={1.5}
            fill={`url(#${ids.severity(severity)})`}
            fillOpacity={0.85}
            isAnimationActive={isAnimationActive}
            animationDuration={700}
            animationEasing="ease-out"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
