-- Muv'it signup repair patch.
-- Fixes Supabase Auth error: "Database error saving new user".
-- Run this in Supabase SQL Editor for the current Muv'it project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null default 'New User',
  avatar_url text,
  bio text default '',
  verified boolean default false,
  followers_count integer default 0,
  following_count integer default 0,
  reels_count integer default 0,
  onesignal_player_id text,
  country text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists id uuid default gen_random_uuid();
alter table public.profiles add column if not exists user_id uuid;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text default 'New User';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text default '';
alter table public.profiles add column if not exists verified boolean default false;
alter table public.profiles add column if not exists followers_count integer default 0;
alter table public.profiles add column if not exists following_count integer default 0;
alter table public.profiles add column if not exists reels_count integer default 0;
alter table public.profiles add column if not exists onesignal_player_id text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists latitude double precision;
alter table public.profiles add column if not exists longitude double precision;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

update public.profiles
set id = gen_random_uuid()
where id is null;

update public.profiles
set display_name = coalesce(nullif(display_name, ''), 'New User')
where display_name is null or display_name = '';

update public.profiles
set username = 'user_' || substr(coalesce(user_id, id)::text, 1, 8)
where username is null or username = '';

alter table public.profiles alter column id set not null;
alter table public.profiles alter column username set not null;
alter table public.profiles alter column display_name set not null;

create unique index if not exists profiles_user_id_uidx on public.profiles(user_id);
create unique index if not exists profiles_username_uidx on public.profiles(username);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Profiles viewable by authenticated users" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Profiles are viewable by everyone"
on public.profiles for select
using (true);

create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = user_id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;

create or replace function public.muvit_safe_username(_raw text, _user_id uuid)
returns text
language plpgsql
stable
as $$
declare
  _base text;
begin
  _base := lower(coalesce(nullif(trim(_raw), ''), 'user_' || substr(_user_id::text, 1, 8)));
  _base := regexp_replace(_base, '[^a-z0-9_]', '', 'g');
  _base := left(coalesce(nullif(_base, ''), 'user_' || substr(_user_id::text, 1, 8)), 24);
  return _base;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _base_username text;
  _final_username text;
  _display_name text;
  _attempt integer := 0;
begin
  _base_username := public.muvit_safe_username(new.raw_user_meta_data->>'username', new.id);
  _display_name := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'New User'
  );

  loop
    _final_username := case
      when _attempt = 0 then _base_username
      else left(_base_username, 20) || '_' || _attempt::text
    end;

    begin
      insert into public.profiles (
        user_id,
        username,
        display_name,
        avatar_url,
        bio,
        verified,
        followers_count,
        following_count,
        reels_count
      )
      values (
        new.id,
        _final_username,
        _display_name,
        new.raw_user_meta_data->>'avatar_url',
        '',
        false,
        0,
        0,
        0
      )
      on conflict (user_id) do update
      set
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

      exit;
    exception
      when unique_violation then
        _attempt := _attempt + 1;
        if _attempt > 50 then
          _final_username := 'user_' || replace(substr(new.id::text, 1, 13), '-', '');
          insert into public.profiles (user_id, username, display_name, avatar_url)
          values (new.id, _final_username, _display_name, new.raw_user_meta_data->>'avatar_url')
          on conflict (user_id) do nothing;
          exit;
        end if;
    end;
  end loop;

  if to_regclass('public.notification_preferences') is not null then
    insert into public.notification_preferences (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
exception
  when others then
    raise warning 'Muvit handle_new_user failed for user %, error: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill missing profiles for auth users that were created before this fix.
insert into public.profiles (user_id, username, display_name, avatar_url)
select
  u.id,
  public.muvit_safe_username(u.raw_user_meta_data->>'username', u.id),
  coalesce(
    nullif(u.raw_user_meta_data->>'display_name', ''),
    nullif(u.raw_user_meta_data->>'full_name', ''),
    split_part(coalesce(u.email, ''), '@', 1),
    'New User'
  ),
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
where not exists (
  select 1 from public.profiles p where p.user_id = u.id
)
on conflict do nothing;
