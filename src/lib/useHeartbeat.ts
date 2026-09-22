"use client";

import { useEffect } from "react";
import type { ActiveKind } from "./active";
import { markClosed, markOpen } from "./active";

/**
 * Presence tracker for a page. Marks the kind "open" for as long as the page is
 * mounted — foreground or background — and "closed" only when the page is
 * actually going away (pagehide/beforeunload). Backgrounding a tab does NOT
 * mark it closed, so the indicator stays green while the page is open anywhere.
 */
export function useHeartbeat(programId: string, kind: ActiveKind): void {
  useEffect(() => {
    if (!programId) return;

    markOpen(programId, kind);

    const onHide = () => markClosed(programId, kind);
    // pagehide fires on close/navigation (more reliable than beforeunload on
    // mobile); beforeunload is a belt-and-braces fallback.
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);

    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      // If the component unmounts without a pagehide (client-side nav away),
      // treat it as closed too.
      markClosed(programId, kind);
    };
  }, [programId, kind]);
}
