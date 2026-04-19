"use client";
import { useEffect, useState } from "react";
import type { SatelliteStatus as Status } from "@/lib/types";

interface SatelliteStatusProps {
  status: Status | null;
  connected: boolean;
  theme: "dark" | "light";
}

export function SatelliteStatus({ status, connected, theme }: SatelliteStatusProps) {
  const [countdown, setCountdown] = useState(30);
  const isDark = theme === "dark";

  useEffect(() => {
    if (!status?.last_scan) return;
    const elapsed = Math.floor((Date.now() / 1000) - status.last_scan);
    setCountdown(Math.max(0, 30 - elapsed));
    const interval = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const bg = isDark ? "bg-[#0d1420] border-[#1a2840]" : "bg-white border-slate-200";
  const text = isDark ? "text-slate-300" : "text-slate-600";
  const muted = isDark ? "text-slate-500" : "text-slate-400";

  return (
    <div className={`rounded border p-3 text-xs ${bg}`}>
      <div className="flex justify-between items-center mb-2">
        <span className={`font-mono uppercase tracking-wider text-[10px] ${muted}`}>Satellite</span>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <span className={muted}>{connected ? "LIVE" : "OFFLINE"}</span>
        </div>
      </div>
      {status?.position ? (
        <div className={`font-mono ${text} space-y-0.5`}>
          <div>{status.position.lat.toFixed(3)}°N {status.position.lon.toFixed(3)}°E</div>
          <div className={muted}>Alt {status.position.alt_km.toFixed(0)} km</div>
          <div className="mt-1">
            Next scan: <span style={{ color: "#4a9fff" }}>{countdown}s</span>
          </div>
        </div>
      ) : (
        <span className={muted}>Waiting for position...</span>
      )}
    </div>
  );
}
