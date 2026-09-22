"use client";

import { createClient } from "@/lib/supabase/client";

export interface LiveDoc {
  itemIndex: number | null;
  running: boolean;
  /** Wall-clock ms when the current countdown ends (null when stopped/idle). */
  anchorMs: number | null;
  updatedAt: number;
}

export const EMPTY_LIVE: LiveDoc = {
  itemIndex: null,
  running: false,
  anchorMs: null,
  updatedAt: 0,
};

/** Read the live state for a program. */
export async function readLive(programId: string): Promise<LiveDoc> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("live_state")
    .select("item_index, running, anchor_ms, updated_at")
    .eq("program_id", programId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...EMPTY_LIVE };
  return {
    itemIndex: data.item_index ?? null,
    running: data.running === true,
    anchorMs: typeof data.anchor_ms === "number" ? data.anchor_ms : null,
    updatedAt: Date.parse(data.updated_at) || 0,
  };
}

/** Write (upsert) the live state for a program. */
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
      updated_at: new Date().toISOString(),
    },
    { onConflict: "program_id" },
  );
  if (error) throw error;
}

/**
 * Subscribe to realtime changes for a program's live state. Returns an
 * unsubscribe function. Falls back to nothing if realtime is unavailable;
 * callers should also poll as a backstop.
 */
export function subscribeLive(
  programId: string,
  onChange: (doc: LiveDoc) => void,
): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`live_state:${programId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "live_state",
        filter: `program_id=eq.${programId}`,
      },
      (payload) => {
        const row = payload.new as
          | {
              item_index: number | null;
              running: boolean;
              anchor_ms: number | null;
              updated_at: string;
            }
          | undefined;
        if (!row) return;
        onChange({
          itemIndex: row.item_index ?? null,
          running: row.running === true,
          anchorMs: typeof row.anchor_ms === "number" ? row.anchor_ms : null,
          updatedAt: Date.parse(row.updated_at) || Date.now(),
        });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
