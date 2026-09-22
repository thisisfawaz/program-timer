"use client";

import { useState } from "react";
import type { EffectiveItem } from "@/lib/types";
import { formatDuration, formatMinToTime } from "@/lib/schedule";
import { Button, LocalInput } from "./ui";

export function ScheduleEditor({
  items,
  currentIndex,
  nowMin,
  onUpdate,
  onDelete,
  onReorder,
  onInsertAfter,
  onPlay,
  onAddMinutes,
  onResetAdded,
}: {
  items: EffectiveItem[];
  currentIndex: number | null;
  nowMin: number;
  onUpdate: (index: number, patch: Partial<EffectiveItem>) => void;
  onDelete: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onInsertAfter: (index: number) => void;
  onPlay: (index: number) => void;
  onAddMinutes: (index: number, minutes: number) => void;
  onResetAdded: (index: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
        No items yet. Add one to build the schedule.
      </p>
    );
  }

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => {
        const isCurrent = currentIndex === index;
        const isPast = !isCurrent && item.endsAtMin <= nowMin;
        const border = isCurrent
          ? "border-indigo-500"
          : isPast
            ? "border-red-600"
            : "border-neutral-800";
        const bg = isCurrent ? "bg-indigo-950/40" : "bg-neutral-900/60";
        const isDragging = dragIndex === index;
        const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;

        return (
          <div
            key={item.id}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOverIndex(index);
            }}
            onDrop={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              if (dragIndex !== index) {
                onReorder(dragIndex, index);
              }
              endDrag();
            }}
            className={`rounded-2xl border ${border} ${bg} p-4 transition-opacity ${
              isDragging ? "opacity-40" : ""
            } ${isOver ? "ring-2 ring-indigo-400" : ""}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div
                draggable
                onDragStart={(e) => {
                  setDragIndex(index);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={endDrag}
                className="flex cursor-grab select-none items-center justify-center self-stretch rounded-lg px-2 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300 active:cursor-grabbing sm:mb-1"
                title="Drag to reorder"
                aria-label="Drag to reorder"
              >
                ⠿
              </div>

              <div className="sm:w-28">
                <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
                  Start
                </label>
                {index === 0 ? (
                  <LocalInput
                    type="time"
                    value={item.startTime}
                    onCommit={(v) => onUpdate(index, { startTime: v })}
                  />
                ) : (
                  <div
                    className="tnum flex h-[34px] items-center rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 text-sm text-neutral-400"
                    title="Derived from the previous item's end"
                  >
                    {formatMinToTime(item.effectiveStartMin)}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
                  Name
                </label>
                <LocalInput
                  value={item.name}
                  onCommit={(v) => onUpdate(index, { name: v })}
                  placeholder="Item name"
                />
              </div>
              <div className="sm:w-28">
                <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
                  Duration (min)
                </label>
                <LocalInput
                  type="number"
                  min={0}
                  value={String(item.durationMin)}
                  onCommit={(v) =>
                    onUpdate(index, {
                      durationMin: Math.max(0, Math.round(Number(v) || 0)),
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={() => onPlay(index)} title="Start this item">
                  Play
                </Button>
                <Button variant="ghost" onClick={() => onDelete(index)} title="Delete item">
                  Delete
                </Button>
                <Button
                  variant="subtle"
                  onClick={() => onInsertAfter(index)}
                  title="Add an item after this one"
                  className="px-2"
                >
                  +
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-400">
              <span className="tnum">
                {formatMinToTime(item.effectiveStartMin)} – {formatMinToTime(item.endsAtMin)}
              </span>
              <span>Effective {formatDuration(item.effectiveDurationMin)}</span>
              {item.addedMin !== 0 && (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">
                  {item.addedMin > 0 ? `+${item.addedMin}m` : `${item.addedMin}m`} added
                  <button
                    className="text-amber-200 underline underline-offset-2 hover:text-amber-100"
                    onClick={() => onResetAdded(index)}
                  >
                    reset
                  </button>
                </span>
              )}
              <span className="flex items-center gap-1">
                <button
                  className="rounded bg-neutral-800 px-2 py-0.5 hover:bg-neutral-700"
                  onClick={() => onAddMinutes(index, 1)}
                >
                  +1m
                </button>
                <button
                  className="rounded bg-neutral-800 px-2 py-0.5 hover:bg-neutral-700"
                  onClick={() => onAddMinutes(index, 5)}
                >
                  +5m
                </button>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
