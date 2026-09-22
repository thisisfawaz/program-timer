-- Cross-device presence: who has control/live open for a program.
create table if not exists public.presence (
  program_id uuid not null references public.programs(id) on delete cascade,
  kind text not null check (kind in ('control','live')),
  last_seen timestamptz not null default now(),
  primary key (program_id, kind)
);

alter table public.presence enable row level security;

create policy "presence: readable with program" on public.presence
  for select using (
    exists (
      select 1 from public.programs p
      where p.id = program_id
        and (p.owner_id = auth.uid()
          or (p.org_id is not null and public.is_member(p.org_id)))
    )
  );

create policy "presence: writable with program" on public.presence
  for insert with check (
    exists (
      select 1 from public.programs p
      where p.id = program_id
        and (p.owner_id = auth.uid()
          or (p.org_id is not null and public.is_member(p.org_id)))
    )
  );

create policy "presence: updatable with program" on public.presence
  for update using (
    exists (
      select 1 from public.programs p
      where p.id = program_id
        and (p.owner_id = auth.uid()
          or (p.org_id is not null and public.is_member(p.org_id)))
    )
  );

alter publication supabase_realtime add table public.presence;
