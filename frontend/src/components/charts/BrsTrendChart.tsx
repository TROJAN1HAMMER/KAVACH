import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "../../hooks/useTheme";
import { useChartEntryAnimation } from "../../hooks/useChartEntryAnimation";
import { formatDateTime } from "../../lib/utils";

export interface BrsTrendPoint {
  finishedAt: string;
  brsScore: number;
  repositoryName: string;
}

export function BrsTrendChart({ points, height = 280 }: { points: BrsTrendPoint[]; height?: number }) {
  const { theme } = useTheme();
  const isAnimationActive = useChartEntryAnimation(700);
  const gridColor = theme === "dark" ? "#2c2c2a" : "#e1e0d9";
  const axisColor = theme === "dark" ? "#c3c2b7" : "#52514e";
  const lineColor = theme === "dark" ? "#3987e5" : "#2a78d6";

  const data = points.map((p) => ({
    ...p,
    label: new Date(p.finishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={gridColor} />
        <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 12 }} tickLine={false} axisLine={{ stroke: gridColor }} />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: axisColor, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: theme === "dark" ? "#1a1a19" : "#fcfcfb",
            border: `1px solid ${gridColor}`,
            borderRadius: 8,
            fontSize: 12,
            color: theme === "dark" ? "#ffffff" : "#0b0b0b",
          }}
          labelFormatter={(_, payload) => (payload?.[0] ? formatDateTime(payload[0].payload.finishedAt) : "")}
          formatter={(value, _name, payload) => [Number(value).toFixed(1), payload.payload.repositoryName]}
        />
        <Line
          type="monotone"
          dataKey="brsScore"
          stroke={lineColor}
          strokeWidth={2}
          dot={{ r: 4, fill: lineColor, strokeWidth: 2, stroke: theme === "dark" ? "#1a1a19" : "#fcfcfb" }}
          activeDot={{ r: 5 }}
          isAnimationActive={isAnimationActive}
          animationDuration={700}
          animationEasing="ease-out"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
