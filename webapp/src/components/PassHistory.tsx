"use client";
import type { Alert } from "@/lib/types";
import { SEV_COLORS } from "@/lib/constants";

interface PassHistoryProps {
  alerts: Alert[];
  theme: "dark" | "light";
}

export function PassHistory({ alerts, theme }: PassHistoryProps) {
  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#0d1420] border-[#1a2840]" : "bg-white border-slate-200";
  const row = isDark ? "border-[#1e2535] text-slate-400" : "border-slate-100 text-slate-500";

  return (
    <div className={`rounded border overflow-hidden ${bg}`}>
      <div className="max-h-32 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className={`px-3 py-2 text-xs ${row}`}>No passes yet</div>
        ) : alerts.map((a) => (
          <div key={a.id} className={`flex justify-between items-center px-3 py-1.5 border-t text-xs ${row}`}>
            <span className="font-mono">{new Date(a.timestamp).toLocaleTimeString()}</span>
            <span style={{ color: SEV_COLORS[a.severity] }} className="font-bold text-[10px]">{a.severity}</span>
            <span className="font-mono">{a.indices.ndvi.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
