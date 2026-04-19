"use client";
import { useState } from "react";

interface ImageSliderProps {
  rgbImage: string;   // base64 PNG
  swirImage: string;  // base64 PNG
}

export function ImageSlider({ rgbImage, swirImage }: ImageSliderProps) {
  const [position, setPosition] = useState(50);

  return (
    <div className="relative w-full h-32 overflow-hidden rounded select-none cursor-col-resize"
         onMouseMove={(e) => {
           const rect = e.currentTarget.getBoundingClientRect();
           setPosition(((e.clientX - rect.left) / rect.width) * 100);
         }}>
      {/* SWIR (bottom layer) */}
      <img src={`data:image/png;base64,${swirImage}`} alt="SWIR"
           className="absolute inset-0 w-full h-full object-cover" />
      {/* RGB (top layer, clipped) */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        <img src={`data:image/png;base64,${rgbImage}`} alt="RGB"
             className="absolute inset-0 h-full object-cover" style={{ width: `${100 / (position / 100)}%` }} />
      </div>
      {/* Divider line */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
           style={{ left: `${position}%` }} />
      {/* Labels */}
      <div className="absolute top-1 left-1 text-xs text-white bg-black/50 px-1 rounded">RGB</div>
      <div className="absolute top-1 right-1 text-xs text-white bg-black/50 px-1 rounded">SWIR</div>
    </div>
  );
}
