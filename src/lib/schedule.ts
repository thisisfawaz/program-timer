import type { EffectiveItem, ProgramItem } from "./types";

/** Generate a short random ID. */
export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Parse "HH:MM" into minutes since midnight. Returns null if invalid. */
export function parseTimeToMin(value: string): number | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Format minutes since midnight to "HH:MM" (wraps at 24h). */
export function formatMinToTime(totalMin: number): string {
  const wrapped = ((Math.round(totalMin) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Compute the effective schedule as a flowing timeline.
 *
 * The first item's stored startTime is the program anchor. Every later item
 * begins exactly when the previous one ends, so editing any duration (or the
 * anchor itself) ripples through the rest of the schedule.
 *
 * effectiveStart(0) = startTime(0)
 * effectiveStart(n) = endsAt(n-1)
 * effectiveDuration = durationMin + addedMin
 * endsAt = effectiveStart + effectiveDuration
 */
export function computeEffectiveItems(items: ProgramItem[]): EffectiveItem[] {
  let cursor: number | null = null;
  return items.map((item) => {
    const added = Number.isFinite(item.addedMin) ? item.addedMin : 0;
    const dur = Number.isFinite(item.durationMin) ? item.durationMin : 0;
    const anchor = parseTimeToMin(item.startTime) ?? 0;
    const effectiveStartMin = cursor === null ? anchor : cursor;
    const effectiveDurationMin = dur + added;
    const endsAtMin = effectiveStartMin + effectiveDurationMin;
    cursor = endsAtMin;
    return {
      ...item,
      addedMin: added,
      durationMin: dur,
      effectiveStartMin,
      effectiveDurationMin,
      endsAtMin,
    };
  });
}

/** Format minutes as a clock string "HH:MM" and, for program length, "Xh Ym". */
export function formatDuration(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format seconds as MM:SS or HH:MM:SS (absolute value for display). */
export function formatCountdown(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : "";
  const abs = Math.abs(Math.floor(totalSeconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${sign}${h}:${mm}:${ss}`;
  return `${sign}${mm}:${ss}`;
}

/** Format a GMT offset number as a label, e.g. 1 -> "GMT+1", -3 -> "GMT-3", 0 -> "GMT". */
export function formatOffset(offset: number): string {
  if (offset === 0) return "GMT";
  return `GMT${offset > 0 ? "+" : ""}${offset}`;
}

/**
 * Current time in a fixed GMT offset, expressed as seconds since local midnight
 * of that offset's day plus the wall-clock date, used for the live clock.
 */
export function nowInOffset(tzOffset: number, at: number = Date.now()): Date {
  const utcMs = at + new Date(at).getTimezoneOffset() * 60_000;
  return new Date(utcMs + tzOffset * 3600_000);
}

/** Format the live clock as HH:MM:SS for the given offset. */
export function formatClock(tzOffset: number, at: number = Date.now()): string {
  const d = nowInOffset(tzOffset, at);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/** Minutes since midnight (in program tz) for a given epoch time. */
export function minutesSinceMidnightInOffset(tzOffset: number, at: number = Date.now()): number {
  const d = nowInOffset(tzOffset, at);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export const TZ_OFFSETS: number[] = Array.from({ length: 27 }, (_, i) => i - 12);
