"use client";

/** A 6px pulsing green dot fixed in the bottom-right corner. Negligible footprint. */
export function HeartbeatDot() {
  return (
    <span
      aria-hidden
      title="This page is active"
      className="fixed bottom-3 right-3 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400/80"
    />
  );
}
