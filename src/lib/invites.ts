"use client";

import { createClient } from "@/lib/supabase/client";

export interface Invitation {
  id: string;
  email: string;
  status: string;
  token: string;
  created_at: string;
}

/** Create a pending invitation for an email in an org. */
export async function createInvite(
  orgId: string,
  email: string,
): Promise<Invitation> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("invitations")
    .insert({ org_id: orgId, email: email.trim().toLowerCase(), invited_by: user.id })
    .select("id, email, status, token, created_at")
    .single();
  if (error) throw error;
  return data as Invitation;
}

/** Pending invitations for an organization. */
export async function listInvites(orgId: string): Promise<Invitation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, status, token, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Invitation[];
}

/** Invitations addressed to the current user's email (for the inbox). */
export async function listMyInvites(): Promise<
  (Invitation & { org_name: string | null })[]
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email;
  if (!email) return [];

  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, status, token, created_at, organizations ( name )")
    .eq("status", "pending")
    .ilike("email", email);
  if (error) throw error;

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    email: row.email,
    status: row.status,
    token: row.token,
    created_at: row.created_at,
    org_name: row.organizations?.name ?? null,
  }));
}

/** Fetch one invitation by its token (for the accept page). */
export async function getInviteByToken(token: string): Promise<
  (Invitation & { org_id: string; org_name: string | null }) | null
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, status, token, created_at, org_id, organizations ( name )")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;
  return {
    id: row.id,
    email: row.email,
    status: row.status,
    token: row.token,
    created_at: row.created_at,
    org_id: row.org_id,
    org_name: row.organizations?.name ?? null,
  };
}

/** Accept an invitation: create the membership with the chosen display name. */
export async function acceptInvite(
  invitationId: string,
  orgId: string,
  displayName: string,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error: memErr } = await supabase.from("memberships").insert({
    org_id: orgId,
    user_id: user.id,
    role: "member",
    display_name: displayName,
  });
  if (memErr) throw memErr;

  const { error: invErr } = await supabase
    .from("invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invitationId);
  if (invErr) throw invErr;
}
