-- Carry the timing mode in the shared live doc so it syncs across devices
-- over the same realtime channel as the running state.
alter table public.live_state
  add column if not exists mode text not null default 'A'
  check (mode in ('A','B'));
