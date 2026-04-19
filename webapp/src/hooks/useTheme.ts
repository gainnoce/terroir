"use client";
import { useEffect, useState } from "react";

function isDaytime(): boolean {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 20; // 6am–8pm = day
}

export function useTheme(): "dark" | "light" {
  const [theme, setTheme] = useState<"dark" | "light">(isDaytime() ? "light" : "dark");

  useEffect(() => {
    const interval = setInterval(() => {
      const next = isDaytime() ? "light" : "dark";
      setTheme((prev) => (prev !== next ? next : prev));
    }, 60_000); // check every minute
    return () => clearInterval(interval);
  }, []);

  return theme;
}
