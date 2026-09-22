"use client";

import { useEffect, useState } from "react";
import { formatClock } from "./schedule";

/** Returns the formatted HH:MM:SS clock string for a fixed GMT offset, ticking every second. */
export function useClock(tzOffset: number): string {
  const [clock, setClock] = useState(() => formatClock(tzOffset));

  useEffect(() => {
    const tick = () => setClock(formatClock(tzOffset));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [tzOffset]);

  return clock;
}
