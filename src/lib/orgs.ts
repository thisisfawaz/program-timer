"use client";

import { createClient } from "@/lib/supabase/client";

export interface OrgSummary {
  id: string;
  name: string;
  role: string;
  displayName: string | null;
}

export interface OrgMember {
  userId: string;
  role: string;
  displayName: string | null;
  email: string | null;
  fullName: string | null;
}

/** Create an organization and make the current user its owner. */
export async function createOrg(name: string, ownerDisplayName: string): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({ name, owner_id: user.id })
    .select("id")
    .single();
  if (orgErr) throw orgErr;

  const { error: memErr } = await supabase.from("memberships").insert({
    org_id: org.id,
    user_id: user.id,
    role: "owner",
    display_name: ownerDisplayName,
  });
  if (memErr) throw memErr;

  return org.id as string;
}

/** Organizations the current user belongs to. */
export async function listMyOrgs(): Promise<OrgSummary[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("memberships")
    .select("role, display_name, organizations ( id, name )")
    .eq("user_id", user.id);
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.organizations.id as string,
    name: row.organizations.name as string,
    role: row.role as string,
    displayName: row.display_name as string | null,
  }));
}

/** Members of an organization (requires membership). */
export async function listMembers(orgId: string): Promise<OrgMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("user_id, role, display_name")
    .eq("org_id", orgId);
  if (error) throw error;

  const rows = (data ?? []) as {
    user_id: string;
    role: string;
    display_name: string | null;
  }[];

  const ids = rows.map((r) => r.user_id);
  let profiles: Record<string, string | null> = {};
  if (ids.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    profiles = Object.fromEntries(
      ((profs ?? []) as { id: string; full_name: string | null }[]).map((p) => [
        p.id,
        p.full_name,
      ]),
    );
  }

  return rows.map((row) => ({
    userId: row.user_id,
    role: row.role,
    displayName: row.display_name,
    email: null,
    fullName: profiles[row.user_id] ?? null,
  }));
}


/** Fetch a single org the user can see. */
export async function getOrg(orgId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, owner_id")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string; name: string; owner_id: string } | null) ?? null;
}

/** Rename an organization. */
export async function renameOrg(orgId: string, name: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name })
    .eq("id", orgId);
  if (error) throw error;
}

/**
 * Duplicate an organization: a new org owned by the current user, with copies
 * of the source org's programs (no members or invitations).
 */
export async function duplicateOrg(orgId: string): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const src = await getOrg(orgId);
  if (!src) throw new Error("Organization not found");

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({ name: `${src.name} (copy)`, owner_id: user.id })
    .select("id")
    .single();
  if (orgErr) throw orgErr;
  const newOrgId = (org as { id: string }).id;

  const { error: memErr } = await supabase.from("memberships").insert({
    org_id: newOrgId,
    user_id: user.id,
    role: "owner",
    display_name: null,
  });
  if (memErr) throw memErr;

  const { data: progs, error: progErr } = await supabase
    .from("programs")
    .select("name, tz_offset, anchor_date, anchor_time, recurrence, items")
    .eq("org_id", orgId);
  if (progErr) throw progErr;
  if (progs && progs.length > 0) {
    const rows = progs.map((p: any) => ({
      owner_id: user.id,
      org_id: newOrgId,
      name: p.name,
      tz_offset: p.tz_offset,
      anchor_date: p.anchor_date,
      anchor_time: p.anchor_time,
      recurrence: p.recurrence,
      items: p.items,
    }));
    const { error: insErr } = await supabase.from("programs").insert(rows);
    if (insErr) throw insErr;
  }

  return newOrgId;
}

/** Delete an organization (cascades memberships, invitations, programs). */
export async function deleteOrg(orgId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("organizations").delete().eq("id", orgId);
  if (error) throw error;
}
