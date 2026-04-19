"use client";
import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Alert, SatelliteStatus } from "@/lib/types";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

interface MapProps {
  alerts: Alert[];
  satelliteStatus: SatelliteStatus | null;
  theme: "dark" | "light";
  onAlertClick: (alert: Alert) => void;
}

const SEVERITY_COLORS = {
  CRITICAL: "#dc2626",
  WATCH: "#f97316",
  HEALTHY: "#22c55e",
};

export function Map({ alerts, satelliteStatus, theme, onAlertClick }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const satelliteMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: theme === "dark" ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/satellite-streets-v12",
      center: [0, 20],
      zoom: 2,
    });
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      satelliteMarkerRef.current?.remove();
      satelliteMarkerRef.current = null;
      map.remove();
    };
  }, [theme]);

  // Update alert markers (guard for async style load)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const draw = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      alerts.forEach((alert) => {
        const el = document.createElement("div");
        el.className = "alert-marker";
        el.style.cssText = `
          width: 14px; height: 14px; border-radius: 50%;
          background: ${SEVERITY_COLORS[alert.severity]};
          border: 2px solid white;
          cursor: pointer;
          box-shadow: 0 0 8px ${SEVERITY_COLORS[alert.severity]}88;
        `;
        el.addEventListener("click", () => onAlertClick(alert));

        const marker = new mapboxgl.Marker(el)
          .setLngLat([alert.location.lon, alert.location.lat])
          .addTo(map);
        markersRef.current.push(marker);
      });
    };

    if (map.isStyleLoaded()) {
      draw();
    } else {
      map.once("load", draw);
      return () => { map.off("load", draw); };
    }
  }, [alerts, onAlertClick]);

  // Update satellite position (guard for async style load)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !satelliteStatus?.position) return;

    const { lat, lon } = satelliteStatus.position;

    const place = () => {
      if (satelliteMarkerRef.current) {
        satelliteMarkerRef.current.setLngLat([lon, lat]);
      } else {
        const el = document.createElement("div");
        el.style.cssText = `
          width: 10px; height: 10px; border-radius: 50%;
          background: #4a9fff; border: 2px solid rgba(74,159,255,0.4);
          box-shadow: 0 0 8px rgba(74,159,255,0.6);
        `;
        satelliteMarkerRef.current = new mapboxgl.Marker(el).setLngLat([lon, lat]).addTo(map);
      }
    };

    if (map.isStyleLoaded()) {
      place();
    } else {
      map.once("load", place);
      return () => { map.off("load", place); };
    }
  }, [satelliteStatus]);

  return <div ref={containerRef} className="w-full h-full" />;
}
