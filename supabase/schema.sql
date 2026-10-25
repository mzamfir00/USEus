-- Squad Roulette — Supabase schema.
-- Run this once in the Supabase SQL editor, then paste the project URL + anon key
-- into the app (profile menu → Database / Cloud Settings) or set
-- VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY at build time.
--
-- Security model: a casual party game. The anon key can read public profile
-- columns and write game data; PIN hashes are never readable and logins from a
-- new device are verified server-side by login_profile().

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null check (username ~ '^[a-z0-9_]{3,16}$'),
  name text not null,
  age int not null check (age between 13 and 99),
  archetype text not null,
  pin_hash text not null,
  xp int not null default 0,
  missions_completed int not null default 0,
  secret_wins int not null default 0,
  rounds_played int not null default 0,
  chickened int not null default 0,
  squad_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
  code text primary key,
  host_username text references public.profiles(username) on delete set null,
  dna jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  category text,
  pack_name text,
  missions_completed int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.room_players (
  room_code text references public.rooms(code) on delete cascade,
  username text references public.profiles(username) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_code, username)
);

create table if not exists public.mission_history (
  id bigserial primary key,
  room_code text references public.rooms(code) on delete cascade,
  mission_id int not null,
  category text not null,
  outcome text not null check (outcome in ('complete', 'chicken')),
  saboteur_won boolean not null default false,
  players jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.mission_history enable row level security;

-- Column-level read access: everything except pin_hash.
revoke select on public.profiles from anon, authenticated;
grant select (id, username, name, age, archetype, xp, missions_completed, secret_wins,
              rounds_played, chickened, squad_history, created_at, updated_at)
  on public.profiles to anon, authenticated;
grant insert, update on public.profiles to anon, authenticated;

drop policy if exists "profiles read" on public.profiles;
drop policy if exists "profiles insert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
create policy "profiles insert" on public.profiles for insert with check (true);
create policy "profiles update" on public.profiles for update using (true) with check (true);

drop policy if exists "rooms all" on public.rooms;
create policy "rooms all" on public.rooms for all using (true) with check (true);
drop policy if exists "room_players all" on public.room_players;
create policy "room_players all" on public.room_players for all using (true) with check (true);
drop policy if exists "mission_history all" on public.mission_history;
create policy "mission_history all" on public.mission_history for all using (true) with check (true);

-- Verifies a username + PIN hash and returns the profile (without the hash).
create or replace function public.login_profile(p_username text, p_pin_hash text)
returns table (
  id uuid, username text, name text, age int, archetype text, xp int,
  missions_completed int, secret_wins int, rounds_played int, chickened int,
  squad_history jsonb, created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.username, p.name, p.age, p.archetype, p.xp, p.missions_completed,
         p.secret_wins, p.rounds_played, p.chickened, p.squad_history, p.created_at
  from public.profiles p
  where p.username = lower(p_username) and p.pin_hash = p_pin_hash;
$$;

grant execute on function public.login_profile(text, text) to anon, authenticated;
