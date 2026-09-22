"use client";

import { useCallback, useEffect, useState } from "react";
import { getOrg, listMembers, renameOrg, type OrgMember } from "@/lib/orgs";
import { Button, Card, Input, Label } from "@/components/ui";
import { InviteCard } from "@/components/InviteCard";

export function OrgSettingsPanel({
  orgId,
  onClose,
  onRenamed,
}: {
  orgId: string;
  onClose: () => void;
  onRenamed: (name: string) => void;
}) {
  const [org, setOrg] = useState<{ id: string; name: string; owner_id: string } | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [nameDraft, setNameDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const o = await getOrg(orgId);
      setOrg(o);
      setNameDraft(o?.name ?? "");
      setMembers(await listMembers(orgId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load settings");
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const rename = async () => {
    if (!org || !nameDraft.trim() || nameDraft.trim() === org.name) return;
    setBusy(true);
    try {
      await renameOrg(org.id, nameDraft.trim());
      onRenamed(nameDraft.trim());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <button
          onClick={onClose}
          aria-label="Close settings"
          className="rounded-lg px-2 py-1 text-xl leading-none text-neutral-400 hover:bg-neutral-800 hover:text-white"
        >
          ✕
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Card>
        <h2 className="text-lg font-medium">Organization name</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label>Name</Label>
            <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
          </div>
          <Button
            variant="primary"
            onClick={rename}
            disabled={busy || !nameDraft.trim() || nameDraft.trim() === org?.name}
          >
            Save
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-medium">Members</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2 text-sm"
            >
              <span>{m.displayName || m.fullName || "Unnamed member"}</span>
              <span className="text-xs uppercase tracking-wide text-neutral-500">{m.role}</span>
            </li>
          ))}
          {members.length === 0 && (
            <li className="text-sm text-neutral-500">No members yet.</li>
          )}
        </ul>
      </Card>

      <InviteCard orgId={orgId} />
    </div>
  );
}
