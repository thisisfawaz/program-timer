"use client";

import type { ReactNode } from "react";

export function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-700/70 bg-neutral-900/60 text-white shadow-sm transition-colors hover:border-neutral-600 hover:bg-neutral-800 focus:border-indigo-500 focus:outline-none"
    >
      {children}
    </button>
  );
}

export function ProgramActions({
  onEdit,
  onDuplicate,
  onDelete,
}: {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <IconButton label="Edit" onClick={onEdit}>
        <PencilIcon />
      </IconButton>
      <IconButton label="Duplicate" onClick={onDuplicate}>
        <CopyIcon />
      </IconButton>
      <IconButton label="Delete" onClick={onDelete}>
        <TrashIcon />
      </IconButton>
    </>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-white" aria-hidden="true">
      <path d="M11.3 2.2a1.4 1.4 0 0 1 2 2l-.9.9-2-2 .9-.9Z" fill="currentColor" />
      <path d="M9.7 3.8l2 2-6.2 6.2-2.4.4.4-2.4 6.2-6.2Z" fill="currentColor" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-white" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect
        x="2.5"
        y="2.5"
        width="8"
        height="8"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-white" aria-hidden="true">
      <path
        d="M3 4.5h10M6.5 4.5V3.2a.9.9 0 0 1 .9-.9h1.2a.9.9 0 0 1 .9.9v1.3M4.3 4.5l.5 8a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.5-8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
