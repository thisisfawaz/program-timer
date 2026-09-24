-- Apply columns that were defined in earlier migrations but may not have
-- been run against the database yet. Safe to run repeatedly (IF NOT EXISTS).

-- Program timing mode: 'A' = end on time, 'B' = full duration.
alter table public.programs
  add column if not exists mode text not null default 'B'
  check (mode in ('A','B'));

-- Mode B: independent running clock per item (itemIndex -> anchor ms).
alter table public.live_state
  add column if not exists clocks jsonb not null default '{}'::jsonb;

-- Per-item paused remaining (itemIndex -> frozen seconds).
alter table public.live_state
  add column if not exists paused jsonb not null default '{}'::jsonb;

-- Mode A: per-item actual elapsed minutes (settled when passed forward).
alter table public.live_state
  add column if not exists overruns jsonb not null default '{}'::jsonb;

-- Frozen remaining seconds stored on the row (legacy pause field).
alter table public.live_state
  add column if not exists paused_remaining_sec numeric;

-- Presence: explicit open flag so closing a page flips amber instantly.
alter table public.presence
  add column if not exists open boolean not null default true;
