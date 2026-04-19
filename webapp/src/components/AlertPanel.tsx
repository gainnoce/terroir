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

function SectionLabel({ children, theme }: { children: React.ReactNode; theme: "dark" | "light" }) {
  return (
    <div className={`text-[10px] font-semibold uppercase tracking-widest mb-2.5 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
      {children}
    </div>
  );
}

export function AlertPanel({ alerts, satelliteStatus, connected, theme }: AlertPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#0d1117]" : "bg-slate-50";
  const border = isDark ? "border-[#1e2535]" : "border-slate-200";
  const muted = isDark ? "text-slate-500" : "text-slate-400";

  const trendData = alerts
    .slice(0, 5)
    .reverse()
    .map((a) => ({ timestamp: a.timestamp, ndvi: a.indices.ndvi, ndre: a.indices.ndre }));

  const activeCount = alerts.filter((a) => a.severity !== "HEALTHY").length;

  return (
    <div className={`h-full flex flex-col overflow-y-auto border-l ${bg} ${border}`}>
      {/* Panel header */}
      <div className={`flex-none flex items-center justify-between px-4 py-3 border-b ${border}`}>
        <span className={`text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
          Intelligence Feed
        </span>
        {activeCount > 0 ? (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f97316] shadow-[0_0_4px_#f97316]" />
            <span className={`text-[10px] font-mono ${isDark ? "text-orange-400" : "text-orange-500"}`}>
              {activeCount} alert{activeCount !== 1 ? "s" : ""}
            </span>
          </div>
        ) : (
          <span className={`text-[10px] font-mono ${muted}`}>All clear</span>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex flex-col gap-5 p-4 flex-1">

        {/* Active Incidents */}
        <section>
          <SectionLabel theme={theme}>Active Incidents</SectionLabel>
          {alerts.length === 0 ? (
            <div className={`text-xs text-center py-6 ${muted}`}>
              Scanning for anomalies...
            </div>
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
        </section>

        {/* Trend chart */}
        {trendData.length > 1 && (
          <section>
            <SectionLabel theme={theme}>Spectral Trend</SectionLabel>
            <TrendChart data={trendData} theme={theme} />
          </section>
        )}

        {/* Pass history */}
        <section>
          <SectionLabel theme={theme}>Pass History</SectionLabel>
          <PassHistory alerts={alerts} theme={theme} />
        </section>

        {/* Satellite status */}
        <section>
          <SectionLabel theme={theme}>Orbital Status</SectionLabel>
          <SatStatus status={satelliteStatus} connected={connected} theme={theme} />
        </section>

      </div>
    </div>
  );
}
