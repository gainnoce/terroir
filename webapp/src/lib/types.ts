export interface SatellitePosition {
  lat: number;
  lon: number;
  alt_km: number;
}

export interface SatelliteStatus {
  position: SatellitePosition | null;
  timestamp: string;
  last_scan: number | null;
  next_scan_in: number;
}

export interface IndicesSummary {
  ndvi: number;
  ndre: number;
  swir_moisture: number;
  nbr: number;
  canopy_cover: number;
}

export interface WeatherSummary {
  temperature_2m: number;
  relative_humidity_2m: number;
  precipitation: number;
  wind_speed_10m: number;
  vapour_pressure_deficit: number;
}

export interface PassHistoryEntry {
  timestamp: string;
  ndvi: number;
  ndre: number;
  swir_moisture: number;
}

export type Severity = "HEALTHY" | "WATCH" | "CRITICAL";
export type HarvestSignal = "HARVEST_NOW" | "DELAY_7_DAYS" | "ON_TRACK" | null;

export interface Alert {
  id: string;
  timestamp: string;
  location: { lat: number; lon: number };
  severity: Severity;
  confidence: number;
  report: string;
  harvest_signal: HarvestSignal;
  indices: IndicesSummary;
  weather: WeatherSummary;
  cloud_cover: number;
  rgb_image: string;   // base64 PNG
  swir_image: string;  // base64 PNG
}

export type WsMessageType = "initial_state" | "alert" | "satellite_position";

export type WsMessage =
  | { type: "initial_state"; data: { alerts: Alert[]; status: SatelliteStatus } }
  | { type: "alert"; data: Alert }
  | { type: "satellite_position"; data: SatelliteStatus };
