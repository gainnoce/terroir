"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { WsMessage, Alert, SatelliteStatus } from "@/lib/types";

interface WebSocketState {
  alerts: Alert[];
  satelliteStatus: SatelliteStatus | null;
  connected: boolean;
}

export function useWebSocket(url: string): WebSocketState {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [satelliteStatus, setSatelliteStatus] = useState<SatelliteStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);

        if (msg.type === "initial_state") {
          setAlerts(msg.data.alerts ?? []);
          setSatelliteStatus(msg.data.status ?? null);
        } else if (msg.type === "alert") {
          setAlerts((prev) => [msg.data, ...prev.filter((a) => a.id !== msg.data.id)].slice(0, 10));
        } else if (msg.type === "satellite_position") {
          setSatelliteStatus(msg.data);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (!unmountedRef.current) {
        reconnectTimeout.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => ws.close();
  }, [url]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { alerts, satelliteStatus, connected };
}
