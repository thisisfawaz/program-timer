"use client";

import { useState } from "react";
import type { EffectiveItem } from "@/lib/types";
import { formatCountdown, formatDuration } from "@/lib/schedule";
import { Button, LocalInput } from "./ui";

export function TimerPanel({
  current,
  remainingSec,
  started,
  running,
  red,
  onTogglePause,
  onRestart,
  onCurrentTime,
  onStop,
  onAddMinutes,
  onPickNext,
  hasNext,
}: {
  current: EffectiveItem | null;
  remainingSec: number;
  started: boolean;
  running: boolean;
  red: boolean;
  onTogglePause: () => void;
  onRestart: () => void;
  onCurrentTime: () => void;
  onStop: () => void;
  onAddMinutes: (minutes: number) => void;
  onPickNext: () => void;
  hasNext: boolean;
}) {
  const [custom, setCustom] = useState("");

  const applyCustom = () => {
    const n = Number(custom);
    if (!Number.isFinite(n) || n === 0) return;
    onAddMinutes(Math.round(n));
    setCustom("");
  };

  if (!current) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 text-center">
        <p className="text-sm text-neutral-400">
          Pick an item below to start its countdown.
        </p>
      </div>
    );
  }

  const waiting = !started;

  return (
    <div className="rounded-2xl bg-white p-8">
      <p className="text-center text-sm font-medium uppercase tracking-widest text-neutral-500">
        {current.name || "Untitled item"}
      </p>
      <p
        className={`tnum mt-2 text-center text-6xl font-bold leading-none sm:text-7xl ${
          waiting ? "text-neutral-400" : red ? "text-red-600" : "text-neutral-900"
        }`}
      >
        {formatCountdown(remainingSec)}
      </p>
      <p className="mt-2 text-center text-xs text-neutral-500">
        {waiting
          ? `Starts at ${formatClockFromMin(current.effectiveStartMin)} · waiting`
          : `Effective duration ${formatDuration(current.effectiveDurationMin)}${
              current.addedMin !== 0 ? ` · +${current.addedMin}m added` : ""
            }${!running ? " · paused" : ""}`}
      </p>

      {!waiting && remainingSec <= 0 && (
        <div className="mt-6 rounded-xl bg-red-50 p-4 text-center">
          <p className="text-sm font-medium text-red-700">Time is up. Restart this item?</p>
          <Button variant="subtle" className="mt-3" onClick={onRestart}>
            Restart
          </Button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button variant="subtle" onClick={onTogglePause} disabled={waiting}>
          {running ? "Pause" : "Resume"}
        </Button>
        <Button variant="subtle" onClick={onRestart} disabled={waiting}>
          Restart item
        </Button>
        <Button variant="subtle" onClick={onCurrentTime}>
          Current time
        </Button>
        <Button variant="subtle" onClick={() => onAddMinutes(1)}>
          +1 min
        </Button>
        <Button variant="subtle" onClick={() => onAddMinutes(5)}>
          +5 min
        </Button>
        <div className="flex items-center gap-1">
          <LocalInput
            value={custom}
            onCommit={setCustom}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyCustom();
            }}
            placeholder="±min"
            inputMode="numeric"
            className="w-20"
          />
          <Button variant="subtle" onClick={applyCustom}>
            Apply
          </Button>
        </div>
        <Button variant="subtle" onClick={onPickNext} disabled={!hasNext}>
          Next item
        </Button>
        <Button variant="danger" onClick={onStop}>
          Stop
        </Button>
      </div>
    </div>
  );
}

function formatClockFromMin(min: number): string {
  const wrapped = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
