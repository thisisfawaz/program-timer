import type { LiveState, Program, ProgramItem } from "./types";
import { makeId } from "./schedule";

const PROGRAMS_KEY = "timer_programs_v1";
const LIVE_PREFIX = "timer_live_";
const ACTIVE_PREFIX = "timer_active_";

export const DEFAULT_LIVE: LiveState = {
  itemIndex: null,
  remainingSec: 0,
  running: false,
  updatedAt: 0,
};

/* ------------------------------- normalization ------------------------------ */

function normalizeItem(raw: unknown): ProgramItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const startTime =
    typeof r.startTime === "string" && /^\d{1,2}:\d{2}$/.test(r.startTime)
      ? r.startTime
      : "09:00";
  return {
    id: typeof r.id === "string" && r.id ? r.id : makeId(),
    name: typeof r.name === "string" ? r.name : "Untitled item",
    startTime,
    durationMin:
      typeof r.durationMin === "number" && Number.isFinite(r.durationMin)
        ? Math.max(0, Math.round(r.durationMin))
        : 10,
    addedMin:
      typeof r.addedMin === "number" && Number.isFinite(r.addedMin) ? Math.round(r.addedMin) : 0,
  };
}

function normalizeProgram(raw: unknown): Program | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  const offset =
    typeof r.tzOffset === "number" && Number.isFinite(r.tzOffset)
      ? Math.max(-12, Math.min(14, Math.round(r.tzOffset)))
      : 0;
  const items = Array.isArray(r.items)
    ? r.items.map(normalizeItem).filter((i): i is ProgramItem => i !== null)
    : [];
  const dateOk = typeof r.anchorDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.anchorDate);
  const timeOk = typeof r.anchorTime === "string" && /^\d{1,2}:\d{2}$/.test(r.anchorTime);
  const recOk =
    r.recurrence === "none" ||
    r.recurrence === "daily" ||
    r.recurrence === "weekly" ||
    r.recurrence === "biweekly" ||
    r.recurrence === "monthly";
  return {
    id: r.id,
    name: typeof r.name === "string" && r.name ? r.name : "Untitled program",
    tzOffset: offset,
    items,
    createdAt:
      typeof r.createdAt === "number" && Number.isFinite(r.createdAt) ? r.createdAt : Date.now(),
    anchorDate: dateOk ? (r.anchorDate as string) : undefined,
    anchorTime: timeOk ? (r.anchorTime as string) : undefined,
    recurrence: recOk ? (r.recurrence as Program["recurrence"]) : undefined,
  };
}

/* --------------------------------- programs -------------------------------- */

export function loadPrograms(): Program[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROGRAMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeProgram).filter((p): p is Program => p !== null);
  } catch {
    return [];
  }
}

function persist(programs: Program[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROGRAMS_KEY, JSON.stringify(programs));
  window.dispatchEvent(new Event("timer-programs-changed"));
}

export function saveProgram(program: Program): void {
  const programs = loadPrograms();
  const idx = programs.findIndex((p) => p.id === program.id);
  if (idx >= 0) programs[idx] = program;
  else programs.push(program);
  persist(programs);
}

export function getProgram(id: string): Program | null {
  return loadPrograms().find((p) => p.id === id) ?? null;
}

export function deleteProgram(id: string): void {
  persist(loadPrograms().filter((p) => p.id !== id));
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LIVE_PREFIX + id);
    window.localStorage.removeItem(ACTIVE_PREFIX + id);
  }
}

/* ------------------------------- live channel ------------------------------ */

function liveKey(programId: string): string {
  return LIVE_PREFIX + programId;
}

export function readLive(programId: string): LiveState {
  if (typeof window === "undefined") return { ...DEFAULT_LIVE };
  try {
    const raw = window.localStorage.getItem(liveKey(programId));
    if (!raw) return { ...DEFAULT_LIVE };
    const parsed = JSON.parse(raw) as Partial<LiveState>;
    return {
      itemIndex:
        typeof parsed.itemIndex === "number" && Number.isFinite(parsed.itemIndex)
          ? parsed.itemIndex
          : null,
      remainingSec:
        typeof parsed.remainingSec === "number" && Number.isFinite(parsed.remainingSec)
          ? parsed.remainingSec
          : 0,
      running: parsed.running === true,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return { ...DEFAULT_LIVE };
  }
}

export function writeLive(programId: string, state: LiveState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(liveKey(programId), JSON.stringify(state));
}

export function clearLive(programId: string): void {
  writeLive(programId, { ...DEFAULT_LIVE, updatedAt: Date.now() });
}
