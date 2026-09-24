"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ActiveKind = "control" | "live";
export type ActiveState = "open" | "closed" | "off";

/** Older than this after an explicit close decays to "off" (white). */
export const ACTIVE_DECAY_MS = 5 * 60 * 1000;
/** If an "open" session goes silent this long, treat it as closed. */
export const ACTIVE_STALE_MS = 6 * 1000;

function stateFromRow(
  row: { last_seen: string; open: boolean } | undefined,
): ActiveState {
  if (!row) return "off";
  const age = Date.now() - (Date.parse(row.last_seen) || 0);
  // Open, but only while the heartbeat is fresh. A closed/killed page (mobile
  // tabs often fire no close event) stops beating, so it goes amber quickly.
  if (row.open && age < ACTIVE_STALE_MS) return "open";
  // Closed (explicitly or by silence) → amber, decaying to white after 5 min.
  return age < ACTIVE_DECAY_MS ? "closed" : "off";
}

export async function markOpen(programId: string, kind: ActiveKind): Promise<void> {
  if (!programId) return;
  const supabase = createClient();
  await supabase.from("presence").upsert(
    { program_id: programId, kind, last_seen: new Date().toISOString(), open: true },
    { onConflict: "program_id,kind" },
  );
}

/** Close via a beacon to the server route (survives tab teardown). */
export function beaconClosed(programId: string, kind: ActiveKind): void {
  if (!programId || typeof navigator === "undefined" || !navigator.sendBeacon) return;
  try {
    const blob = new Blob([JSON.stringify({ programId, kind })], {
      type: "application/json",
    });
    navigator.sendBeacon("/api/presence/close", blob);
  } catch {
    /* ignore */
  }
}

/** Read both kinds' states for a program (one-shot). */
export async function getActiveStates(
  programId: string,
): Promise<Record<ActiveKind, ActiveState>> {
  if (!programId) return { control: "off", live: "off" };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("presence")
    .select("kind, last_seen, open")
    .eq("program_id", programId);
  if (error || !data) return { control: "off", live: "off" };
  const rows = data as { kind: string; last_seen: string; open: boolean }[];
  return {
    control: stateFromRow(rows.find((r) => r.kind === "control")),
    live: stateFromRow(rows.find((r) => r.kind === "live")),
  };
}

/** Read a single kind's state (one-shot). */
export async function getActiveState(
  programId: string,
  kind: ActiveKind,
): Promise<ActiveState> {
  return (await getActiveStates(programId))[kind];
}

/** Hook: live presence for a program via Realtime + poll fallback. */
export function useActiveStates(
  programId: string,
  pollMs = 15000,
): Record<ActiveKind, ActiveState> {
  const [states, setStates] = useState<Record<ActiveKind, ActiveState>>({
    control: "off",
    live: "off",
  });
  useEffect(() => {
    if (!programId) return;
    let active = true;
    const supabase = createClient();

    const refresh = async () => {
      const next = await getActiveStates(programId);
      if (active) setStates(next);
    };
    refresh();

    // Realtime: react instantly to presence changes (open/close).
    const channel = supabase
      .channel(`presence:${programId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "presence", filter: `program_id=eq.${programId}` },
        () => refresh(),
      )
      .subscribe();

    const id = window.setInterval(refresh, pollMs);
    return () => {
      active = false;
      supabase.removeChannel(channel);
      window.clearInterval(id);
    };
  }, [programId, pollMs]);
  return states;
}
