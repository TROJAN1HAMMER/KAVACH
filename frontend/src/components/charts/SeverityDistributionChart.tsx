import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SEVERITY_ORDER, severityStyle } from "../../lib/severity";
import { useTheme } from "../../hooks/useTheme";
import { useChartEntryAnimation } from "../../hooks/useChartEntryAnimation";
import type { Severity } from "../../types/api";

interface SeverityDistributionChartProps {
  counts: Partial<Record<Severity, number>>;
  height?: number;
}

export function SeverityDistributionChart({ counts, height = 260 }: SeverityDistributionChartProps) {
  const { theme } = useTheme();
  const isAnimationActive = useChartEntryAnimation(700);
  const data = SEVERITY_ORDER.map((severity) => ({
    severity,
    label: severityStyle(severity).label,
    count: counts[severity] ?? 0,
  }));

  const gridColor = theme === "dark" ? "#2c2c2a" : "#e1e0d9";
  const axisColor = theme === "dark" ? "#c3c2b7" : "#52514e";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="0" />
        <XAxis
          dataKey="label"
          tick={{ fill: axisColor, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: gridColor }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: axisColor, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          cursor={{ fill: theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(11,11,11,0.03)" }}
          contentStyle={{
            background: theme === "dark" ? "#1a1a19" : "#fcfcfb",
            border: `1px solid ${gridColor}`,
            borderRadius: 8,
            fontSize: 12,
            color: theme === "dark" ? "#ffffff" : "#0b0b0b",
          }}
          formatter={(value) => [Number(value), "Findings"]}
        />
        <Bar
          dataKey="count"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
          isAnimationActive={isAnimationActive}
          animationDuration={700}
          animationEasing="ease-out"
        >
          {data.map((entry) => (
            <Cell key={entry.severity} fill={severityStyle(entry.severity).hex} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
