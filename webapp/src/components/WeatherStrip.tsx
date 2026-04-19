import type { WeatherSummary } from "@/lib/types";

interface WeatherStripProps {
  weather: WeatherSummary;
  theme: "dark" | "light";
}

export function WeatherStrip({ weather, theme }: WeatherStripProps) {
  const isDark = theme === "dark";
  const base = isDark ? "bg-[#0d1420] border-[#1a2840] text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500";

  const items = [
    { label: "Temp", value: `${weather.temperature_2m.toFixed(1)}°C` },
    { label: "RH", value: `${weather.relative_humidity_2m.toFixed(0)}%` },
    { label: "Rain", value: `${weather.precipitation.toFixed(1)}mm` },
    { label: "VPD", value: `${weather.vapour_pressure_deficit.toFixed(2)} kPa` },
  ];

  return (
    <div className={`flex gap-2 p-2 rounded border text-xs ${base}`}>
      {items.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center flex-1">
          <span className="opacity-60 text-[10px]">{label}</span>
          <span className="font-mono font-medium">{value}</span>
        </div>
      ))}
    </div>
  );
}
