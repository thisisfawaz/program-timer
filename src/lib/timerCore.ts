"use client";

import type { EffectiveItem } from "./types";

/**
 * Pure timer logic shared by the Control timer and the Live mirror.
 *
 * A "TimerState" is the whole running picture: which item is current, each
 * item's clock end (ms), each item's paused remaining (seconds), and the
 * settled overruns (minutes past an item's end). Both pages build one of
 * these and call the same functions, so a move behaves identically no matter
 * which screen triggered it.
 */
export interface TimerState {
  itemIndex: number | null;
  mode: "A" | "B";
  clocks: Record<number, number>;
  paused: Record<number, number>;
  overruns: Record<number, number>;
}

/** Epoch ms for an item's scheduled END today, in the program's fixed offset. */
export function scheduledEndMs(
  item: EffectiveItem | undefined,
  tzOffset: number,
  now: number = Date.now(),
): number | null {
  if (!item) return null;
  const nowProgMs = now + tzOffset * 3600_000;
  const d = new Date(nowProgMs);
  const midnightProgMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const midnightEpochMs = midnightProgMs - tzOffset * 3600_000;
  return midnightEpochMs + item.endsAtMin * 60_000;
}

/**
 * Deficit carried from the IMMEDIATELY previous item only (Mode A).
 * overruns[prev] is minutes past that item's end: positive = it overran, so
 * the next item is shortened by that much. One step — never chains.
 */
export function deficitBefore(
  items: EffectiveItem[],
  state: TimerState,
  idx: number,
): number {
  if (state.mode !== "A" || idx <= 0) return 0;
  const pastEnd = state.overruns[idx - 1];
  if (pastEnd === undefined) return 0;
  return Math.max(0, pastEnd);
}

/** Duration (minutes) an item gets when started. */
export function durationFor(
  items: EffectiveItem[],
  state: TimerState,
  idx: number,
): number {
  const item = items[idx];
  if (!item) return 0;
  return Math.max(0, item.effectiveDurationMin - deficitBefore(items, state, idx));
}

/**
 * Settle the current item's overrun once (minutes past its clock end).
 * Measured from the clock, so it cannot be reset by re-entering or pausing.
 */
export function settle(
  items: EffectiveItem[],
  state: TimerState,
  idx: number,
  now: number = Date.now(),
): TimerState {
  if (idx < 0) return state;
  if (state.overruns[idx] !== undefined) return state;
  const anchor = state.clocks[idx];
  let pastEnd: number;
  if (anchor !== undefined) {
    pastEnd = (now - anchor) / 60_000;
  } else {
    const dur = items[idx]?.effectiveDurationMin ?? 0;
    pastEnd = -dur;
  }
  return { ...state, overruns: { ...state.overruns, [idx]: pastEnd } };
}

/** Give an item a clock if it doesn't have one yet. */
export function armClock(
  items: EffectiveItem[],
  state: TimerState,
  idx: number,
  tzOffset: number,
  now: number = Date.now(),
): TimerState {
  if (state.clocks[idx] !== undefined) return state;
  let anchor: number;
  if (idx === 0) {
    const end = scheduledEndMs(items[0], tzOffset, now);
    anchor = end !== null ? end : now + durationFor(items, state, idx) * 60_000;
  } else {
    anchor = now + durationFor(items, state, idx) * 60_000;
  }
  const paused = { ...state.paused };
  delete paused[idx];
  return { ...state, clocks: { ...state.clocks, [idx]: anchor }, paused };
}

/**
 * Move to an item the way Control does. When moving FORWARD, the item we are
 * leaving is settled (its overrun recorded) and the target's clock is cleared
 * so it re-arms using durationFor — applying Mode A's one-step deduction.
 */
export function moveTo(
  items: EffectiveItem[],
  state: TimerState,
  index: number,
  tzOffset: number,
  now: number = Date.now(),
): TimerState {
  if (index < 0 || index >= items.length) return state;
  if (index === state.itemIndex) return state;

  let next = state;
  const cur = state.itemIndex;
  const forward = cur !== null && index > cur;

  if (forward) {
    // Settle the item we are leaving (its clock-based overrun).
    next = settle(items, next, cur as number, now);
  }

  const clocks = { ...next.clocks };
  const paused = { ...next.paused };
  if (forward) {
    // Force the target to re-arm with the (possibly reduced) duration.
    delete clocks[index];
    delete paused[index];
  }

  next = { ...next, itemIndex: index, clocks, paused };
  next = armClock(items, next, index, tzOffset, now);
  return next;
}
