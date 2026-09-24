"use client";

import { createClient } from "@/lib/supabase/client";

export interface LiveDoc {
  itemIndex: number | null;
  mode: "A" | "B";
  /** Per-item end clock (ms). */
  clocks: Record<number, number>;
  /** Per-item paused remaining (seconds). */
  paused: Record<number, number>;
  /** Mode A: per-item actual elapsed minutes, settled when passed forward. */
  overruns: Record<number, number>;
  updatedAt: number;
}

export const EMPTY_LIVE: LiveDoc = {
  itemIndex: null,
  mode: "A",
  clocks: {},
  paused: {},
  overruns: {},
  updatedAt: 0,
};

function asMap(v: unknown): Record<number, number> {
  return (v && typeof v === "object" ? v : {}) as Record<number, number>;
}

function rowToDoc(row: {
  item_index: number | null;
  mode?: string | null;
  clocks: unknown;
  paused: unknown;
  overruns: unknown;
  updated_at: string;
}): LiveDoc {
  return {
    itemIndex: row.item_index ?? null,
    mode: row.mode === "B" ? "B" : "A",
    clocks: asMap(row.clocks),
    paused: asMap(row.paused),
    overruns: asMap(row.overruns),
    updatedAt: Date.parse(row.updated_at) || 0,
  };
}

export async function readLive(programId: string): Promise<LiveDoc> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("live_state")
    .select("item_index, mode, clocks, paused, overruns, updated_at")
    .eq("program_id", programId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...EMPTY_LIVE };
  return rowToDoc(data as Parameters<typeof rowToDoc>[0]);
}

export async function writeLive(
  programId: string,
  doc: Partial<Pick<LiveDoc, "itemIndex" | "mode" | "clocks" | "paused" | "overruns">>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("live_state").upsert(
    {
      program_id: programId,
      item_index: doc.itemIndex ?? null,
      mode: doc.mode ?? "A",
      clocks: doc.clocks ?? {},
      paused: doc.paused ?? {},
      overruns: doc.overruns ?? {},
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
