"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { EffectiveItem } from "@/lib/types";
import {
  TZ_OFFSETS,
  computeEffectiveItems,
  formatDuration,
  formatMinToTime,
  formatOffset,
  minutesSinceMidnightInOffset,
} from "@/lib/schedule";
import { updateProgram } from "@/lib/programs";
import { emitProgramChanged } from "@/lib/useStore";
import { getActiveState, type ActiveState } from "@/lib/active";
import { useClock } from "@/lib/useClock";
import { useProgram } from "@/lib/useStore";
import { useTimer } from "@/lib/useTimer";
import { useHeartbeat } from "@/lib/useHeartbeat";
import { HeartbeatDot } from "@/components/HeartbeatDot";
import { Button, Card, Label, Select } from "@/components/ui";
import { TimerPanel } from "@/components/TimerPanel";
import { ScheduleEditor } from "@/components/ScheduleEditor";

export default function ControlPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const program = useProgram(id);

  const tzOffset = program?.tzOffset ?? 0;
  const clock = useClock(tzOffset);

  const items = useMemo(
    () => computeEffectiveItems(program?.items ?? []),
    [program?.items],
  );

  const timer = useTimer(id, items, tzOffset);

  // While this page is open, keep the control heartbeat alive.
  useHeartbeat(id, "control");

  // Live status for the Go live button (open = green, closed = amber, off = white).
  const [liveState, setLiveState] = useState<ActiveState>("off");
  useEffect(() => {
    if (!id) return;
    const refresh = async () => setLiveState(await getActiveState(id, "live"));
    refresh();
    const t = window.setInterval(refresh, 4000);
    window.addEventListener("timer-active-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("timer-active-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [id]);

  // Editable program name.
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const startEditName = () => {
    if (!program) return;
    setNameDraft(program.name);
    setEditingName(true);
  };
  const commitName = () => {
    if (!program) return;
    const next = nameDraft.trim();
    setEditingName(false);
    if (!next || next === program.name) return;
    if (window.confirm("Save name change?")) {
      updateProgram({ ...program, name: next }).then(emitProgramChanged);
    }
  };

  const nowMin = minutesSinceMidnightInOffset(tzOffset);

  const persistItems = useCallback(
    (next: typeof items) => {
      if (!program) return;
      updateProgram({
        ...program,
        items: next.map(({ id, name, startTime, durationMin, addedMin }) => ({
          id,
          name,
          startTime,
          durationMin,
          addedMin,
        })),
      }).then(emitProgramChanged);
    },
    [program],
  );

  /* ----------------------------- item mutations ---------------------------- */

  const makeBlankItem = (startTime: string): EffectiveItem => ({
    id: Math.random().toString(36).slice(2, 10),
    name: "New item",
    startTime,
    durationMin: 10,
    addedMin: 0,
    effectiveStartMin: 0,
    effectiveDurationMin: 10,
    endsAtMin: 0,
  });

  /** Append at the end. The first item defaults to the program's anchor time. */
  const addItem = () => {
    if (!program) return;
    const firstStart = items[0]?.startTime ?? program.anchorTime ?? "09:00";
    persistItems([...items, makeBlankItem(firstStart)]);
  };

  /** Insert a new item directly after the given index, pushing the rest later. */
  const insertAfter = (index: number) => {
    if (!program) return;
    const firstStart = items[0]?.startTime ?? "09:00";
    const next = [...items];
    next.splice(index + 1, 0, makeBlankItem(firstStart));
    persistItems(next);
  };

  const updateItem = (index: number, patch: Partial<EffectiveItem>) => {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    // Editing the first item's start time also updates the program's anchor time,
    // so the program time always reflects the first start time.
    const anchorTime =
      index === 0 && typeof patch.startTime === "string"
        ? patch.startTime
        : program?.anchorTime;
    if (!program) return;
    updateProgram({
      ...program,
      anchorTime,
      items: next.map(({ id, name, startTime, durationMin, addedMin }) => ({
        id,
        name,
        startTime,
        durationMin,
        addedMin,
      })),
    }).then(emitProgramChanged);
  };

  const deleteItem = (index: number) => {
    if (!window.confirm("Delete this item?")) return;
    persistItems(items.filter((_, i) => i !== index));
  };

  /** Reorder items by drag: move the item at `from` to position `to`. */
  const reorder = (from: number, to: number) => {
    if (!program) return;
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length)
      return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistItems(next);
    // Keep the timer pointed at the same physical item after the reorder.
    const playingId = timer.itemIndex !== null ? items[timer.itemIndex]?.id : null;
    if (playingId) {
      const newIndex = next.findIndex((it) => it.id === playingId);
      if (newIndex >= 0 && newIndex !== timer.itemIndex) {
        timer.start(newIndex);
      }
    }
  };

  const addMinutes = (index: number, minutes: number) => {
    const next = items.map((it, i) =>
      i === index ? { ...it, addedMin: it.addedMin + minutes } : it,
    );
    persistItems(next);
    if (timer.itemIndex === index) timer.addMinutes(minutes);
  };

  const resetAdded = (index: number) => {
    const delta = -items[index].addedMin;
    const next = items.map((it, i) => (i === index ? { ...it, addedMin: 0 } : it));
    persistItems(next);
    if (timer.itemIndex === index) timer.addMinutes(delta);
  };

  const setTz = (offset: number) => {
    if (!program) return;
    updateProgram({ ...program, tzOffset: offset }).then(emitProgramChanged);
  };

  /* -------------------------------- derived -------------------------------- */

  const current: EffectiveItem | null =
    timer.itemIndex !== null ? (items[timer.itemIndex] ?? null) : null;
  const hasNext = timer.itemIndex !== null && timer.itemIndex + 1 < items.length;

  // Red when the real program clock has already passed this item's scheduled end,
  // regardless of when it was played, or when the countdown itself went negative.
  const currentPastByClock = current !== null && current.endsAtMin <= nowMin;
  const currentRed =
    current !== null && timer.started && (currentPastByClock || timer.overtime);

  const programEnd = items.length ? items[items.length - 1].endsAtMin : null;
  const programStart = items.length ? items[0].effectiveStartMin : null;
  const programLength =
    programEnd !== null && programStart !== null ? programEnd - programStart : 0;

  /** Start an item, unless it is already the current item (then do nothing). */
  const playItem = (index: number) => {
    if (index === timer.itemIndex) return;
    timer.start(index);
  };

  if (!program) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-neutral-400">Loading program…</p>
        <p className="mt-4 text-xs text-neutral-600">
          If this persists, the program may not exist on this browser.{" "}
          <Link className="underline" href="/">
            Back home
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-10">
      <HeartbeatDot />
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href={program.orgId ? `/org/${program.orgId}` : "/start"}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            {program.orgId ? "← Organization" : "← Home"}
          </Link>
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="mt-1 w-full rounded-lg border border-indigo-500 bg-neutral-900 px-2 py-1 text-2xl font-semibold tracking-tight text-neutral-100 outline-none"
            />
          ) : (
            <h1
              onClick={startEditName}
              title="Click to rename"
              className="mt-1 cursor-text text-2xl font-semibold tracking-tight hover:text-indigo-300"
            >
              {program.name}
            </h1>
          )}
          <p className="text-xs text-neutral-400">
            {formatOffset(program.tzOffset)}
            {program.anchorTime ? ` · starts ${program.anchorTime}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="tnum text-2xl font-semibold">{clock}</span>
          <Link href={`/p/${program.id}/live`} target="_blank" rel="noopener noreferrer">
            <Button variant="subtle" state={liveState}>
              {liveState === "off" ? "Go live" : "Live"}
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Items" value={String(items.length)} />
        <Summary label="Program length" value={items.length ? formatDuration(programLength) : "—"} />
        <Summary
          label="End time"
          value={programEnd !== null ? formatMinToTime(programEnd) : "—"}
        />
        <Summary label="Timezone" value={formatOffset(program.tzOffset)} />
      </div>

      <TimerPanel
        current={current}
        remainingSec={timer.remainingSec}
        started={timer.started}
        running={timer.running}
        red={currentRed}
        onTogglePause={timer.togglePause}
        onRestart={timer.restart}
        onCurrentTime={timer.currentTime}
        onStop={timer.stop}
        onAddMinutes={timer.addMinutes}
        onPickNext={() => {
          if (timer.itemIndex !== null && hasNext) playItem(timer.itemIndex + 1);
        }}
        hasNext={hasNext}
      />

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Schedule</h2>
          <Button variant="primary" onClick={addItem}>
            Add item
          </Button>
        </div>

        <ScheduleEditor
          items={items}
          currentIndex={timer.itemIndex}
          nowMin={nowMin}
          onUpdate={updateItem}
          onDelete={deleteItem}
          onReorder={reorder}
          onInsertAfter={insertAfter}
          onPlay={playItem}
          onAddMinutes={addMinutes}
          onResetAdded={resetAdded}
        />

        <Card className="mt-2">
          <Label>Program timezone offset</Label>
          <Select value={program.tzOffset} onChange={(e) => setTz(Number(e.target.value))}>
            {TZ_OFFSETS.map((o) => (
              <option key={o} value={o}>
                {formatOffset(o)}
              </option>
            ))}
          </Select>
        </Card>
      </section>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="tnum mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
