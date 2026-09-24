"use client";

import { createClient } from "@/lib/supabase/client";
import type { Program, ProgramItem, Recurrence } from "@/lib/types";

interface ProgramRow {
  id: string;
  owner_id: string | null;
  org_id: string | null;
  name: string;
  tz_offset: number;
  anchor_date: string | null;
  anchor_time: string | null;
  recurrence: Recurrence;
  mode: "A" | "B";
  items: ProgramItem[];
  created_at: string;
}

function rowToProgram(row: ProgramRow): Program & { orgId?: string | null } {
  return {
    id: row.id,
    name: row.name,
    tzOffset: row.tz_offset,
    items: Array.isArray(row.items) ? row.items : [],
    createdAt: Date.parse(row.created_at) || Date.now(),
    anchorDate: row.anchor_date ?? undefined,
    anchorTime: row.anchor_time ?? undefined,
    recurrence: row.recurrence ?? "none",
    mode: row.mode === "A" ? "A" : "B",
    orgId: row.org_id,
  };
}

/** Personal programs for the current user. */
export async function listMyPrograms(): Promise<Program[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("owner_id", user.id)
    .is("org_id", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as ProgramRow[]).map(rowToProgram);
}

/** Programs owned by an organization. */
export async function listOrgPrograms(orgId: string): Promise<Program[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as ProgramRow[]).map(rowToProgram);
}

export type ProgramWithOrg = Program & { orgId?: string | null };

export async function getProgramById(id: string): Promise<ProgramWithOrg | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProgram(data as ProgramRow) : null;
}

export async function createProgram(
  input: {
    name: string;
    tzOffset: number;
    anchorDate?: string;
    anchorTime?: string;
    recurrence?: Recurrence;
    items?: ProgramItem[];
  },
  scope: { orgId?: string } = {},
): Promise<Program> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("programs")
    .insert({
      owner_id: user.id,
      org_id: scope.orgId ?? null,
      name: input.name,
      tz_offset: input.tzOffset,
      anchor_date: input.anchorDate ?? null,
      anchor_time: input.anchorTime ?? null,
      recurrence: input.recurrence ?? "none",
      mode: "B",
      items: input.items ?? [],
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToProgram(data as ProgramRow);
}

export async function updateProgram(program: Program): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("programs")
    .update({
      name: program.name,
      tz_offset: program.tzOffset,
      anchor_date: program.anchorDate ?? null,
      anchor_time: program.anchorTime ?? null,
      recurrence: program.recurrence ?? "none",
      mode: program.mode ?? "B",
      items: program.items,
    })
    .eq("id", program.id);
  if (error) throw error;
}

export async function deleteProgramById(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("programs").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateProgramById(id: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  const src = data as ProgramRow;
  const { data: copy, error: insErr } = await supabase
    .from("programs")
    .insert({
      owner_id: src.owner_id,
      org_id: src.org_id,
      name: `${src.name} (copy)`,
      tz_offset: src.tz_offset,
      anchor_date: src.anchor_date,
      anchor_time: src.anchor_time,
      recurrence: src.recurrence,
      items: src.items,
    })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return (copy as { id: string }).id;
}

/**
 * One-time migration: push localStorage programs into the user's account.
 * Runs only if the user has no personal programs yet, so it never duplicates.
 */
export async function migrateLocalPrograms(
  localPrograms: Program[],
): Promise<number> {
  if (localPrograms.length === 0) return 0;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const existing = await listMyPrograms();
  if (existing.length > 0) return 0;

  const rows = localPrograms.map((p) => ({
    owner_id: user.id,
    org_id: null,
    name: p.name,
    tz_offset: p.tzOffset,
    anchor_date: p.anchorDate ?? null,
    anchor_time: p.anchorTime ?? null,
    recurrence: p.recurrence ?? "none",
    items: p.items,
  }));
  const { error } = await supabase.from("programs").insert(rows);
  if (error) throw error;
  return rows.length;
}
