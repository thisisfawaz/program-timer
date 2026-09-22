"use client";

/**
 * Presence for control/live, based on an explicit open/closed status — NOT on
 * heartbeat freshness.
 *
 *   - A page writes status "open" while it is mounted (foreground OR
 *     background). Backgrounding a tab must never mark it closed, so we do not
 *     tie "open" to tab visibility or to a fresh timestamp.
 *   - The page writes status "closed" on pagehide/beforeunload, i.e. when it is
 *     actually going away.
 *   - Reader maps: open -> green, closed -> amber, missing -> white.
 *   - Amber decays to white after ACTIVE_DECAY_MS.
 *
 * A page that is force-killed without firing pagehide would stay "open"; that
 * is the deliberate trade-off (better a stale green than a false amber).
 */

export type ActiveKind = "control" | "live";
export type ActiveState = "open" | "closed" | "off";

/** Amber (closed) decays to off (white) after this long. */
export const ACTIVE_DECAY_MS = 5 * 60 * 1000;

const ACTIVE_PREFIX = "timer_active_";

interface KindStatus {
  status: "open" | "closed";
  at: number;
}

interface Stored {
  control: KindStatus | null;
  live: KindStatus | null;
}

function key(programId: string): string {
  return ACTIVE_PREFIX + programId;
}

function readRaw(programId: string): Stored {
  if (typeof window === "undefined") return { control: null, live: null };
  try {
    const raw = window.localStorage.getItem(key(programId));
    if (!raw) return { control: null, live: null };
    const p = JSON.parse(raw) as Partial<Record<ActiveKind, KindStatus>>;
    const parse = (v: unknown): KindStatus | null => {
      if (!v || typeof v !== "object") return null;
      const o = v as Record<string, unknown>;
      if (o.status !== "open" && o.status !== "closed") return null;
      return {
        status: o.status,
        at: typeof o.at === "number" && Number.isFinite(o.at) ? o.at : Date.now(),
      };
    };
    return { control: parse(p.control), live: parse(p.live) };
  } catch {
    return { control: null, live: null };
  }
}

function writeRaw(programId: string, data: Stored): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(programId), JSON.stringify(data));
  window.dispatchEvent(new Event("timer-active-changed"));
}

function setStatus(
  programId: string,
  kind: ActiveKind,
  status: "open" | "closed",
): void {
  const data = readRaw(programId);
  data[kind] = { status, at: Date.now() };
  writeRaw(programId, data);
}

/** Mark a kind open (called on mount). */
export function markOpen(programId: string, kind: ActiveKind): void {
  setStatus(programId, kind, "open");
}

/** Mark a kind closed (called on pagehide/beforeunload). */
export function markClosed(programId: string, kind: ActiveKind): void {
  setStatus(programId, kind, "closed");
}

/** Clear a kind (off/white). */
export function markOff(programId: string, kind: ActiveKind): void {
  const data = readRaw(programId);
  data[kind] = null;
  writeRaw(programId, data);
}

/**
 * Resolve three-state: open -> green, closed -> amber, missing/decayed -> off.
 */
export function getActiveState(programId: string, kind: ActiveKind): ActiveState {
  const entry = readRaw(programId)[kind];
  if (!entry) return "off";
  if (entry.status === "open") return "open";
  // closed: amber until it decays to off.
  if (Date.now() - entry.at >= ACTIVE_DECAY_MS) return "off";
  return "closed";
}

export function getActiveStates(
  programId: string,
): Record<ActiveKind, ActiveState> {
  return {
    control: getActiveState(programId, "control"),
    live: getActiveState(programId, "live"),
  };
}
