"use client";
import type { SatelliteStatus } from "@/lib/types";

interface HeaderProps {
  connected: boolean;
  satelliteStatus: SatelliteStatus | null;
  theme: "dark" | "light";
}

function TerriorLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Orbit ring */}
      <ellipse cx="11" cy="11" rx="9.5" ry="4.5" stroke="#FF4500" strokeWidth="1.5" fill="none" opacity="0.7" transform="rotate(-30 11 11)" />
      {/* Satellite dot */}
      <circle cx="17.5" cy="8.2" r="1.8" fill="#FF4500" />
      {/* Earth */}
      <circle cx="11" cy="11" r="4.5" fill="#1a4a7a" />
      <path d="M8 9.5 Q10 8 12 9.5 Q14 11 12 12.5 Q10 14 8 12.5 Q6 11 8 9.5Z" fill="#22863a" opacity="0.8" />
    </svg>
  );
}

export function Header({ connected, satelliteStatus, theme }: HeaderProps) {
  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#080d14]" : "bg-white";
  const border = isDark ? "border-[#1e2535]" : "border-slate-200";
  const muted = isDark ? "text-slate-500" : "text-slate-400";
  const text = isDark ? "text-slate-200" : "text-slate-800";

  return (
    <header className={`flex-none flex items-center justify-between px-4 h-11 border-b ${bg} ${border}`}>
      {/* Left — logo + wordmark */}
      <div className="flex items-center gap-2.5">
        <TerriorLogo />
        <div className="flex items-baseline gap-2">
          <span className={`text-sm font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
            Terroir
          </span>
          <span className={`text-[10px] font-mono ${muted} hidden sm:block`}>
            terroir.space
          </span>
        </div>
        <div className={`text-[9px] px-1.5 py-0.5 rounded font-mono tracking-wider ${isDark ? "bg-[#1a2840] text-slate-400" : "bg-slate-100 text-slate-500"}`}>
          BETA
        </div>
      </div>

      {/* Right — status indicators */}
      <div className="flex items-center gap-3">
        {/* Model badge */}
        <div className={`hidden sm:flex items-center gap-1.5 text-[9px] font-mono ${muted}`}>
          <span className={`px-1.5 py-0.5 rounded ${isDark ? "bg-[#1a2840]" : "bg-slate-100"}`}>
            LFM2.5-VL
          </span>
          <span className={`px-1.5 py-0.5 rounded ${isDark ? "bg-[#1a2840]" : "bg-slate-100"}`}>
            Sentinel-2
          </span>
        </div>

        {/* Altitude */}
        {satelliteStatus?.position && (
          <span className={`text-[10px] font-mono ${muted} hidden md:block`}>
            {satelliteStatus.position.alt_km.toFixed(0)} km
          </span>
        )}

        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-500 shadow-[0_0_4px_#22c55e]" : "bg-red-500"}`} />
          <span className={`text-[10px] font-mono font-medium ${connected ? (isDark ? "text-green-400" : "text-green-600") : (isDark ? "text-red-400" : "text-red-500")}`}>
            {connected ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </div>
    </header>
  );
}
