"use client";
import { useRef, useState, useCallback } from "react";
import type { Alert } from "@/lib/types";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Map } from "@/components/Map";
import { AlertPanel } from "@/components/AlertPanel";
import { Header } from "@/components/Header";

const WS_URL = process.env.NEXT_PUBLIC_MONITOR_WS_URL ?? "ws://localhost:8001/ws";
const THEME = "dark" as const;
const PANEL_MIN = 320;
const PANEL_DEFAULT = 420;

export default function Home() {
  const { alerts, satelliteStatus, connected } = useWebSocket(WS_URL);
  const [, setFocusedAlert] = useState<Alert | null>(null);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);
  const isResizing = useRef(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - ev.clientX;
      const max = window.innerWidth * 0.72;
      setPanelWidth(Math.max(PANEL_MIN, Math.min(max, startWidth + delta)));
    };

    const onUp = () => {
      isResizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    e.preventDefault();
  }, [panelWidth]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#080d14]">

      {/* Map — fills full viewport */}
      <div className="absolute inset-0">
        <Map
          alerts={alerts}
          satelliteStatus={satelliteStatus}
          onAlertClick={setFocusedAlert}
        />
      </div>

      {/* Header — glass bar floating at top */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <Header connected={connected} satelliteStatus={satelliteStatus} />
      </div>

      {/* Floating glass panel */}
      <div
        className="absolute z-10 flex flex-col rounded-2xl overflow-hidden"
        style={{
          top: "60px",
          right: "12px",
          bottom: "12px",
          width: panelWidth,
          background: "rgba(8, 13, 22, 0.85)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 8px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        {/* Resize handle — drag left edge to resize */}
        <div
          className="absolute left-0 top-4 bottom-4 w-1 rounded-full cursor-col-resize z-20 opacity-0 hover:opacity-100 transition-opacity"
          style={{ background: "rgba(255,255,255,0.15)" }}
          onMouseDown={startResize}
        />

        <AlertPanel
          alerts={alerts}
          satelliteStatus={satelliteStatus}
          connected={connected}
          theme={THEME}
        />
      </div>
    </div>
  );
}
