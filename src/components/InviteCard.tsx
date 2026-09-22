"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";
import { createInvite, listInvites, type Invitation } from "@/lib/invites";

export function InviteCard({ orgId }: { orgId: string }) {
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInvites(await listInvites(orgId));
    } catch {
      setInvites([]);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const invite = async () => {
    if (!email.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const inv = await createInvite(orgId, email);
      setEmail("");
      await load();
      // Copy the link automatically so the owner can send it right away.
      const link = `${window.location.origin}/invite/${inv.token}`;
      try {
        await navigator.clipboard.writeText(link);
        setCopied(inv.id);
      } catch {
        /* clipboard may be blocked; the link is shown below anyway */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create invitation");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (inv: Invitation) => {
    const link = `${window.location.origin}/invite/${inv.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(inv.id);
    } catch {
      setError("Could not copy — copy the link manually.");
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-medium">Invite people</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Invite by email. They’ll get a link to join this organization.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label>Email address</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") invite();
            }}
            placeholder="teammate@example.com"
          />
        </div>
        <Button variant="primary" onClick={invite} disabled={busy || !email.trim()}>
          {busy ? "Inviting…" : "Invite"}
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {invites.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {invites.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 px-3 py-2 text-sm"
            >
              <span>{inv.email}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-neutral-500">
                  {inv.status}
                </span>
                {inv.status === "pending" && (
                  <Button variant="subtle" onClick={() => copyLink(inv)}>
                    {copied === inv.id ? "Copied" : "Copy link"}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
