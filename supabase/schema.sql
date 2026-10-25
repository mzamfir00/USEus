-- USEus — Supabase schema (accounts, friendships, rooms, mission_logs, reports).
--
-- Setup: run this file once in the Supabase SQL editor, then add the project URL and
-- anon key as GitHub repository secrets VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
-- (the Pages workflow passes them to the build), or connect from Profile → Cloud database.
--
-- Re-run the whole file after updating the app: every statement is idempotent.
--
-- Guarantees:
--   * Accounts are kept until their owner deletes them in the app (Profile → Delete
--     Account Permanently). Clients cannot DELETE rows directly: a trigger blocks every
--     delete except the one performed by delete_account(), which verifies the owner's
--     login and erases the account, friendships, hosted rooms and their mission logs,
--     and the username from other rooms' scores and logs.
--   * Phone, email and username are unique; every account has a phone or an email.
--   * Every account is 16+ (date of birth checked in the database too).
--   * pass_hash, phone and email are never readable by clients; logins are verified by
--     login_account(), lookups by find_accounts(), uniqueness by identity_available().

create table if not exists public.accounts (
  id uuid primary key,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  name text not null,
  phone text unique check (phone is null or phone ~ '^\+[0-9]{8,15}$'),
  email text unique check (email is null or email = lower(email)),
  dob date not null,
  pass_hash text not null,
  xp int not null default 0,
  missions_completed int not null default 0,
  secret_wins int not null default 0,
  rounds_played int not null default 0,
  chickened int not null default 0,
  squad_history jsonb not null default '[]'::jsonb,
  aesthetics text[] not null default array['none'],
  theme text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_contact check (phone is not null or email is not null)
);

create table if not exists public.friendships (
  account_id uuid not null references public.accounts(id),
  friend_id uuid not null references public.accounts(id),
  created_at timestamptz not null default now(),
  primary key (account_id, friend_id),
  check (account_id <> friend_id)
);

create table if not exists public.rooms (
  code text primary key check (code ~ '^[0-9]{4}$'),
  host_id uuid references public.accounts(id),
  dna jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  category text,
  pack_name text,
  missions_completed int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.mission_logs (
  id bigserial primary key,
  room_code text references public.rooms(code),
  mission_id int,
  game text,
  location text,
  category text not null,
  outcome text not null check (outcome in ('complete', 'chicken')),
  saboteur_won boolean not null default false,
  players jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Upgrades for projects created from an earlier version of this file.
alter table public.mission_logs add column if not exists game text;
alter table public.mission_logs add column if not exists location text;
alter table public.mission_logs alter column mission_id drop not null;

create table if not exists public.reports (
  id bigserial primary key,
  reporter_id uuid,
  reporter_username text,
  reported_id uuid,
  reported_username text not null,
  reason text not null check (reason in ('harassment', 'inappropriate', 'cheating', 'underage', 'spam', 'other')),
  details text check (details is null or char_length(details) <= 500),
  room_code text,
  created_at timestamptz not null default now()
);

-- Owner-only deletion -----------------------------------------------------------
create or replace function public.block_account_delete() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('useus.deleting', true), '') = 'on' then
    return old;
  end if;
  raise exception 'USEus accounts can only be deleted by their owner from the app';
end;
$$;

drop trigger if exists accounts_no_delete on public.accounts;
create trigger accounts_no_delete before delete on public.accounts
  for each row execute function public.block_account_delete();

create or replace function public.enforce_min_age() returns trigger
language plpgsql as $$
begin
  if new.dob > (current_date - interval '16 years') then
    raise exception 'You must be at least 16 years old to play USEus';
  end if;
  return new;
end;
$$;

drop trigger if exists accounts_min_age on public.accounts;
create trigger accounts_min_age before insert or update of dob on public.accounts
  for each row execute function public.enforce_min_age();

-- Row level security ----------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.friendships enable row level security;
alter table public.rooms enable row level security;
alter table public.mission_logs enable row level security;
alter table public.reports enable row level security;

revoke all on public.accounts from anon, authenticated;
grant select (id, username, name, xp, missions_completed, secret_wins, rounds_played,
              chickened, aesthetics, theme, created_at)
  on public.accounts to anon, authenticated;
grant insert, update on public.accounts to anon, authenticated;
grant select, insert on public.friendships to anon, authenticated;
grant select, insert, update on public.rooms to anon, authenticated;
grant select, insert on public.mission_logs to anon, authenticated;
grant usage, select on sequence public.mission_logs_id_seq to anon, authenticated;
-- Reports are write-only for clients; moderators read them in the Supabase dashboard.
revoke all on public.reports from anon, authenticated;
grant insert on public.reports to anon, authenticated;
grant usage, select on sequence public.reports_id_seq to anon, authenticated;

drop policy if exists accounts_read on public.accounts;
drop policy if exists accounts_insert on public.accounts;
drop policy if exists accounts_update on public.accounts;
create policy accounts_read on public.accounts for select using (true);
create policy accounts_insert on public.accounts for insert with check (true);
create policy accounts_update on public.accounts for update using (true) with check (true);

drop policy if exists friendships_read on public.friendships;
drop policy if exists friendships_insert on public.friendships;
create policy friendships_read on public.friendships for select using (true);
create policy friendships_insert on public.friendships for insert with check (true);

drop policy if exists rooms_read on public.rooms;
drop policy if exists rooms_insert on public.rooms;
drop policy if exists rooms_update on public.rooms;
create policy rooms_read on public.rooms for select using (true);
create policy rooms_insert on public.rooms for insert with check (true);
create policy rooms_update on public.rooms for update using (true) with check (true);

drop policy if exists mission_logs_read on public.mission_logs;
drop policy if exists mission_logs_insert on public.mission_logs;
create policy mission_logs_read on public.mission_logs for select using (true);
create policy mission_logs_insert on public.mission_logs for insert with check (true);

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert with check (true);

-- RPCs -------------------------------------------------------------------------

-- Restores the full account (including private contact fields) for a correct login.
create or replace function public.login_account(p_identifier text, p_pass_hash text)
returns table (
  id uuid, username text, name text, phone text, email text, dob date, xp int,
  missions_completed int, secret_wins int, rounds_played int, chickened int,
  squad_history jsonb, aesthetics text[], theme text, created_at timestamptz
)
language sql security definer set search_path = public as $$
  select a.id, a.username, a.name, a.phone, a.email, a.dob, a.xp, a.missions_completed,
         a.secret_wins, a.rounds_played, a.chickened, a.squad_history, a.aesthetics,
         a.theme, a.created_at
  from public.accounts a
  where (a.phone = p_identifier or a.email = lower(p_identifier))
    and a.pass_hash = p_pass_hash;
$$;

create or replace function public.identity_available(p_username text, p_phone text, p_email text)
returns table (username_taken boolean, phone_taken boolean, email_taken boolean)
language sql security definer set search_path = public as $$
  select
    exists (select 1 from public.accounts where username = lower(p_username)),
    p_phone is not null and exists (select 1 from public.accounts where phone = p_phone),
    p_email is not null and exists (select 1 from public.accounts where email = lower(p_email));
$$;

-- Username prefix search, or exact phone / email match. Returns public fields only.
create or replace function public.find_accounts(p_query text)
returns table (id uuid, username text, name text)
language sql security definer set search_path = public as $$
  select a.id, a.username, a.name
  from public.accounts a
  where a.username like lower(ltrim(p_query, '@')) || '%'
     or a.phone = p_query
     or a.email = lower(p_query)
  order by a.username
  limit 20;
$$;

-- In-app "Delete Account Permanently": verifies the owner's login, then erases the
-- account and everything that identifies it. Returns false when nothing matched.
create or replace function public.delete_account(p_id uuid, p_identifier text, p_pass_hash text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_username text;
begin
  select a.username into v_username
  from public.accounts a
  where a.id = p_id
    and (a.phone = p_identifier or a.email = lower(p_identifier))
    and a.pass_hash = p_pass_hash;
  if v_username is null then
    return false;
  end if;

  perform set_config('useus.deleting', 'on', true);
  delete from public.friendships where account_id = p_id or friend_id = p_id;
  delete from public.mission_logs where room_code in (select code from public.rooms where host_id = p_id);
  delete from public.rooms where host_id = p_id;
  update public.rooms set scores = scores - v_username where scores ? v_username;
  update public.mission_logs set players = players - v_username where players ? v_username;
  delete from public.reports where reporter_id = p_id;
  delete from public.accounts where id = p_id;
  return true;
end;
$$;

grant execute on function public.login_account(text, text) to anon, authenticated;
grant execute on function public.delete_account(uuid, text, text) to anon, authenticated;
grant execute on function public.identity_available(text, text, text) to anon, authenticated;
grant execute on function public.find_accounts(text) to anon, authenticated;
