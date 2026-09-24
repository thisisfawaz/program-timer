"use client";

import { useEffect } from "react";
import type { ActiveKind } from "./active";
import { beaconClosed, markOpen } from "./active";

/**
 * Marks open while mounted (beating every few seconds), and sends a beacon to
 * mark closed on hide/unload so amber appears immediately (the beacon survives
 * tab teardown; a normal fetch does not).
 */
export function useHeartbeat(programId: string, kind: ActiveKind): void {
  useEffect(() => {
    if (!programId) return;
    const beat = () => {
      markOpen(programId, kind).catch(() => {});
    };
    beat();
    const id = window.setInterval(beat, 3000);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    // Only mark closed when the page is truly going away (pagehide/unload),
    // not on tab switch — switching tabs should stay green.
    const onHide = () => beaconClosed(programId, kind);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      // Also fire on client-side unmount (navigation within the app).
      beaconClosed(programId, kind);
    };
  }, [programId, kind]);
}
