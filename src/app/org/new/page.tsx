"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createOrg } from "@/lib/orgs";
import { Button, Card, Input, Label } from "@/components/ui";

export default function NewOrgPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const meta = data.user?.user_metadata as { full_name?: string } | undefined;
        setDisplayName(meta?.full_name ?? "");
      });
  }, []);

  const submit = async () => {
    if (!orgName.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const id = await createOrg(orgName.trim(), displayName.trim() || "Owner");
      router.push(`/org/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create organization");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <header>
        <Link href="/start" className="text-xs text-neutral-500 hover:text-neutral-300">
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create organization</h1>
        <p className="mt-1 text-sm text-neutral-400">
          A shared space for your team and its programs.
        </p>
      </header>
      <Card>
        <div className="flex flex-col gap-4">
          <div>
            <Label>Organization name</Label>
            <Input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Events"
            />
          </div>
          <div>
            <Label>Your name in this organization</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How teammates see you"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button variant="primary" onClick={submit} disabled={busy || !orgName.trim()}>
            {busy ? "Creating…" : "Create organization"}
          </Button>
        </div>
      </Card>
    </main>
  );
}
