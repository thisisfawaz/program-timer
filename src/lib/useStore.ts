"use client";

import { useEffect, useState } from "react";
import type { LiveState, Program } from "./types";
import { EMPTY_LIVE, readLive, subscribeLive, type LiveDoc } from "./live";

type ProgramWithOrg = Program & { orgId?: string | null };

/**
 * Subscribe to the shared live channel for a program (Supabase-backed). Updates
 * via realtime push, with a polling fallback so it works even if realtime
 * isn't available. Cross-device: any device viewing a program sees the same
 * running state.
 */
export function useLiveState(programId: string, pollMs = 1000): LiveState {
  const [doc, setDoc] = useState<LiveDoc>(EMPTY_LIVE);

  useEffect(() => {
    if (!programId) return;
    let active = true;

    const refresh = async () => {
      try {
        const next = await readLive(programId);
        if (active) setDoc(next);
      } catch {
        /* keep last known */
      }
    };

    refresh();
    const unsub = subscribeLive(programId, (next) => {
      if (active) setDoc(next);
    });
    const interval = window.setInterval(refresh, pollMs);

    return () => {
      active = false;
      unsub();
      window.clearInterval(interval);
    };
  }, [programId, pollMs]);

  // Adapt to the LiveState shape the views already use.
  return {
    itemIndex: doc.itemIndex,
    running: doc.running,
    remainingSec:
      doc.anchorMs !== null ? (doc.anchorMs - Date.now()) / 1000 : 0,
    updatedAt: doc.updatedAt,
  };
}

/** Notify subscribers that a program changed in the database. */
export function emitProgramChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("timer-program-changed"));
  }
}

/** Load a program from Supabase by id, refreshing on changes. */
export function useProgram(id: string): ProgramWithOrg | null {
  const [program, setProgram] = useState<ProgramWithOrg | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!id) return;
      const { getProgramById } = await import("./programs");
      try {
        const p = await getProgramById(id);
        if (!active) return;
        setProgram(p);
      } catch {
        if (active) setProgram(null);
      } finally {
        if (active) setLoaded(true);
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 5000);
    window.addEventListener("timer-program-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("timer-program-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [id]);

  return loaded ? program : null;
}
