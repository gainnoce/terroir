"use client";
import { useRef, useState, useCallback } from "react";
import type { Alert } from "@/lib/types";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Map } from "@/components/Map";
import { AlertPanel } from "@/components/AlertPanel";
import { Header } from "@/components/Header";

const WS_URL = process.env.NEXT_PUBLIC_MONITOR_WS_URL ?? "ws://localhost:8001/ws";
const THEME = "dark" as const;
const PANEL_MIN = 300;
const PANEL_MAX_FRAC = 0.75;
const PANEL_DEFAULT_FRAC = 0.38;

export default function Home() {
  const { alerts, satelliteStatus, connected } = useWebSocket(WS_URL);
  const [, setFocusedAlert] = useState<Alert | null>(null);
  const [panelFrac, setPanelFrac] = useState(PANEL_DEFAULT_FRAC);
  const isResizing = useRef(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    const startX = e.clientX;
    const startFrac = panelFrac;

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const totalW = window.innerWidth;
      const newPanelPx = totalW - ev.clientX;
      const clamped = Math.max(PANEL_MIN, Math.min(totalW * PANEL_MAX_FRAC, newPanelPx));
      setPanelFrac(clamped / totalW);
    };

    const onUp = () => {
      isResizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    e.preventDefault();
    void startFrac;
  }, [panelFrac]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#080d14]">

      {/* Header */}
      <div className="flex-none z-20">
        <Header connected={connected} satelliteStatus={satelliteStatus} />
      </div>

      {/* Body — map + panel side by side */}
      <div className="flex flex-1 min-h-0">

        {/* Map */}
        <div className="flex-1 min-w-0 relative">
          <Map
            alerts={alerts}
            satelliteStatus={satelliteStatus}
            onAlertClick={setFocusedAlert}
          />
        </div>

        {/* Drag handle */}
        <div
          className="flex-none w-1.5 cursor-col-resize z-10 relative group"
          style={{ background: "rgba(255,255,255,0.04)" }}
          onMouseDown={startResize}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
               style={{ background: "rgba(255,255,255,0.25)" }} />
        </div>

        {/* Panel */}
        <div
          className="flex-none flex flex-col overflow-hidden"
          style={{
            width: `${panelFrac * 100}%`,
            minWidth: PANEL_MIN,
            background: "rgba(8, 13, 22, 0.95)",
            borderLeft: "1px solid rgba(255, 255, 255, 0.07)",
          }}
        >
          <AlertPanel
            alerts={alerts}
            satelliteStatus={satelliteStatus}
            connected={connected}
            theme={THEME}
          />
        </div>
      </div>
    </div>
  );
}
