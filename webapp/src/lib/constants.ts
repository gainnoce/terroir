import type { Severity } from "./types";

export const SEV_COLORS: Record<Severity, string> = {
  CRITICAL: "#dc2626",
  WATCH: "#f97316",
  HEALTHY: "#22c55e",
};

export const SEV_BG: Record<Severity, string> = {
  CRITICAL: "rgba(220,38,38,0.1)",
  WATCH: "rgba(249,115,22,0.1)",
  HEALTHY: "rgba(34,197,94,0.1)",
};
