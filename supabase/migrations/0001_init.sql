-- Countdown Timer Platform — initial schema
-- Run this in the Supabase SQL editor.

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- organizations ----------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- ---------- memberships ----------
-- display_name is the name the member uses *inside this org*.
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  display_name text,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

alter table public.memberships enable row level security;

-- Helper: is the current user a member of the given org?
create or replace function public.is_member(org uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org and m.user_id = auth.uid()
  );
$$;

create policy "orgs: members can read" on public.organizations
  for select using (owner_id = auth.uid() or public.is_member(id));
create policy "orgs: anyone can create" on public.organizations
  for insert with check (owner_id = auth.uid());
create policy "orgs: owners can update" on public.organizations
  for update using (owner_id = auth.uid());
create policy "orgs: owners can delete" on public.organizations
  for delete using (owner_id = auth.uid());

create policy "memberships: members can read" on public.memberships
  for select using (user_id = auth.uid() or public.is_member(org_id));
create policy "memberships: owners/admins can insert" on public.memberships
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.memberships m
      where m.org_id = org_id and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );
create policy "memberships: self update" on public.memberships
  for update using (user_id = auth.uid());
create policy "memberships: owners/admins can delete" on public.memberships
  for delete using (
    exists (
      select 1 from public.memberships m
      where m.org_id = org_id and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- ---------- invitations ----------
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending' check (status in ('pending','accepted','declined','revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.invitations enable row level security;

create policy "invitations: org members can read" on public.invitations
  for select using (public.is_member(org_id));
-- Invitee can also see invitations addressed to their email (for the in-app inbox).
create policy "invitations: invitee can read" on public.invitations
  for select using (lower(email) = lower(auth.jwt() ->> 'email'));
create policy "invitations: owners/admins can insert" on public.invitations
  for insert with check (
    exists (
      select 1 from public.memberships m
      where m.org_id = org_id and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );
create policy "invitations: invitee can update" on public.invitations
  for update using (lower(email) = lower(auth.jwt() ->> 'email'));

-- ---------- programs ----------
-- Owned by a user (personal) or an organization (org_id set).
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  tz_offset int not null default 0,
  anchor_date date,
  anchor_time text,
  recurrence text not null default 'none'
    check (recurrence in ('none','daily','weekly','biweekly','monthly')),
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (owner_id is not null or org_id is not null)
);

alter table public.programs enable row level security;

create policy "programs: owner or org member can read" on public.programs
  for select using (
    owner_id = auth.uid()
    or (org_id is not null and public.is_member(org_id))
  );
create policy "programs: owner or org member can insert" on public.programs
  for insert with check (
    owner_id = auth.uid()
    or (org_id is not null and public.is_member(org_id))
  );
create policy "programs: owner or org member can update" on public.programs
  for update using (
    owner_id = auth.uid()
    or (org_id is not null and public.is_member(org_id))
  );
create policy "programs: owner or org admin can delete" on public.programs
  for delete using (
    owner_id = auth.uid()
    or (org_id is not null and exists (
      select 1 from public.memberships m
      where m.org_id = org_id and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    ))
  );
