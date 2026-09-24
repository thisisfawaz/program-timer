-- Mode A: stored actual minutes per item (settled when passed forward).
alter table public.live_state
  add column if not exists overruns jsonb not null default '{}'::jsonb;
