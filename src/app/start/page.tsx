"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteOrg, duplicateOrg, listMyOrgs, type OrgSummary } from "@/lib/orgs";
import { listMyInvites } from "@/lib/invites";
import { Button, Card } from "@/components/ui";

type InboxInvite = { id: string; token: string; org_name: string | null };

export default function StartPage() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [inbox, setInbox] = useState<InboxInvite[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as { full_name?: string } | undefined;
      setName(meta?.full_name ?? data.user?.email ?? null);
    });
    listMyOrgs()
      .then(setOrgs)
      .catch(() => setOrgs([]));
    listMyInvites()
      .then((rows) =>
        setInbox(rows.map((r) => ({ id: r.id, token: r.token, org_name: r.org_name }))),
      )
      .catch(() => setInbox([]));
  }, []);

  const logout = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const reload = async () => {
    setOrgs(await listMyOrgs());
  };

  const duplicateOrgRow = async (id: string) => {
    if (!window.confirm("Duplicate this organization?")) return;
    await duplicateOrg(id);
    await reload();
  };

  const deleteOrgRow = async (id: string) => {
    if (
      !window.confirm(
        "Delete this organization? Its programs, members, and invitations will be removed. This cannot be undone.",
      )
    )
      return;
    await deleteOrg(id);
    await reload();
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {name ? `Welcome, ${name}` : "Welcome"}
          </h1>
          <p className="mt-1 text-sm text-neutral-400">How do you want to get started?</p>
        </div>
        <Button variant="ghost" onClick={logout}>
          Log out
        </Button>
      </header>

      {inbox.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm uppercase tracking-wide text-neutral-500">
            Invitations
          </h2>
          {inbox.map((inv) => (
            <Card
              key={inv.id}
              className="flex flex-col gap-2 border-indigo-800/60"
            >
              <p className="text-sm text-neutral-300">
                You’ve been invited to join{" "}
                <span className="font-medium text-white">
                  {inv.org_name ?? "an organization"}
                </span>
                .
              </p>
              <Button
                variant="primary"
                onClick={() => router.push(`/invite/${inv.token}`)}
              >
                Accept invitation
              </Button>
            </Card>
          ))}
        </section>
      )}

      {orgs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm uppercase tracking-wide text-neutral-500">Your organizations</h2>
          {orgs.map((o) => (
            <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{o.name}</p>
                <p className="text-xs text-neutral-500">{o.role}</p>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="primary" onClick={() => router.push(`/org/${o.id}`)}>
                  Open
                </Button>
                <button
                  className="text-sm text-white hover:text-neutral-300"
                  onClick={() => duplicateOrgRow(o.id)}
                >
                  Duplicate
                </button>
                <button
                  className="text-sm text-white hover:text-neutral-300"
                  onClick={() => deleteOrgRow(o.id)}
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Add an organization</h2>
          <p className="text-sm text-neutral-400">
            Create a team, invite people by email, and run programs together.
          </p>
          <Button variant="primary" onClick={() => router.push("/org/new")}>
            Create organization
          </Button>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Set up a timer directly</h2>
          <p className="text-sm text-neutral-400">
            Skip organizations and start building a program right away.
          </p>
          <Button variant="subtle" onClick={() => router.push("/timers")}>
            Go to my timers
          </Button>
        </Card>
      </div>
    </main>
  );
}
