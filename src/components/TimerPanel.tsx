"use client";

import type { EffectiveItem } from "@/lib/types";
import { formatCountdown, formatDuration } from "@/lib/schedule";
import { Button } from "./ui";

export function TimerPanel({
  current,
  remainingSec,
  running,
  paused,
  red,
  mode,
  newEndMin,
  onSetMode,
  onTogglePause,
  onRestart,
  onStop,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  current: EffectiveItem | null;
  remainingSec: number;
  running: boolean;
  paused: boolean;
  red: boolean;
  mode: "A" | "B";
  newEndMin: number | null;
  onSetMode: (m: "A" | "B") => void;
  onTogglePause: () => void;
  onRestart: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  if (!current) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-neutral-800/80 bg-gradient-to-b from-neutral-900/80 to-neutral-950/80 p-10 text-center shadow-2xl shadow-black/40">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.08),transparent_60%)]" />
        <p className="relative text-sm text-neutral-400">Pick an item below to start its countdown.</p>
      </div>
    );
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-3xl border p-8 shadow-2xl transition-all duration-500 ${
        red
          ? "border-red-500/40 bg-gradient-to-b from-red-950/40 to-neutral-950 shadow-red-900/30"
          : "border-neutral-800/80 bg-gradient-to-b from-neutral-900/80 to-neutral-950/80 shadow-black/40"
      }`}
    >
      {/* Ambient glow layer */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
          red
            ? "bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.15),transparent_65%)]"
            : "bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_60%)]"
        }`}
      />
      {/* Subtle top hairline */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="relative mb-6 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Timer Mode
        </span>
        <select
          value={mode}
          onChange={(e) => onSetMode(e.target.value as "A" | "B")}
          className="cursor-pointer rounded-md border border-neutral-700/80 bg-neutral-900/80 px-3 py-1.5 text-xs font-medium text-neutral-200 shadow-inner outline-none backdrop-blur transition-colors hover:border-neutral-600 focus:border-indigo-500"
        >
          <option value="A">End on time</option>
          <option value="B">Full duration</option>
        </select>
      </div>

      <p className="relative text-center text-xs font-semibold uppercase tracking-[0.25em] text-neutral-400">
        {current.name || "Untitled item"}
      </p>

      <div className="relative mt-4 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
        <p
          className={`tnum text-center text-6xl font-bold leading-none tracking-tight sm:text-8xl ${
            red
              ? "text-red-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.35)]"
              : "text-neutral-50 drop-shadow-[0_0_25px_rgba(99,102,241,0.15)]"
          }`}
        >
          {formatCountdown(remainingSec)}
        </p>
        {newEndMin !== null && (
          <div className="rounded-2xl border border-neutral-700/60 bg-neutral-900/70 px-4 py-3 text-center shadow-inner backdrop-blur">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Projected end
            </p>
            <p className="tnum mt-1 text-xl font-semibold text-indigo-400">
              {formatClockFromMin(newEndMin)}
            </p>
          </div>
        )}
      </div>

      <div className="relative mt-5 flex items-center justify-center gap-2">
        <span className="rounded-full border border-neutral-700/60 bg-neutral-900/60 px-3 py-1 text-[11px] font-medium text-neutral-400">
          {mode === "A" ? "End on time" : "Full duration"}
        </span>
        <span className="rounded-full border border-neutral-700/60 bg-neutral-900/60 px-3 py-1 text-[11px] font-medium text-neutral-400">
          {formatDuration(current.effectiveDurationMin)}
        </span>
        {current.addedMin !== 0 && (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-300">
            +{current.addedMin}m
          </span>
        )}
        {paused && (
          <span className="rounded-full border border-neutral-600/60 bg-neutral-800/60 px-3 py-1 text-[11px] font-medium text-neutral-300">
            Paused
          </span>
        )}
      </div>

      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-2">
        <Button variant="subtle" onClick={onPrev} disabled={!hasPrev}>
          ← Prev
        </Button>
        <Button variant="subtle" onClick={onNext} disabled={!hasNext}>
          Next →
        </Button>
        <div className="mx-1 h-5 w-px bg-neutral-700/60" />
        <Button variant="subtle" onClick={onTogglePause}>
          {paused ? <PlayIcon /> : <PauseIcon />}
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button variant="subtle" onClick={onRestart}>
          ↻ Restart
        </Button>
        <Button variant="danger" onClick={onStop}>
          ■ Stop
        </Button>
      </div>
    </div>
  );
}

function PauseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="h-3.5 w-3.5 text-white"
      aria-hidden="true"
    >
      <rect x="3" y="2" width="3.5" height="12" rx="1.25" fill="currentColor" />
      <rect x="9.5" y="2" width="3.5" height="12" rx="1.25" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="h-3.5 w-3.5 text-white"
      aria-hidden="true"
    >
      <path d="M4.5 2.8v10.4a1 1 0 0 0 1.53.85l8.2-5.2a1 1 0 0 0 0-1.7l-8.2-5.2A1 1 0 0 0 4.5 2.8Z" fill="currentColor" />
    </svg>
  );
}

function formatClockFromMin(min: number): string {
  const wrapped = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
