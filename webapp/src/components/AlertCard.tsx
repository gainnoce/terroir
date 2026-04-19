"use client";
import type { Alert, Severity } from "@/lib/types";
import { ImageSlider } from "./ImageSlider";
import { WeatherStrip } from "./WeatherStrip";

const SEV_COLORS: Record<Severity, string> = {
  CRITICAL: "#dc2626",
  WATCH: "#f97316",
  HEALTHY: "#22c55e",
};

const SEV_BG: Record<Severity, string> = {
  CRITICAL: "rgba(220,38,38,0.1)",
  WATCH: "rgba(249,115,22,0.1)",
  HEALTHY: "rgba(34,197,94,0.1)",
};

interface AlertCardProps {
  alert: Alert;
  theme: "dark" | "light";
  isSelected: boolean;
  onClick: () => void;
}

export function AlertCard({ alert, theme, isSelected, onClick }: AlertCardProps) {
  const isDark = theme === "dark";
  const border = SEV_COLORS[alert.severity];
  const bg = isDark ? "#12192a" : "#ffffff";
  const text = isDark ? "#e2e8f0" : "#0f172a";
  const muted = isDark ? "#8da8cc" : "#64748b";

  const downloadReport = () => {
    const { rgb_image, swir_image, ...exportable } = alert;
    const content = JSON.stringify(exportable, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terroir-alert-${alert.timestamp.replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      onClick={onClick}
      className="rounded cursor-pointer transition-all"
      style={{
        background: bg,
        border: `1px solid ${isSelected ? border : (isDark ? "#1e2d45" : "#e2e8f0")}`,
        borderLeft: `3px solid ${border}`,
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start p-3 pb-2">
        <div>
          <div className="text-[10px] font-bold tracking-wider" style={{ color: border }}>
            {alert.severity}
          </div>
          <div className="text-xs font-semibold mt-0.5" style={{ color: text }}>
            {alert.location.lat.toFixed(3)}°N {alert.location.lon.toFixed(3)}°E
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="text-[9px] px-1.5 py-0.5 rounded"
            style={{ background: SEV_BG[alert.severity], color: border }}
          >
            {Math.round(alert.confidence * 100)}%
          </div>
          <div className="text-[9px] font-mono" style={{ color: muted }}>
            {new Date(alert.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {isSelected && (
        <div className="px-3 pb-3 space-y-2">
          {/* Image slider */}
          <ImageSlider rgbImage={alert.rgb_image} swirImage={alert.swir_image} />

          {/* AI Report */}
          <p className="text-[11px] leading-relaxed italic" style={{ color: muted }}>
            &ldquo;{alert.report}&rdquo;
          </p>

          {/* Indices badges */}
          <div className="flex flex-wrap gap-1">
            {[
              { k: "NDVI", v: alert.indices.ndvi.toFixed(3), color: "#22c55e" },
              { k: "NDRE", v: alert.indices.ndre.toFixed(3), color: "#4a9fff" },
              { k: "SWIR", v: alert.indices.swir_moisture.toFixed(3), color: "#a78bfa" },
              { k: "Canopy", v: `${alert.indices.canopy_cover.toFixed(0)}%`, color: "#fbbf24" },
            ].map(({ k, v, color }) => (
              <div key={k} className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                   style={{ background: isDark ? "#0d1f35" : "#f1f5f9", border: `1px solid ${color}44`, color }}>
                {k} {v}
              </div>
            ))}
          </div>

          {/* Weather */}
          <WeatherStrip weather={alert.weather} theme={theme} />

          {/* Harvest signal */}
          {alert.harvest_signal && (
            <div className="text-[10px] px-2 py-1 rounded text-center font-semibold"
                 style={{ background: "#fbbf2422", color: "#fbbf24", border: "1px solid #fbbf2444" }}>
              {alert.harvest_signal.replace(/_/g, " ")}
            </div>
          )}

          {/* Download */}
          <button
            onClick={(e) => { e.stopPropagation(); downloadReport(); }}
            className="w-full text-[10px] py-1 rounded border text-center"
            style={{ borderColor: isDark ? "#1e2d45" : "#e2e8f0", color: muted }}
          >
            Download Report ↓
          </button>
        </div>
      )}
    </div>
  );
}
