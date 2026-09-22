"use client";

import { createClient } from "@/lib/supabase/client";

export interface LiveDoc {
  itemIndex: number | null;
  running: boolean;
  /** Wall-clock ms when the current countdown ends (null when stopped/idle). */
  anchorMs: number | null;
  /** Frozen seconds shown while paused (null when not paused). */
  pausedRemainingSec: number | null;
  updatedAt: number;
}

export const EMPTY_LIVE: LiveDoc = {
  itemIndex: null,
  running: false,
  anchorMs: null,
  pausedRemainingSec: null,
  updatedAt: 0,
};

function rowToDoc(row: {
  item_index: number | null;
  running: boolean;
  anchor_ms: number | null;
  paused_remaining_sec: number | null;
  updated_at: string;
}): LiveDoc {
  return {
    itemIndex: row.item_index ?? null,
    running: row.running === true,
    anchorMs: typeof row.anchor_ms === "number" ? row.anchor_ms : null,
    pausedRemainingSec:
      typeof row.paused_remaining_sec === "number" ? row.paused_remaining_sec : null,
    updatedAt: Date.parse(row.updated_at) || 0,
  };
}

export async function readLive(programId: string): Promise<LiveDoc> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("live_state")
    .select("item_index, running, anchor_ms, paused_remaining_sec, updated_at")
    .eq("program_id", programId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...EMPTY_LIVE };
  return rowToDoc(data as Parameters<typeof rowToDoc>[0]);
}

export async function writeLive(
  programId: string,
  doc: Partial<LiveDoc>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("live_state").upsert(
    {
      program_id: programId,
      item_index: doc.itemIndex ?? null,
      running: doc.running ?? false,
      anchor_ms: doc.anchorMs ?? null,
      paused_remaining_sec: doc.pausedRemainingSec ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "program_id" },
  );
  if (error) throw error;
}

export function subscribeLive(
  programId: string,
  onChange: (doc: LiveDoc) => void,
): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`live_state:${programId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "live_state", filter: `program_id=eq.${programId}` },
      (payload) => {
        const row = payload.new as Parameters<typeof rowToDoc>[0] | undefined;
        if (row) onChange(rowToDoc(row));
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
