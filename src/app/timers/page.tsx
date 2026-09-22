"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Program, Recurrence } from "@/lib/types";
import { TZ_OFFSETS, formatOffset } from "@/lib/schedule";
import { loadPrograms } from "@/lib/storage";
import { getActiveStates, type ActiveKind, type ActiveState } from "@/lib/active";
import {
  RECURRENCES,
  currentOccurrence,
  formatDateLabel,
  todayInOffset,
} from "@/lib/recurrence";
import {
  createProgram,
  deleteProgramById,
  duplicateProgramById,
  listMyPrograms,
  migrateLocalPrograms,
  updateProgram,
} from "@/lib/programs";
import { Button, Card, Input, Label, Select, TimeField } from "@/components/ui";

function defaultTime(): string {
  return "09:00";
}

export default function TimersPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [, setTick] = useState(0);

  const [name, setName] = useState("");
  const [tzOffset, setTzOffset] = useState(0);
  const [date, setDate] = useState(() => todayInOffset(0));
  const [time, setTime] = useState(defaultTime);
  const [recurrence, setRecurrence] = useState<Recurrence>("none");

  const [editing, setEditing] = useState<Program | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presence, setPresence] = useState<Record<string, Record<ActiveKind, ActiveState>>>(
    {},
  );

  const refresh = useCallback(async () => {
    try {
      setPrograms(await listMyPrograms());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load programs");
    }
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await migrateLocalPrograms(loadPrograms());
      } catch {
        /* ignore migration errors */
      }
      await refresh();
    })();
    const id = window.setInterval(refresh, 5000);
    window.addEventListener("timer-active-changed", refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("timer-active-changed", refresh);
    };
  }, [refresh]);

  // Presence (control/live) for all listed programs, refreshed periodically.
  useEffect(() => {
    let active = true;
    const loadPresence = async () => {
      const entries = await Promise.all(
        programs.map(async (p) => [p.id, await getActiveStates(p.id)] as const),
      );
      if (active) setPresence(Object.fromEntries(entries));
    };
    if (programs.length > 0) loadPresence();
    const id = window.setInterval(loadPresence, 5000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [programs]);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createProgram({
        name: trimmed,
        tzOffset,
        anchorDate: date,
        anchorTime: time,
        recurrence,
      });
      setName("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create program");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this program? This cannot be undone.")) return;
    await deleteProgramById(id);
    await refresh();
  };

  const duplicate = async (id: string) => {
    if (!window.confirm("Duplicate this program?")) return;
    await duplicateProgramById(id);
    await refresh();
  };

  const saveEdit = async (updated: Program) => {
    await updateProgram(updated);
    setEditing(null);
    await refresh();
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your timers</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Create a program, build its schedule, and run a live countdown.
          </p>
        </div>
        <Link href="/start" className="text-xs text-neutral-500 hover:text-neutral-300">
          ← Home
        </Link>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Card>
        <h2 className="mb-4 text-lg font-medium">New program</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
              }}
              placeholder="Weekly Meeting"
            />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Time</Label>
            <TimeField value={time} onCommit={setTime} />
          </div>
          <div>
            <Label>Recurrence</Label>
            <Select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            >
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
          <Button variant="primary" onClick={create} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Your programs</h2>
        {programs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
            No programs yet. Create one above to get started.
          </p>
        ) : (
          programs.map((p) => {
            const active = presence[p.id] ?? { control: "off", live: "off" };
            const anchorDate = p.anchorDate ?? "";
            const anchorTime = p.anchorTime ?? "";
            const rec = p.recurrence ?? "none";
            const occ = anchorDate
              ? currentOccurrence(anchorDate, rec, todayInOffset(p.tzOffset))
              : "";
            const recLabel =
              RECURRENCES.find((r) => r.value === rec)?.label ?? "Does not repeat";
            return (
              <Card
                key={p.id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {formatOffset(p.tzOffset)} · {p.items.length} item
                    {p.items.length === 1 ? "" : "s"}
                  </p>
                  {anchorDate && (
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {formatDateLabel(occ || anchorDate)} {anchorTime} · {recLabel}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/p/${p.id}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="subtle" state={active.control}>
                      Control
                    </Button>
                  </Link>
                  <Link href={`/p/${p.id}/live`} target="_blank" rel="noopener noreferrer">
                    <Button variant="subtle" state={active.live}>
                      Live
                    </Button>
                  </Link>
                  <Button variant="ghost" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => duplicate(p.id)}>
                    Duplicate
                  </Button>
                  <Button variant="ghost" onClick={() => remove(p.id)}>
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </section>

      {editing && (
        <EditProgramModal
          program={editing}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
    </main>
  );
}

function EditProgramModal({
  program,
  onCancel,
  onSave,
}: {
  program: Program;
  onCancel: () => void;
  onSave: (updated: Program) => void;
}) {
  const [name, setName] = useState(program.name);
  const [tzOffset, setTzOffset] = useState(program.tzOffset);
  const [date, setDate] = useState(program.anchorDate ?? todayInOffset(program.tzOffset));
  const [time, setTime] = useState(program.anchorTime ?? defaultTime());
  const [recurrence, setRecurrence] = useState<Recurrence>(program.recurrence ?? "none");

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!window.confirm("Save changes to this program?")) return;
    const items = program.items.map((it, i) =>
      i === 0 ? { ...it, startTime: time } : it,
    );
    onSave({
      ...program,
      name: trimmed,
      tzOffset,
      anchorDate: date,
      anchorTime: time,
      recurrence,
      items,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-4 text-lg font-medium">Edit program</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Time</Label>
            <TimeField value={time} onCommit={setTime} />
          </div>
          <div>
            <Label>Recurrence</Label>
            <Select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            >
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
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
