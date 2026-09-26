"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { computeEffectiveItems, formatCountdown, formatOffset } from "@/lib/schedule";
import { useHeartbeat } from "@/lib/useHeartbeat";
import { HeartbeatDot } from "@/components/HeartbeatDot";
import { useClock } from "@/lib/useClock";
import { useLiveState, useProgram } from "@/lib/useStore";
import { readLive, writeLive } from "@/lib/live";
import { moveTo, type TimerState } from "@/lib/timerCore";

export default function LivePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const program = useProgram(id);

  const tzOffset = program?.tzOffset ?? 0;
  const clock = useClock(tzOffset);
  useHeartbeat(id, "live");

  const items = useMemo(
    () => computeEffectiveItems(program?.items ?? []),
    [program?.items],
  );

  // Live is a mirror of the shared live doc that Control publishes, so the
  // displayed countdown is always identical to Control. The arrows below move
  // the timer by running the SAME shared move logic Control uses (timerCore)
  // on the published doc, then writing the result back — so a move from Live
  // changes Control the correct way, with no second timer.
  const live = useLiveState(id, 500);

  const idx = live.itemIndex;
  const current = idx !== null ? (items[idx] ?? null) : null;
  const previous = idx !== null && idx > 0 ? items[idx - 1] : null;
  const nextItem = idx !== null && idx + 1 < items.length ? items[idx + 1] : null;

  // Smooth local tick so the countdown updates between published changes.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => forceTick((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, []);

  // Remaining = paused value if paused, otherwise the published clock − now.
  // Control already baked modes/overruns into the clock it published, so the
  // mirror simply counts down to it — identical to Control by construction.
  const remainingSec = useMemo(() => {
    if (idx === null) return 0;
    if (live.paused[idx] !== undefined) return live.paused[idx];
    const anchor = live.clocks[idx];
    if (anchor === undefined) return 0;
    return (anchor - Date.now()) / 1000;
  }, [idx, live.paused, live.clocks]);

  const red = idx !== null && remainingSec <= 0;

  // Move the shared timer by one item, using the same logic as Control.
  const moveBy = useCallback(
    async (delta: number) => {
      if (!id) return;
      const doc = await readLive(id).catch(() => null);
      const state: TimerState = {
        itemIndex: doc?.itemIndex ?? null,
        mode: doc?.mode ?? (program?.mode ?? "B"),
        clocks: doc?.clocks ?? {},
        paused: doc?.paused ?? {},
        overruns: doc?.overruns ?? {},
      };
      const target =
        state.itemIndex === null ? 0 : state.itemIndex + delta;
      if (target < 0 || target >= items.length) return;
      const next = moveTo(items, state, target, tzOffset);
      await writeLive(id, {
        itemIndex: next.itemIndex,
        mode: next.mode,
        clocks: next.clocks,
        paused: next.paused,
        overruns: next.overruns,
      }).catch(() => {});
    },
    [id, items, tzOffset, program?.mode],
  );

  // Keyboard arrows mirror the buttons.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        moveBy(-1);
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        moveBy(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveBy]);

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
          {nextItem ? nextItem.name : "\u00A0"}
        </p>
      </div>

      <div className="flex items-center justify-center gap-4 pb-4">
        <button
          onClick={() => moveBy(-1)}
          className="rounded-full bg-neutral-800 px-6 py-3 text-2xl text-white hover:bg-neutral-700 disabled:opacity-30"
          disabled={items.length === 0 || (idx !== null && idx <= 0)}
          aria-label="Previous item"
        >
          ‹
        </button>
        <button
          onClick={() => moveBy(1)}
          className="rounded-full bg-neutral-800 px-6 py-3 text-2xl text-white hover:bg-neutral-700 disabled:opacity-30"
          disabled={items.length === 0 || (idx !== null && idx + 1 >= items.length)}
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
