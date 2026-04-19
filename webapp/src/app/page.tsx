"use client";
import { useState } from "react";
import type { Alert } from "@/lib/types";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Map } from "@/components/Map";
import { AlertPanel } from "@/components/AlertPanel";
import { Header } from "@/components/Header";

const WS_URL = process.env.NEXT_PUBLIC_MONITOR_WS_URL ?? "ws://localhost:8001/ws";
const THEME = "dark" as const;

export default function Home() {
  const { alerts, satelliteStatus, connected } = useWebSocket(WS_URL);
  const [, setFocusedAlert] = useState<Alert | null>(null);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#080d14]">
      <Header connected={connected} satelliteStatus={satelliteStatus} theme={THEME} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Map (60%) */}
        <div className="flex-[0_0_60%] relative">
          <Map
            alerts={alerts}
            satelliteStatus={satelliteStatus}
            onAlertClick={setFocusedAlert}
          />
        </div>

        {/* Right: Alert Panel (40%) */}
        <div className="flex-[0_0_40%] overflow-hidden">
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
