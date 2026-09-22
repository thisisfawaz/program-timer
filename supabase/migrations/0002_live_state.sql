-- Cross-device live running state, one row per program.
create table if not exists public.live_state (
  program_id uuid primary key references public.programs(id) on delete cascade,
  item_index int,
  running boolean not null default false,
  anchor_ms bigint,
  updated_at timestamptz not null default now()
);

alter table public.live_state enable row level security;

-- Readable/writable by anyone who can see the program (owner or org member).
create policy "live_state: readable with program" on public.live_state
  for select using (
    exists (
      select 1 from public.programs p
      where p.id = program_id
        and (
          p.owner_id = auth.uid()
          or (p.org_id is not null and public.is_member(p.org_id))
        )
    )
  );

create policy "live_state: writable with program" on public.live_state
  for insert with check (
    exists (
      select 1 from public.programs p
      where p.id = program_id
        and (
          p.owner_id = auth.uid()
          or (p.org_id is not null and public.is_member(p.org_id))
        )
    )
  );

create policy "live_state: updatable with program" on public.live_state
  for update using (
    exists (
      select 1 from public.programs p
      where p.id = program_id
        and (
          p.owner_id = auth.uid()
          or (p.org_id is not null and public.is_member(p.org_id))
        )
    )
  );

-- Realtime: publish changes so all devices update instantly.
alter publication supabase_realtime add table public.live_state;
