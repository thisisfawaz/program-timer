"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EffectiveItem } from "./types";
import { readLive, writeLive } from "./live";

export interface TimerApi {
  itemIndex: number | null;
  remainingSec: number;
  started: boolean;
  running: boolean;
  overtime: boolean;
  start: (index: number) => void;
  togglePause: () => void;
  stop: () => void;
  restart: () => void;
  currentTime: () => void;
  addMinutes: (minutes: number) => void;
}

/**
 * Schedule-aware timer with cross-device sync.
 *
 * The running state (item + anchor end time + running flag) is published to
 * Supabase on every state change. Other devices read the anchor and compute the
 * countdown locally, so Control and Live stay in sync across machines.
 */
export function useTimer(
  programId: string,
  items: EffectiveItem[],
  tzOffset: number,
): TimerApi {
  const [itemIndex, setItemIndex] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);

  const itemIndexRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const anchorRef = useRef<number | null>(null);
  const pausedRef = useRef<number>(0);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const tzRef = useRef(tzOffset);
  tzRef.current = tzOffset;
  // Track last published updatedAt so we don't adopt our own writes.
  const lastPublishedRef = useRef<number>(0);

  /** Publish current state to Supabase (anchor when running, value when paused). */
  const publish = useCallback(
    (
      index: number | null,
      isRunning: boolean,
      anchorMs: number | null,
      pausedRemainingSec: number | null = null,
    ) => {
      if (!programId) return;
      lastPublishedRef.current = Date.now();
      writeLive(programId, {
        itemIndex: index,
        running: isRunning,
        anchorMs,
        pausedRemainingSec,
      }).catch(() => {
        /* ignore */
      });
    },
    [programId],
  );

  const midnightMs = useCallback((): number => {
    const tz = tzRef.current;
    const now = Date.now();
    const local = new Date(now + tz * 3600_000);
    const midnightUtc = Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
    );
    return midnightUtc - tz * 3600_000;
  }, []);

  const startMs = useCallback(
    (index: number): number | null => {
      const item = itemsRef.current[index];
      if (!item) return null;
      return midnightMs() + item.effectiveStartMin * 60_000;
    },
    [midnightMs],
  );

  const endMs = useCallback(
    (index: number): number | null => {
      const item = itemsRef.current[index];
      if (!item) return null;
      return midnightMs() + item.endsAtMin * 60_000;
    },
    [midnightMs],
  );

  const compute = useCallback((): { secs: number; started: boolean } => {
    const idx = itemIndexRef.current;
    if (idx === null) return { secs: 0, started: false };
    const item = itemsRef.current[idx];
    if (!item) return { secs: 0, started: false };

    if (anchorRef.current !== null) {
      if (!runningRef.current) return { secs: pausedRef.current, started: true };
      return { secs: (anchorRef.current - Date.now()) / 1000, started: true };
    }

    const sMs = startMs(idx);
    const eMs = endMs(idx);
    if (sMs === null || eMs === null) return { secs: 0, started: false };

    const now = Date.now();
    if (now < sMs) {
      return { secs: item.effectiveDurationMin * 60, started: false };
    }
    if (!runningRef.current) return { secs: pausedRef.current, started: true };
    return { secs: (eMs - now) / 1000, started: true };
  }, [startMs, endMs]);

  /** Tick: recompute locally (no publish). */
  const sync = useCallback(() => {
    const idx = itemIndexRef.current;
    if (idx === null) return;
    const { secs, started: st } = compute();
    setRemainingSec(secs);
    setStarted(st);
    setRunning(st && runningRef.current);
  }, [compute]);

  useEffect(() => {
    const id = window.setInterval(sync, 250);
    return () => window.clearInterval(id);
  }, [sync]);

  /** Adopt external changes (from other devices) via polling + realtime-less read. */
  useEffect(() => {
    if (!programId) return;
    let active = true;
    const adopt = async () => {
      try {
        const external = await readLive(programId);
        if (!active) return;
        // Ignore our own recent write.
        if (external.updatedAt <= lastPublishedRef.current) return;
        if (
          external.itemIndex !== null &&
          (external.itemIndex < 0 || external.itemIndex >= itemsRef.current.length)
        )
          return;
        // Adopt any external state newer than our last publish. (The old
        // "sameAnchor" shortcut compared against local refs that are null for
        // schedule-derived items, which made a device adopt its own echo and
        // broke Current time.)
        itemIndexRef.current = external.itemIndex;
        runningRef.current = external.running;
        anchorRef.current = external.anchorMs;
        // Paused: use the stored value. Running: paused value unused.
        pausedRef.current = !external.running ? (external.pausedRemainingSec ?? 0) : 0;
        setItemIndex(external.itemIndex);
        const { secs, started: st } = compute();
        setRemainingSec(secs);
        setStarted(st);
        setRunning(st && external.running);
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(adopt, 1500);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [programId, compute]);

  const start = useCallback(
    (index: number) => {
      if (index < 0 || index >= itemsRef.current.length) return;
      const item = itemsRef.current[index];
      if (!item) return;
      const seconds = item.effectiveDurationMin * 60;
      const anchor = Date.now() + seconds * 1000;
      itemIndexRef.current = index;
      anchorRef.current = anchor;
      runningRef.current = true;
      pausedRef.current = 0;
      setItemIndex(index);
      setStarted(true);
      setRunning(true);
      setRemainingSec(seconds);
      publish(index, true, anchor);
    },
    [publish],
  );

  const currentTime = useCallback(() => {
    const idx = itemIndexRef.current;
    if (idx === null) return;
    const item = itemsRef.current[idx];
    if (!item) return;

    // Compare the REAL clock (in program minutes) against the item's schedule,
    // instead of reconstructing timestamps from "today's midnight" (which broke
    // when the program's anchor date/time differed).
    const now = Date.now();
    const nowMin =
      new Date(now + tzRef.current * 3600_000).getUTCHours() * 60 +
      new Date(now + tzRef.current * 3600_000).getUTCMinutes() +
      new Date(now + tzRef.current * 3600_000).getUTCSeconds() / 60;

    if (nowMin < item.effectiveStartMin) {
      // Scheduled start not reached: restart from full duration now.
      const seconds = item.effectiveDurationMin * 60;
      const anchor = now + seconds * 1000;
      anchorRef.current = anchor;
      runningRef.current = true;
      pausedRef.current = 0;
      setStarted(true);
      setRunning(true);
      setRemainingSec(seconds);
      publish(idx, true, anchor);
      return;
    }

    // Scheduled start has arrived: snap to the real schedule. Anchor the live
    // end to (now + scheduledEnd - nowMinutes), so it counts to the scheduled end.
    const remainingSec = (item.endsAtMin - nowMin) * 60;
    const anchor = now + remainingSec * 1000;
    anchorRef.current = anchor;
    runningRef.current = true;
    pausedRef.current = 0;
    setStarted(true);
    setRunning(true);
    setRemainingSec(remainingSec);
    publish(idx, true, anchor);
  }, [publish]);

  const togglePause = useCallback(() => {
    if (itemIndexRef.current === null) return;
    if (runningRef.current) {
      const { secs } = compute();
      pausedRef.current = secs;
      runningRef.current = false;
      // Freeze at "now + remaining" so every device shows the paused time
      // (publishing a null anchor for schedule-derived items showed 00:00).
      anchorRef.current = null;
      setRunning(false);
      setRemainingSec(secs);
      publish(itemIndexRef.current, false, null, secs);
    } else {
      const { secs } = compute();
      runningRef.current = true;
      const resumeAnchor = Date.now() + secs * 1000;
      anchorRef.current = resumeAnchor;
      setRunning(true);
      setRemainingSec(secs);
      publish(itemIndexRef.current, true, resumeAnchor, null);
    }
    sync();
  }, [compute, publish, sync]);

  const stop = useCallback(() => {
    itemIndexRef.current = null;
    runningRef.current = false;
    anchorRef.current = null;
    pausedRef.current = 0;
    setItemIndex(null);
    setStarted(false);
    setRunning(false);
    setRemainingSec(0);
    publish(null, false, null);
  }, [publish]);

  const restart = useCallback(() => {
    const idx = itemIndexRef.current;
    if (idx === null) return;
    const item = itemsRef.current[idx];
    if (!item) return;
    const seconds = item.effectiveDurationMin * 60;
    const anchor = Date.now() + seconds * 1000;
    anchorRef.current = anchor;
    runningRef.current = true;
    setStarted(true);
    setRunning(true);
    setRemainingSec(seconds);
    publish(idx, true, anchor);
  }, [publish]);

  const addMinutes = useCallback(
    (minutes: number) => {
      const idx = itemIndexRef.current;
      if (idx === null || minutes === 0) return;
      const deltaSec = minutes * 60;
      if (runningRef.current) {
        const { secs } = compute();
        anchorRef.current = Date.now() + (secs + deltaSec) * 1000;
        publish(idx, true, anchorRef.current);
      } else {
        pausedRef.current += deltaSec;
        publish(idx, false, anchorRef.current);
      }
      sync();
    },
    [compute, publish, sync],
  );

  const overtime = itemIndex !== null && started && remainingSec <= 0;

  return {
    itemIndex,
    remainingSec,
    started,
    running,
    overtime,
    start,
    togglePause,
    stop,
    restart,
    currentTime,
    addMinutes,
  };
}
