"use client";

import { useEffect } from "react";
import type { ActiveKind } from "./active";
import { markOpen } from "./active";

/**
 * Marks a program/kind "open" while this page is mounted (foreground or
 * background), beating every few seconds and on focus. Cross-device: any device
 * reads the same last_seen and shows green.
 */
export function useHeartbeat(programId: string, kind: ActiveKind): void {
  useEffect(() => {
    if (!programId) return;
    const beat = () => {
      markOpen(programId, kind).catch(() => {
        /* ignore */
      });
    };
    beat();
    const id = window.setInterval(beat, 8000);
    const onFocus = () => beat();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [programId, kind]);
}
