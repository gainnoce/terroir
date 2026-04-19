"use client";
import type { SatelliteStatus } from "@/lib/types";

interface HeaderProps {
  connected: boolean;
  satelliteStatus: SatelliteStatus | null;
}

function TerroirLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="11" cy="11" rx="9.5" ry="4.5" stroke="#FF4500" strokeWidth="1.5" fill="none" opacity="0.7" transform="rotate(-30 11 11)" />
      <circle cx="17.5" cy="8.2" r="1.8" fill="#FF4500" />
      <circle cx="11" cy="11" r="4.5" fill="#1a4a7a" />
      <path d="M8 9.5 Q10 8 12 9.5 Q14 11 12 12.5 Q10 14 8 12.5 Q6 11 8 9.5Z" fill="#22863a" opacity="0.8" />
    </svg>
  );
}

export function Header({ connected, satelliteStatus }: HeaderProps) {
  return (
    <header
      className="flex items-center justify-between px-5 h-12"
      style={{
        background: "rgba(8, 13, 20, 0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Left — logo + wordmark */}
      <div className="flex items-center gap-3">
        <TerroirLogo />
        <span className="text-sm font-semibold tracking-tight text-white">
          terroir.space
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono tracking-wider text-slate-400"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          BETA
        </span>
      </div>

      {/* Right — status */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1.5">
          {["LFM2.5-VL", "Sentinel-2"].map((label) => (
            <span key={label}
                  className="text-[9px] font-mono text-slate-400 px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {label}
            </span>
          ))}
        </div>

        {satelliteStatus?.position && (
          <span className="text-[10px] font-mono text-slate-500 hidden md:block">
            {satelliteStatus.position.alt_km.toFixed(0)} km alt
          </span>
        )}

        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full transition-colors ${connected ? "bg-green-400 shadow-[0_0_6px_#4ade80]" : "bg-red-500"}`} />
          <span className={`text-[10px] font-mono font-medium tracking-wide ${connected ? "text-green-400" : "text-red-400"}`}>
            {connected ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </div>
    </header>
  );
}
