import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "../../hooks/useTheme";
import { useChartEntryAnimation } from "../../hooks/useChartEntryAnimation";
import { CATEGORICAL_PALETTE } from "../../lib/severity";

export interface ComplianceBarPoint {
  shortCode: string;
  frameworkName: string;
  compliancePercentage: number;
}

export function ComplianceBarChart({ points, height = 240 }: { points: ComplianceBarPoint[]; height?: number }) {
  const { theme } = useTheme();
  const isAnimationActive = useChartEntryAnimation(700);
  const gridColor = theme === "dark" ? "#2c2c2a" : "#e1e0d9";
  const axisColor = theme === "dark" ? "#c3c2b7" : "#52514e";
  const mode = theme === "dark" ? "dark" : "light";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={points} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={gridColor} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: axisColor, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: gridColor }}
          unit="%"
        />
        <YAxis
          type="category"
          dataKey="shortCode"
          tick={{ fill: axisColor, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={72}
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
          formatter={(value, _name, payload) => [`${Number(value).toFixed(0)}%`, payload.payload.frameworkName]}
        />
        <Bar
          dataKey="compliancePercentage"
          radius={[0, 4, 4, 0]}
          maxBarSize={24}
          isAnimationActive={isAnimationActive}
          animationDuration={700}
          animationEasing="ease-out"
        >
          {points.map((entry, index) => (
            <Cell key={entry.shortCode} fill={CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length][mode]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
