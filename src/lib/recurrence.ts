"use client";

import type { Recurrence } from "./types";
export type { Recurrence };

export const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
];

/** Today's date in a fixed GMT offset, as YYYY-MM-DD. */
export function todayInOffset(tzOffset: number, at: number = Date.now()): string {
  const d = new Date(at + tzOffset * 3600_000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD to a UTC-midnight epoch (for date math only). */
function parseDate(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Most recent occurrence (YYYY-MM-DD) of a recurring anchor on or before `today`.
 * For "none", returns the anchor date unchanged.
 */
export function currentOccurrence(
  anchorDate: string,
  recurrence: Recurrence,
  today: string,
): string {
  const anchor = parseDate(anchorDate);
  const now = parseDate(today);
  if (anchor === null || now === null || now <= anchor || recurrence === "none") {
    return anchorDate;
  }
  const DAY = 86_400_000;
  if (recurrence === "daily") {
    return today;
  }
  if (recurrence === "weekly" || recurrence === "biweekly") {
    const step = (recurrence === "weekly" ? 7 : 14) * DAY;
    const diff = now - anchor;
    const periods = Math.floor(diff / step);
    const occ = new Date(anchor + periods * step);
    return occ.toISOString().slice(0, 10);
  }
  // monthly: advance month-by-month from the anchor, keeping the day-of-month.
  const a = new Date(anchor);
  const n = new Date(now);
  let y = a.getUTCFullYear();
  let mo = a.getUTCMonth();
  const day = a.getUTCDate();
  let best = anchor;
  while (Date.UTC(y, mo, day) <= n.getTime()) {
    best = Date.UTC(y, mo, day);
    mo += 1;
    if (mo > 11) {
      mo = 0;
      y += 1;
    }
  }
  return new Date(best).toISOString().slice(0, 10);
}

/** Human-friendly label like "Sun, 22 Sep 2026". */
export function formatDateLabel(dateStr: string): string {
  const t = parseDate(dateStr);
  if (t === null) return dateStr;
  const d = new Date(t);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
