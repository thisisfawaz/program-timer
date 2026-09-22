"use client";

import { useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 ${className}`}
    >
      {children}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "subtle";
  /** When true, renders the active glow state (green text glow). */
  active?: boolean;
  /** Three-state activity: open = green, closed = amber, off = plain. */
  state?: "open" | "closed" | "off";
};

export function Button({
  variant = "subtle",
  active = false,
  state,
  className = "",
  ...props
}: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
  const variants: Record<string, string> = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-500",
    ghost: "bg-transparent text-neutral-300 hover:bg-neutral-800",
    subtle: "bg-neutral-800 text-neutral-100 hover:bg-neutral-700",
    danger: "bg-red-600 text-white hover:bg-red-500",
  };
  // The state glow overrides the variant's text color (emitted after it).
  const stateCls =
    state === "open"
      ? "!text-emerald-400 [text-shadow:0_0_8px_rgba(52,211,153,0.9)]"
      : state === "closed"
        ? "!text-amber-400 [text-shadow:0_0_8px_rgba(251,191,36,0.9)]"
        : active
          ? "!text-emerald-400 [text-shadow:0_0_8px_rgba(52,211,153,0.9)]"
          : "";
  return (
    <button
      className={`${base} ${variants[variant]} ${stateCls} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-indigo-500 ${className}`}
      {...props}
    />
  );
}

/**
 * A text input that owns its draft value locally and only pushes changes upward
 * on edit/blur. This keeps the caret stable even when the parent re-renders on a
 * fast tick (e.g. the running timer or the live clock), which would otherwise
 * reset a controlled input's cursor to the end on every render.
 */
export function LocalInput({
  value,
  onCommit,
  className = "",
  type = "text",
  ...rest
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);

  // Sync from props only while NOT focused, so external updates still land
  // but typing is never interrupted.
  useEffect(() => {
    if (!focusedRef.current) setDraft(value);
  }, [value]);

  return (
    <input
      {...rest}
      type={type}
      value={draft}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        onCommit(e.target.value);
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        onCommit(e.target.value);
      }}
      className={`w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-indigo-500 ${className}`}
    />
  );
}

/**
 * A 24-hour HH:MM time field that is identical on every device, regardless of
 * the OS locale (unlike <input type="time">, which renders 12h or 24h by
 * locale). Stores and displays "HH:MM" only.
 */
export function TimeField({
  value,
  onCommit,
  className = "",
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(value);
  }, [value]);

  const commit = (raw: string) => {
    // Accept "H:MM" or "HH:MM" (24h); normalize to "HH:MM".
    const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
    if (!m) return;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) return;
    onCommit(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  };

  return (
    <input
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        commit(e.target.value);
      }}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        commit(e.target.value);
        setDraft(value);
      }}
      placeholder="HH:MM"
      inputMode="numeric"
      className={`tnum w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-indigo-500 ${className}`}
    />
  );
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:border-indigo-500 ${className}`}
      {...props}
    />
  );
}

export function Label({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400 ${className}`}>
      {children}
    </label>
  );
}
