"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ActiveKind = "control" | "live";
export type ActiveState = "open" | "closed" | "off";

/** Heartbeat is "open" (green) if younger than this. */
export const ACTIVE_FRESH_MS = 20 * 1000;
/** Older than this decays to "off" (white). */
export const ACTIVE_DECAY_MS = 5 * 60 * 1000;

/** Record presence for a kind (called while a page is open). */
export async function markOpen(programId: string, kind: ActiveKind): Promise<void> {
  if (!programId) return;
  const supabase = createClient();
  await supabase.from("presence").upsert(
    { program_id: programId, kind, last_seen: new Date().toISOString() },
    { onConflict: "program_id,kind" },
  );
}

/** Read both kinds' states for a program. */
export async function getActiveStates(
  programId: string,
): Promise<Record<ActiveKind, ActiveState>> {
  if (!programId) return { control: "off", live: "off" };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("presence")
    .select("kind, last_seen")
    .eq("program_id", programId);
  if (error || !data) return { control: "off", live: "off" };
  const now = Date.now();
  const stateFor = (kind: ActiveKind): ActiveState => {
    const row = (data as { kind: string; last_seen: string }[]).find((r) => r.kind === kind);
    if (!row) return "off";
    const age = now - (Date.parse(row.last_seen) || 0);
    if (age < ACTIVE_FRESH_MS) return "open";
    if (age < ACTIVE_DECAY_MS) return "closed";
    return "off";
  };
  return { control: stateFor("control"), live: stateFor("live") };
}

/** Read a single kind's state. */
export async function getActiveState(
  programId: string,
  kind: ActiveKind,
): Promise<ActiveState> {
  return (await getActiveStates(programId))[kind];
}

/** Hook: presence states for a program, refreshed on an interval. */
export function useActiveStates(
  programId: string,
  pollMs = 5000,
): Record<ActiveKind, ActiveState> {
  const [states, setStates] = useState<Record<ActiveKind, ActiveState>>({
    control: "off",
    live: "off",
  });
  useEffect(() => {
    if (!programId) return;
    let active = true;
    const refresh = async () => {
      const next = await getActiveStates(programId);
      if (active) setStates(next);
    };
    refresh();
    const id = window.setInterval(refresh, pollMs);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [programId, pollMs]);
  return states;
}
