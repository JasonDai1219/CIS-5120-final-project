"use client";

import { useEffect, useRef } from "react";

type TimeSliderProps = {
  segments: number; // number of buckets
  low: number;      // boundary index: 0..segments-1
  high: number;     // boundary index: 1..segments
  onChange: (low: number, high: number) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function TimeSlider({
  segments,
  low,
  high,
  onChange,
}: TimeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"low" | "high" | null>(null);

  const boundaryCount = segments + 1; // for 2 buckets => 3 boundaries

  const toPercent = (boundaryIndex: number) => {
    if (boundaryCount <= 1) return 0;
    return (boundaryIndex / (boundaryCount - 1)) * 100;
  };

  const getBoundaryFromPointer = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;

    const rect = track.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const ratio = rect.width === 0 ? 0 : x / rect.width;
    return Math.round(ratio * (boundaryCount - 1));
  };

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;

      const boundary = getBoundaryFromPointer(e.clientX);

      if (draggingRef.current === "low") {
        const nextLow = clamp(boundary, 0, high - 1);
        onChange(nextLow, high);
      } else {
        const nextHigh = clamp(boundary, low + 1, segments);
        onChange(low, nextHigh);
      }
    };

    const handleUp = () => {
      draggingRef.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [low, high, segments, onChange]);

  const lowPct = toPercent(low);
  const highPct = toPercent(high);

  const handleStyle = (pct: number, zIndex: number): React.CSSProperties => ({
    position: "absolute",
    left: `${pct}%`,
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#3D6B35",
    border: "2px solid white",
    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
    cursor: "grab",
    zIndex,
    touchAction: "none",
  });

  if (segments <= 0) return null;

  return (
    <div style={{ width: "100%", userSelect: "none" }}>
      <div style={{ position: "relative", width: "100%", padding: "0 10px" }}>
        <div
          ref={trackRef}
          style={{
            position: "relative",
            height: 24,
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* Base track */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 6,
              borderRadius: 999,
              background: "#d4ddd0",
            }}
          />

          {/* Segment dividers */}
          {Array.from({ length: boundaryCount }).map((_, i) => {
            const pct = toPercent(i);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${pct}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 2,
                  height: 10,
                  borderRadius: 999,
                  background: "#a8b89a",
                  pointerEvents: "none",
                }}
              />
            );
          })}

          {/* Active selected range */}
          <div
            style={{
              position: "absolute",
              left: `${lowPct}%`,
              width: `${highPct - lowPct}%`,
              height: 6,
              borderRadius: 999,
              background: "#4CAF50",
            }}
          />

          {/* Left handle */}
          <div
            role="slider"
            aria-valuemin={0}
            aria-valuemax={segments - 1}
            aria-valuenow={low}
            tabIndex={0}
            onPointerDown={(e) => {
              e.preventDefault();
              draggingRef.current = "low";
            }}
            style={handleStyle(lowPct, 20)}
          />

          {/* Right handle */}
          <div
            role="slider"
            aria-valuemin={1}
            aria-valuemax={segments}
            aria-valuenow={high}
            tabIndex={0}
            onPointerDown={(e) => {
              e.preventDefault();
              draggingRef.current = "high";
            }}
            style={handleStyle(highPct, 21)}
          />
        </div>
      </div>
    </div>
  );
}