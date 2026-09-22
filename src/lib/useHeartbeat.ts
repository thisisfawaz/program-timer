"use client";

import { useEffect } from "react";
import type { ActiveKind } from "./active";
import { markClosed, markOpen } from "./active";

/** Marks open while mounted; marks closed on pagehide so amber is instant. */
export function useHeartbeat(programId: string, kind: ActiveKind): void {
  useEffect(() => {
    if (!programId) return;
    const beat = () => {
      markOpen(programId, kind).catch(() => {});
    };
    beat();
    const id = window.setInterval(beat, 8000);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    const onHide = () => {
      markClosed(programId, kind).catch(() => {});
    };
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
    };
  }, [programId, kind]);
}
