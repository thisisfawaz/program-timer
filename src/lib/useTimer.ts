"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EffectiveItem } from "./types";
import { readLive, writeLive } from "./live";

export interface TimerApi {
  itemIndex: number | null;
  remainingSec: number;
  running: boolean;
  paused: boolean;
  red: boolean;
  mode: "A" | "B";
  newEndMin: number | null;
  setMode: (m: "A" | "B") => void;
  start: (index: number) => void;
  select: (index: number) => void;
  next: () => void;
  prev: () => void;
  restart: () => void;
  togglePause: () => void;
  stop: () => void;
}

export function useTimer(
  programId: string,
  items: EffectiveItem[],
  tzOffset: number,
  initialMode: "A" | "B" = "A",
): TimerApi {
  const [mode, setModeState] = useState<"A" | "B">(initialMode);
  const [itemIndex, setItemIndex] = useState<number | null>(null);
  const [, forceTick] = useState(0);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const itemIndexRef = useRef<number | null>(null);

  const clocksRef = useRef<Record<number, number>>({});
  const pausedRef = useRef<Record<number, number>>({});
  /** Mode A: settled actual minutes per item (written only when passed forward). */
  const overrunsRef = useRef<Record<number, number>>({});
  /** When the *current view* began (ms) — used only to settle on forward pass. */
  const enteredAtRef = useRef<number | null>(null);
  const enteredItemRef = useRef<number | null>(null);

  const lastPublishedRef = useRef(0);
  /** Signature of the last payload we wrote — used to ignore our own echo. */
  const lastSentSigRef = useRef("");

  const signature = (idx: number | null, clocks: Record<number, number>, overruns: Record<number, number>) =>
    JSON.stringify({ idx, clocks, overruns });

  /**
   * Epoch ms for an item's scheduled END time today, in the program's fixed
   * GMT offset. Used only for the FIRST item, so its countdown is anchored to
   * when the program is supposed to start/end. All later items run their full
   * duration from the moment they are started.
   */
  const scheduledEndMs = useCallback(
    (idx: number): number | null => {
      const item = itemsRef.current[idx];
      if (!item) return null;
      const nowProgMs = Date.now() + tzOffset * 3600_000;
      const d = new Date(nowProgMs);
      const midnightProgMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      const midnightEpochMs = midnightProgMs - tzOffset * 3600_000;
      return midnightEpochMs + item.endsAtMin * 60_000;
    },
    [tzOffset],
  );

  const publish = useCallback(() => {
    if (!programId) return;
    lastPublishedRef.current = Date.now();
    lastSentSigRef.current = signature(
      itemIndexRef.current,
      clocksRef.current,
      overrunsRef.current,
    );
    writeLive(programId, {
      itemIndex: itemIndexRef.current,
      clocks: clocksRef.current,
      paused: pausedRef.current,
      overruns: overrunsRef.current,
    }).catch(() => {});
  }, [programId]);

  /** Settle the current item's ACTUAL elapsed once, when passing forward. */
  const settleCurrent = useCallback(() => {
    const idx = enteredItemRef.current;
    const since = enteredAtRef.current;
    if (idx === null || since === null) return;
    if (overrunsRef.current[idx] !== undefined) return; // already settled
    overrunsRef.current[idx] = (Date.now() - since) / 60_000;
  }, []);

  /** Deficit carried from the previous item (minutes), Mode A only. */
  const deficitBefore = useCallback((idx: number): number => {
    if (modeRef.current !== "A" || idx <= 0) return 0;
    const prev = itemsRef.current[idx - 1];
    const prevActual = overrunsRef.current[idx - 1];
    if (!prev || prevActual === undefined) return 0;
    return Math.max(0, prevActual - prev.effectiveDurationMin);
  }, []);

  /** Duration (minutes) an item gets when started. */
  const durationFor = useCallback(
    (idx: number): number => {
      const item = itemsRef.current[idx];
      if (!item) return 0;
      return Math.max(0, item.effectiveDurationMin - deficitBefore(idx));
    },
    [deficitBefore],
  );

  const remainingFor = useCallback(
    (idx: number): number => {
      if (pausedRef.current[idx] !== undefined) return pausedRef.current[idx];
      const anchor = clocksRef.current[idx];
      if (anchor === undefined) return durationFor(idx) * 60;
      return (anchor - Date.now()) / 1000;
    },
    [durationFor],
  );

  const tick = useCallback(() => forceTick((n) => n + 1), []);
  useEffect(() => {
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [tick]);

  useEffect(() => {
    if (!programId) return;
    let active = true;
    const adopt = async () => {
      try {
        const ext = await readLive(programId);
        if (!active) return;
        // Ignore our own echo: if the remote doc matches what we last published,
        // don't clobber local state (which was causing buttons to be overwritten).
        const sig = signature(ext.itemIndex, ext.clocks ?? {}, ext.overruns ?? {});
        if (sig === lastSentSigRef.current) return;
        clocksRef.current = ext.clocks ?? {};
        pausedRef.current = ext.paused ?? {};
        overrunsRef.current = ext.overruns ?? {};
        if (ext.itemIndex !== itemIndexRef.current) {
          itemIndexRef.current = ext.itemIndex;
          setItemIndex(ext.itemIndex);
        }
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(adopt, 1500);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [programId]);

  /**
   * Give an item a clock if it doesn't have one yet.
   *
   * The FIRST item is anchored to its scheduled end (program start time), so
   * pressing Play late shows less than the full duration and pressing early
   * shows more — it counts down to when the program is supposed to start.
   *
   * Every other item runs its FULL duration from the moment it is started,
   * regardless of the clock. Leftover/saved time is never carried forward;
   * the only reduction is Mode A's previous-item overrun (via durationFor).
   */
  const armClock = useCallback(
    (index: number) => {
      if (clocksRef.current[index] !== undefined) return;
      if (index === 0) {
        const end = scheduledEndMs(0);
        clocksRef.current[index] =
          end !== null ? end : Date.now() + durationFor(index) * 60_000;
      } else {
        clocksRef.current[index] = Date.now() + durationFor(index) * 60_000;
      }
      delete pausedRef.current[index];
    },
    [scheduledEndMs, durationFor],
  );

  const start = useCallback(
    (index: number) => {
      if (index < 0 || index >= itemsRef.current.length) return;
      // Pressing Play on the item we're already on is a no-op (do NOT re-settle
      // or re-arm — doing so banked an overrun onto the item and collapsed its
      // own clock, showing a big negative).
      if (index === itemIndexRef.current) return;
      // Passing forward: settle the item we're leaving (only when moving forward).
      const cur = itemIndexRef.current;
      if (cur !== null && index > cur) settleCurrent();
      itemIndexRef.current = index;
      setItemIndex(index);
      enteredItemRef.current = index;
      enteredAtRef.current = Date.now();
      armClock(index);
      publish();
    },
    [settleCurrent, armClock, publish],
  );

  const select = useCallback(
    (index: number) => {
      if (index < 0 || index >= itemsRef.current.length) return;
      // View change only. No-op if it's already the current item.
      if (index === itemIndexRef.current) return;
      itemIndexRef.current = index;
      setItemIndex(index);
      enteredItemRef.current = index;
      enteredAtRef.current = Date.now();
      armClock(index);
      publish();
    },
    [armClock, publish],
  );

  const next = useCallback(() => {
    const idx = itemIndexRef.current;
    if (idx === null) {
      if (itemsRef.current.length > 0) start(0);
      return;
    }
    if (idx + 1 < itemsRef.current.length) start(idx + 1);
  }, [start]);

  const prev = useCallback(() => {
    const idx = itemIndexRef.current;
    if (idx === null || idx <= 0) return;
    select(idx - 1);
  }, [select]);

  const restart = useCallback(() => {
    const idx = itemIndexRef.current;
    if (idx === null) return;
    const item = itemsRef.current[idx];
    if (!item) return;
    // Restart clears this item's settled overrun and gives a fresh full clock.
    delete overrunsRef.current[idx];
    delete pausedRef.current[idx];
    clocksRef.current[idx] = Date.now() + item.effectiveDurationMin * 60_000;
    enteredItemRef.current = idx;
    enteredAtRef.current = Date.now();
    publish();
  }, [publish]);

  const togglePause = useCallback(() => {
    const idx = itemIndexRef.current;
    if (idx === null) return;
    if (pausedRef.current[idx] !== undefined) {
      const rem = pausedRef.current[idx];
      delete pausedRef.current[idx];
      clocksRef.current[idx] = Date.now() + rem * 1000;
    } else {
      pausedRef.current[idx] = remainingFor(idx);
    }
    publish();
  }, [publish, remainingFor]);

  const stop = useCallback(() => {
    // Reset everything to scratch for both modes: clear per-item clocks,
    // paused seconds, and settled actuals/overruns, so every item restarts
    // from its full effective duration and the projected end reverts to plan.
    clocksRef.current = {};
    pausedRef.current = {};
    overrunsRef.current = {};
    enteredAtRef.current = null;
    enteredItemRef.current = null;
    itemIndexRef.current = null;
    setItemIndex(null);
    publish();
  }, [publish]);

  const setMode = useCallback((m: "A" | "B") => {
    setModeState(m);
    modeRef.current = m;
  }, []);

  const remainingSec = itemIndex !== null ? remainingFor(itemIndex) : 0;
  const paused = itemIndex !== null && pausedRef.current[itemIndex] !== undefined;
  const red = itemIndex !== null && remainingSec <= 0;

  // Projected end = planned end - savings (settled items that finished early).
  const plannedEnd = items.length ? items[items.length - 1].endsAtMin : null;
  let savings = 0;
  for (let i = 0; i < items.length; i++) {
    const actual = overrunsRef.current[i];
    if (actual !== undefined) {
      const save = items[i].effectiveDurationMin - actual;
      if (save > 0) savings += save;
    }
  }
  const newEndMin = plannedEnd !== null ? plannedEnd - savings : null;

  return {
    itemIndex,
    remainingSec,
    running: itemIndex !== null && !paused,
    paused,
    red,
    mode,
    newEndMin,
    setMode,
    start,
    select,
    next,
    prev,
    restart,
    togglePause,
    stop,
  };
}
