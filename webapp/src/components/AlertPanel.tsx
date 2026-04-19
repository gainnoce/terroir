"use client";
import { useState } from "react";
import type { Alert, SatelliteStatus } from "@/lib/types";
import { AlertCard } from "./AlertCard";
import { TrendChart } from "./TrendChart";
import { PassHistory } from "./PassHistory";
import { SatelliteStatus as SatStatus } from "./SatelliteStatus";

interface AlertPanelProps {
  alerts: Alert[];
  satelliteStatus: SatelliteStatus | null;
  connected: boolean;
  theme: "dark" | "light";
}

export function AlertPanel({ alerts, satelliteStatus, connected, theme }: AlertPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#0d1117]" : "bg-slate-50";
  const border = isDark ? "border-[#1e2535]" : "border-slate-200";
  const heading = isDark ? "text-slate-400" : "text-slate-500";

  const trendData = alerts
    .slice(0, 5)
    .reverse()
    .map((a) => ({ timestamp: a.timestamp, ndvi: a.indices.ndvi, ndre: a.indices.ndre }));

  return (
    <div className={`h-full flex flex-col gap-3 p-3 overflow-y-auto border-l ${bg} ${border}`}>
      {/* Top bar */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center text-sm" style={{ background: "#FF4500" }}>
            🌿
          </div>
          <span className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Terroir</span>
        </div>
        <span className={`text-[10px] font-mono ${heading}`}>
          {alerts.filter(a => a.severity !== "HEALTHY").length} active alerts
        </span>
      </div>

      {/* Alerts section */}
      <div>
        <div className={`text-[10px] uppercase tracking-wider mb-2 ${heading}`}>Active Incidents</div>
        {alerts.length === 0 ? (
          <div className={`text-xs ${heading} text-center py-4`}>Scanning for anomalies...</div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                theme={theme}
                isSelected={selectedId === alert.id || (selectedId === null && alert === alerts[0])}
                onClick={() => setSelectedId(alert.id === selectedId ? null : alert.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Trend chart */}
      {trendData.length > 1 && (
        <TrendChart data={trendData} theme={theme} />
      )}

      {/* Pass history */}
      <PassHistory alerts={alerts} theme={theme} />

      {/* Satellite status */}
      <SatStatus status={satelliteStatus} connected={connected} theme={theme} />
    </div>
  );
}
