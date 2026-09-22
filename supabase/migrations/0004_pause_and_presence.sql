-- Pause: store frozen remaining seconds so every device shows the paused time.
alter table public.live_state
  add column if not exists paused_remaining_sec numeric;

-- Presence: explicit open/closed so closing a page flips amber instantly.
alter table public.presence
  add column if not exists open boolean not null default true;
