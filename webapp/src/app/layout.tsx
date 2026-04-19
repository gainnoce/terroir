import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Terroir — Orbital Vineyard Intelligence",
  description: "Monitor vineyard health from orbit using LFM2.5-VL satellite AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
