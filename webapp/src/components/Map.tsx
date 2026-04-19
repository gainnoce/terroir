"use client";
import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Alert, SatelliteStatus } from "@/lib/types";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

interface MapProps {
  alerts: Alert[];
  satelliteStatus: SatelliteStatus | null;
  onAlertClick: (alert: Alert) => void;
}

const SEVERITY_COLORS = {
  CRITICAL: "#dc2626",
  WATCH: "#f97316",
  HEALTHY: "#22c55e",
};

export function Map({ alerts, satelliteStatus, onAlertClick }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const satelliteMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userInteractingRef = useRef(false);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style: "mapbox://styles/mapbox/dark-v11",
      center: [0, 20],
      zoom: 1.8,
      projection: { name: "globe" } as any,
    });
    mapRef.current = map;

    const startSpin = () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = setInterval(() => {
        if (!userInteractingRef.current && mapRef.current) {
          const center = map.getCenter();
          map.setCenter([center.lng - 0.06, center.lat]);
        }
      }, 50);
    };

    const pauseSpin = () => {
      userInteractingRef.current = true;
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = setTimeout(() => {
        userInteractingRef.current = false;
      }, 3000);
    };

    map.on("load", () => {
      map.setFog({
        color: "rgb(14, 22, 40)",
        "high-color": "rgb(20, 50, 110)",
        "horizon-blend": 0.03,
        "space-color": "rgb(5, 8, 18)",
        "star-intensity": 0.75,
      } as any);

      startSpin();
    });

    map.on("mousedown", pauseSpin);
    map.on("touchstart", pauseSpin);

    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      clearTimeout(resumeTimeoutRef.current);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      satelliteMarkerRef.current?.remove();
      satelliteMarkerRef.current = null;
      map.remove();
    };
  }, []);

  // Update alert markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const draw = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      alerts.forEach((alert) => {
        const el = document.createElement("div");
        el.style.cssText = `
          width: 14px; height: 14px; border-radius: 50%;
          background: ${SEVERITY_COLORS[alert.severity]};
          border: 2px solid white;
          cursor: pointer;
          box-shadow: 0 0 10px ${SEVERITY_COLORS[alert.severity]}99;
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

  // Update satellite position with pulsing marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !satelliteStatus?.position) return;

    const { lat, lon } = satelliteStatus.position;

    const place = () => {
      if (satelliteMarkerRef.current) {
        satelliteMarkerRef.current.setLngLat([lon, lat]);
      } else {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "position: relative; width: 18px; height: 18px;";

        const ring = document.createElement("div");
        ring.className = "satellite-pulse-ring";
        ring.style.cssText = `
          position: absolute; inset: 0; border-radius: 50%;
          background: rgba(74, 159, 255, 0.5);
        `;

        const core = document.createElement("div");
        core.style.cssText = `
          position: absolute; inset: 4px; border-radius: 50%;
          background: #4a9fff;
          box-shadow: 0 0 8px rgba(74,159,255,0.9);
        `;

        wrapper.appendChild(ring);
        wrapper.appendChild(core);

        satelliteMarkerRef.current = new mapboxgl.Marker(wrapper)
          .setLngLat([lon, lat])
          .addTo(map);
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
