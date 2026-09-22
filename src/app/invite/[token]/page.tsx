"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { acceptInvite, getInviteByToken } from "@/lib/invites";
import { Button, Card, Input, Label } from "@/components/ui";

type Invite = Awaited<ReturnType<typeof getInviteByToken>>;

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const router = useRouter();

  const [invite, setInvite] = useState<Invite>(null);
  const [myEmail, setMyEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [inv, userRes] = await Promise.all([
        getInviteByToken(token),
        createClient().auth.getUser(),
      ]);
      setInvite(inv);
      const meta = userRes.data.user?.user_metadata as { full_name?: string } | undefined;
      setMyEmail(userRes.data.user?.email ?? null);
      setDisplayName(meta?.full_name ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load invitation");
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const accept = async () => {
    if (!invite) return;
    setError(null);
    setBusy(true);
    try {
      await acceptInvite(invite.id, invite.org_id, displayName.trim() || "Member");
      router.push(`/org/${invite.org_id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept invitation");
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-neutral-500">Loading invitation…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
        <p className="text-sm text-red-400">{error}</p>
        <Link href="/start" className="text-xs text-neutral-500 underline">
          Go to your account
        </Link>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
        <p className="text-sm text-neutral-400">
          This invitation link is invalid or has already been used.
        </p>
        <Link href="/start" className="text-xs text-neutral-500 underline">
          Go to your account
        </Link>
      </main>
    );
  }

  if (invite.status !== "pending") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
        <p className="text-sm text-neutral-400">
          This invitation has already been {invite.status}.
        </p>
        <Link href="/start" className="text-xs text-neutral-500 underline">
          Go to your account
        </Link>
      </main>
    );
  }

  const emailMismatch =
    myEmail !== null && invite.email.toLowerCase() !== myEmail.toLowerCase();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Join {invite.org_name ?? "organization"}
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          You’ve been invited as {invite.email}.
        </p>
      </header>

      <Card>
        {emailMismatch ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-amber-400">
              This invitation was sent to {invite.email}, but you’re signed in as{" "}
              {myEmail}. Log in with the invited email to accept.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <Label>Your name in this organization</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How teammates will see you"
              />
            </div>
            <Button variant="primary" onClick={accept} disabled={busy}>
              {busy ? "Joining…" : "Accept invitation"}
            </Button>
          </div>
        )}
      </Card>
    </main>
  );
}
