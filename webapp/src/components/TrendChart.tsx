"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface TrendPoint {
  timestamp: string;
  ndvi: number;
  ndre: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  theme: "dark" | "light";
}

export function TrendChart({ data, theme }: TrendChartProps) {
  const isDark = theme === "dark";
  const textColor = isDark ? "#8da8cc" : "#64748b";

  if (data.length === 0) {
    return <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>No passes recorded yet.</p>;
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <div className="w-full h-28">
      <p className={`text-xs mb-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        NDVI / NDRE trend (last {data.length} passes)
      </p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: textColor }} />
          <YAxis domain={[0, 1]} tick={{ fontSize: 9, fill: textColor }} />
          <Tooltip
            contentStyle={{ background: isDark ? "#12192a" : "#fff", border: `1px solid ${isDark ? "#1e2d45" : "#e2e8f0"}`, fontSize: 11 }}
          />
          <Line type="monotone" dataKey="ndvi" stroke="#22c55e" dot={false} strokeWidth={1.5} name="NDVI" />
          <Line type="monotone" dataKey="ndre" stroke="#4a9fff" dot={false} strokeWidth={1.5} name="NDRE" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
