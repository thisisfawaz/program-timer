"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { computeEffectiveItems, formatCountdown, formatOffset } from "@/lib/schedule";
import { readLive, writeLive } from "@/lib/live";
import { useHeartbeat } from "@/lib/useHeartbeat";
import { HeartbeatDot } from "@/components/HeartbeatDot";
import { useClock } from "@/lib/useClock";
import { useLiveState, useProgram } from "@/lib/useStore";

export default function LivePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const program = useProgram(id);
  const live = useLiveState(id, 500);

  const tzOffset = program?.tzOffset ?? 0;
  const clock = useClock(tzOffset);
  useHeartbeat(id, "live");

  const items = useMemo(
    () => computeEffectiveItems(program?.items ?? []),
    [program?.items],
  );

  const current = live.itemIndex !== null ? (items[live.itemIndex] ?? null) : null;
  const previous =
    live.itemIndex !== null && live.itemIndex > 0 ? items[live.itemIndex - 1] : null;
  const next =
    live.itemIndex !== null && live.itemIndex + 1 < items.length
      ? items[live.itemIndex + 1]
      : null;

  // Smooth local tick.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => forceTick((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, []);

  // Remaining time, derived from the SAME live doc the Control view publishes:
  // paused seconds if paused, otherwise the item's clock anchor (its end time).
  // Mirrors Control exactly, so both screens always agree.
  const remainingSec = useMemo(() => {
    if (live.itemIndex === null || !current) return 0;
    const idx = live.itemIndex;
    if (live.paused[idx] !== undefined) return live.paused[idx];
    const anchor = live.clocks[idx];
    if (anchor === undefined) return current.effectiveDurationMin * 60;
    return (anchor - Date.now()) / 1000;
  }, [live.itemIndex, live.clocks, live.paused, current]);

  const red = current !== null && remainingSec <= 0;

  /** Write a selection to the shared doc (arrows). */
  const writeSelection = useCallback(
    async (index: number) => {
      const doc = await readLive(id).catch(() => null);
      const clocks = doc?.clocks ?? {};
      const paused = doc?.paused ?? {};
      // In Mode B, entering an item with no clock starts it fresh.
      const item = items[index];
      if (item && clocks[index] === undefined && paused[index] === undefined) {
        clocks[index] = Date.now() + item.effectiveDurationMin * 60_000;
      }
      writeLive(id, { itemIndex: index, clocks, paused }).catch(() => {});
    },
    [id, items],
  );

  const goPrev = useCallback(() => {
    const idx = live.itemIndex;
    if (idx === null) {
      if (items.length > 0) writeSelection(0);
      return;
    }
    if (idx > 0) writeSelection(idx - 1);
  }, [live.itemIndex, items.length, writeSelection]);

  const goNext = useCallback(() => {
    const idx = live.itemIndex;
    if (idx === null) {
      if (items.length > 0) writeSelection(0);
      return;
    }
    if (idx + 1 < items.length) writeSelection(idx + 1);
  }, [live.itemIndex, items.length, writeSelection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  if (!program) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-neutral-950">
      <HeartbeatDot />
      <header className="flex items-center justify-between px-8 py-6">
        <p className="text-sm font-medium uppercase tracking-widest text-white/70">
          {program.name}
        </p>
        <p className="tnum text-xl text-white/80">{clock}</p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="min-h-[1.25rem] text-xs uppercase tracking-widest text-white/40">
          {previous ? previous.name : "\u00A0"}
        </p>
        <p className="text-3xl font-medium text-white/90 sm:text-4xl">
          {current ? current.name || "Untitled item" : "No item selected"}
        </p>
        <p
          className={`tnum text-[24vw] font-bold leading-none sm:text-[20vw] ${
            red ? "text-red-500" : "text-white"
          }`}
        >
          {current ? formatCountdown(remainingSec) : "--:--"}
        </p>
        <p className="min-h-[1.25rem] text-xs uppercase tracking-widest text-white/40">
          {next ? next.name : "\u00A0"}
        </p>
      </div>

      <div className="flex items-center justify-center gap-4 pb-4">
        <button
          onClick={goPrev}
          className="rounded-full bg-neutral-800 px-6 py-3 text-2xl text-white hover:bg-neutral-700 disabled:opacity-30"
          disabled={items.length === 0 || (live.itemIndex !== null && live.itemIndex <= 0)}
          aria-label="Previous item"
        >
          ‹
        </button>
        <button
          onClick={goNext}
          className="rounded-full bg-neutral-800 px-6 py-3 text-2xl text-white hover:bg-neutral-700 disabled:opacity-30"
          disabled={
            items.length === 0 ||
            (live.itemIndex !== null && live.itemIndex + 1 >= items.length)
          }
          aria-label="Next item"
        >
          ›
        </button>
      </div>

      <footer className="flex items-center justify-between px-8 py-6 text-xs uppercase tracking-widest text-white/50">
        <span>{formatOffset(program.tzOffset)}</span>
        <span>{live.mode === "A" ? "End on time" : "Full duration"}</span>
        <span>{items.length} items</span>
      </footer>
    </main>
  );
}
