-- Program timing mode: 'A' = end on time (schedule-locked), 'B' = by duration.
alter table public.programs
  add column if not exists mode text not null default 'B'
  check (mode in ('A','B'));

-- Mode B keeps an independent running clock per item (itemIndex -> anchor ms).
-- Mode A doesn't use this (schedule-locked).
alter table public.live_state
  add column if not exists clocks jsonb not null default '{}'::jsonb;

-- Mode B: per-item paused remaining (itemIndex -> frozen seconds).
alter table public.live_state
  add column if not exists paused jsonb not null default '{}'::jsonb;
