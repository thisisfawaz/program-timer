"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  computeEffectiveItems,
  formatCountdown,
  formatOffset,
} from "@/lib/schedule";
import { writeLive } from "@/lib/live";
import { useHeartbeat } from "@/lib/useHeartbeat";
import { HeartbeatDot } from "@/components/HeartbeatDot";
import { useClock } from "@/lib/useClock";
import { useLiveState, useProgram } from "@/lib/useStore";

export default function LivePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const program = useProgram(id);
  const live = useLiveState(id, 250);

  const tzOffset = program?.tzOffset ?? 0;
  const clock = useClock(tzOffset);

  // While this page is open, keep the live heartbeat alive.
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

  /**
   * useLiveState already derives remaining = anchorMs - now from the shared
   * anchor, so we display it directly (no extra subtraction, which used to make
   * the countdown run away). A local tick keeps it smooth between polls.
   */
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id2 = window.setInterval(() => forceTick((n) => n + 1), 250);
    return () => window.clearInterval(id2);
  }, []);
  const remainingSec = live.itemIndex === null ? 0 : live.remainingSec;

  const red = current !== null && live.itemIndex !== null && remainingSec <= 0;

  /**
   * Select an item from the fullscreen page and restart it (full effective
   * duration from now), matching the control view's navigation behavior.
   */
  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      const seconds = item.effectiveDurationMin * 60;
      // Write the shared anchor shape so every device (and the control engine)
      // picks it up.
      writeLive(id, {
        itemIndex: index,
        running: true,
        anchorMs: Date.now() + seconds * 1000,
      }).catch(() => {
        /* ignore */
      });
    },
    [id, items],
  );

  const goPrev = useCallback(() => {
    const idx = live.itemIndex;
    if (idx === null) {
      // Nothing selected yet: enter at the first item.
      if (items.length > 0) selectItem(0);
      return;
    }
    if (idx > 0) selectItem(idx - 1);
  }, [live.itemIndex, items.length, selectItem]);

  const goNext = useCallback(() => {
    const idx = live.itemIndex;
    if (idx === null) {
      // Nothing selected yet: enter at the first item.
      if (items.length > 0) selectItem(0);
      return;
    }
    if (idx + 1 < items.length) selectItem(idx + 1);
  }, [live.itemIndex, items.length, selectItem]);

  // Up/Down and Left/Right arrow keys change items.
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
        {red && (
          <p className="text-lg font-medium text-red-400">
            Time is up — restart from the control screen.
          </p>
        )}
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
        {red && <span className="text-red-400">Item past its scheduled time</span>}
        <span>{items.length} items</span>
      </footer>
    </main>
  );
}
