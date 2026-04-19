"use client";
import { useState } from "react";
import type { Alert } from "@/lib/types";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useTheme } from "@/hooks/useTheme";
import { Map } from "@/components/Map";
import { AlertPanel } from "@/components/AlertPanel";

const WS_URL = process.env.NEXT_PUBLIC_MONITOR_WS_URL ?? "ws://localhost:8001/ws";

export default function Home() {
  const theme = useTheme();
  const { alerts, satelliteStatus, connected } = useWebSocket(WS_URL);
  const [focusedAlert, setFocusedAlert] = useState<Alert | null>(null);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#0d1117]" : "bg-white";

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${bg}`}>
      {/* Left: Map (60%) */}
      <div className="flex-[0_0_60%] relative">
        <Map
          alerts={alerts}
          satelliteStatus={satelliteStatus}
          theme={theme}
          onAlertClick={setFocusedAlert}
        />
      </div>

      {/* Right: Alert Panel (40%) */}
      <div className="flex-[0_0_40%] overflow-y-auto">
        <AlertPanel
          alerts={alerts}
          satelliteStatus={satelliteStatus}
          connected={connected}
          theme={theme}
        />
      </div>
    </div>
  );
}
