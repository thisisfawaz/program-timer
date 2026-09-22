"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Program, Recurrence } from "@/lib/types";
import { TZ_OFFSETS, formatOffset } from "@/lib/schedule";
import {
  RECURRENCES,
  currentOccurrence,
  formatDateLabel,
  todayInOffset,
} from "@/lib/recurrence";
import { getOrg } from "@/lib/orgs";
import { getActiveStates } from "@/lib/active";
import { createProgram, listOrgPrograms } from "@/lib/programs";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { OrgSettingsPanel } from "@/components/OrgSettingsPanel";

function defaultTime(): string {
  return "09:00";
}

export default function OrgWorkspacePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();

  const [org, setOrg] = useState<{ id: string; name: string; owner_id: string } | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // New program form (always open, like the timers page).
  const [name, setName] = useState("");
  const [date, setDate] = useState(() => todayInOffset(0));
  const [time, setTime] = useState(defaultTime);
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [tzOffset, setTzOffset] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const o = await getOrg(id);
      setOrg(o);
      if (o) setPrograms(await listOrgPrograms(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load organization");
    } finally {
      setLoaded(true);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh presence glow (control/live) periodically and on changes.
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 4000);
    const refresh = () => setTick((n) => n + 1);
    window.addEventListener("timer-active-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("timer-active-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const p = await createProgram(
        { name: name.trim(), tzOffset, anchorDate: date, anchorTime: time, recurrence },
        { orgId: id },
      );
      router.push(`/p/${p.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create program");
      setBusy(false);
    }
  };

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm text-red-400">{error}</p>
        <Link href="/start" className="mt-4 inline-block text-xs text-neutral-500 underline">
          Back
        </Link>
      </main>
    );
  }

  if (loaded && !org) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm text-neutral-400">
          This organization could not be found, or you don’t have access to it.
        </p>
        <Link href="/start" className="mt-4 inline-block text-xs text-neutral-500 underline">
          Back to organizations
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/start" className="text-xs text-neutral-500 hover:text-neutral-300">
            ← All organizations
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{org?.name ?? "Loading…"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setShowSettings(true)}>
            Settings
          </Button>
        </div>
      </header>

      {showSettings ? (
        <OrgSettingsPanel
          orgId={id}
          onClose={() => setShowSettings(false)}
          onRenamed={(name) => setOrg((o) => (o ? { ...o, name } : o))}
        />
      ) : (
        <>

      <Card>
          <h2 className="mb-4 text-lg font-medium">New program</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly Meeting" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <Label>Recurrence</Label>
              <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
                {RECURRENCES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Timezone offset</Label>
              <Select value={tzOffset} onChange={(e) => setTzOffset(Number(e.target.value))}>
                {TZ_OFFSETS.map((o) => (
                  <option key={o} value={o}>
                    {formatOffset(o)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="primary" onClick={create} disabled={busy || !name.trim()}>
              {busy ? "Creating…" : "Create program"}
            </Button>
          </div>
        </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Programs</h2>
        {programs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
            No programs yet. Create one to get started.
          </p>
        ) : (
          programs.map((p) => {
            const anchorDate = p.anchorDate ?? "";
            const rec = p.recurrence ?? "none";
            const occ = anchorDate
              ? currentOccurrence(anchorDate, rec, todayInOffset(p.tzOffset))
              : "";
            const recLabel =
              RECURRENCES.find((r) => r.value === rec)?.label ?? "Does not repeat";
            return (
              <Card key={p.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {formatOffset(p.tzOffset)} · {p.items.length} item{p.items.length === 1 ? "" : "s"}
                  </p>
                  {anchorDate && (
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {formatDateLabel(occ || anchorDate)} {p.anchorTime} · {recLabel}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/p/${p.id}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="subtle" state={getActiveStates(p.id).control}>
                      Control
                    </Button>
                  </Link>
                  <Link href={`/p/${p.id}/live`} target="_blank" rel="noopener noreferrer">
                    <Button variant="subtle" state={getActiveStates(p.id).live}>
                      Live
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })
        )}
      </section>
        </>
      )}
    </main>
  );
}
