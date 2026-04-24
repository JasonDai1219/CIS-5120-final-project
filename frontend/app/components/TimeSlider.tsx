"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";

type TimeSliderProps = {
  segments: number;
  low: number;
  high: number;
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

  const boundaryCount = segments + 1;

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
      if (segments <= 0) return; // Don't allow dragging when only 1 segment

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

  // Show a disabled slider even when segments <= 0 (single time period)
  if (segments < 0) return null;

  return (
    <div style={{ width: "100%", userSelect: "none" }}>
      <div style={{ position: "relative", width: "100%", padding: "0 10px", overflow: "visible" }}>
        <div
          ref={trackRef}
          style={{
            position: "relative",
            height: 24,
            display: "flex",
            alignItems: "center",
          }}
        >
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

          <motion.div
            animate={{
              left: `${lowPct}%`,
              width: `${highPct - lowPct}%`,
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 35,
              mass: 0.4,
            }}
            style={{
              position: "absolute",
              height: 6,
              borderRadius: 999,
              background: "#4CAF50",
            }}
          />

          <motion.div
            role="slider"
            aria-valuemin={0}
            aria-valuemax={segments - 1}
            aria-valuenow={low}
            tabIndex={0}
            onPointerDown={(e) => {
              e.preventDefault();
              if (segments > 0) {
                draggingRef.current = "low";
              }
            }}
            whileTap={{ scale: 1.08 }}
            animate={{
              left: `${lowPct - 1}%`,
              scale: draggingRef.current === "low" ? 1.08 : 1,
            }}
            transition={{
              left: { type: "spring", stiffness: 500, damping: 38, mass: 0.35 },
              scale: { duration: 0.12 },
            }}
            style={{
              position: "absolute",
              top: "10%",
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#3D6B35",
              border: "2px solid white",
              boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
              cursor: segments > 0 ? "grab" : "not-allowed",
              zIndex: 20,
              touchAction: "none",
              opacity: segments > 0 ? 1 : 0.6,
            }}
          />

          <motion.div
            role="slider"
            aria-valuemin={1}
            aria-valuemax={segments}
            aria-valuenow={high}
            tabIndex={0}
            onPointerDown={(e) => {
              e.preventDefault();
              if (segments > 0) {
                draggingRef.current = "high";
              }
            }}
            whileTap={{ scale: 1.08 }}
            animate={{
              left: `${highPct - 1}%`,
              scale: draggingRef.current === "high" ? 1.08 : 1,
            }}
            transition={{
              left: { type: "spring", stiffness: 500, damping: 38, mass: 0.35 },
              scale: { duration: 0.12 },
            }}
            style={{
              position: "absolute",
              top: "10%",
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#3D6B35",
              border: "2px solid white",
              boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
              cursor: segments > 0 ? "grab" : "not-allowed",
              zIndex: 20,
              touchAction: "none",
              opacity: segments > 0 ? 1 : 0.6,
            }}
          />
        </div>
      </div>
    </div>
  );
}