-- Muv'it engagement persistence repair.
-- Run in Supabase SQL Editor when follows/likes/saves/reposts appear then disappear.
-- This fixes the shared backend for BOTH PWA and Android APK/AAB.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Core engagement tables
-- ---------------------------------------------------------------------------

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reel_id uuid not null references public.reels(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, reel_id)
);

create table if not exists public.saved_reels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reel_id uuid not null references public.reels(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, reel_id)
);

create table if not exists public.reposts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reel_id uuid not null references public.reels(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, reel_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  reply_to_id uuid references public.comments(id) on delete cascade,
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(comment_id, user_id)
);

-- Make sure count columns exist and cannot go null.
alter table public.reels add column if not exists likes_count integer default 0;
alter table public.reels add column if not exists comments_count integer default 0;
alter table public.reels add column if not exists shares_count integer default 0;
alter table public.reels add column if not exists reposts_count integer default 0;

update public.reels set likes_count = coalesce(likes_count, 0);
update public.reels set comments_count = coalesce(comments_count, 0);
update public.reels set shares_count = coalesce(shares_count, 0);
update public.reels set reposts_count = coalesce(reposts_count, 0);

alter table public.reels alter column likes_count set default 0;
alter table public.reels alter column comments_count set default 0;
alter table public.reels alter column shares_count set default 0;
alter table public.reels alter column reposts_count set default 0;

-- Useful indexes
create index if not exists follows_follower_idx on public.follows(follower_id);
create index if not exists follows_following_idx on public.follows(following_id);
create index if not exists likes_user_idx on public.likes(user_id);
create index if not exists likes_reel_idx on public.likes(reel_id);
create index if not exists saved_reels_user_idx on public.saved_reels(user_id);
create index if not exists saved_reels_reel_idx on public.saved_reels(reel_id);
create index if not exists reposts_user_idx on public.reposts(user_id);
create index if not exists reposts_reel_idx on public.reposts(reel_id);
create index if not exists comments_reel_created_idx on public.comments(reel_id, created_at desc);
create index if not exists comments_user_idx on public.comments(user_id);
create index if not exists comment_likes_comment_idx on public.comment_likes(comment_id);

-- ---------------------------------------------------------------------------
-- RLS policies that let users persist their own interactions
-- ---------------------------------------------------------------------------

alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.saved_reels enable row level security;
alter table public.reposts enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;

drop policy if exists "Follows are viewable by everyone" on public.follows;
drop policy if exists "Users can follow" on public.follows;
drop policy if exists "Users can unfollow" on public.follows;
drop policy if exists "Users can view follows" on public.follows;
drop policy if exists "Users can create follows" on public.follows;
drop policy if exists "Users can delete own follows" on public.follows;

create policy "Users can view follows"
on public.follows for select
using (true);

create policy "Users can create follows"
on public.follows for insert
with check (auth.uid() = follower_id and follower_id <> following_id);

create policy "Users can delete own follows"
on public.follows for delete
using (auth.uid() = follower_id);

drop policy if exists "Likes are viewable by everyone" on public.likes;
drop policy if exists "Users can like reels" on public.likes;
drop policy if exists "Users can unlike reels" on public.likes;
drop policy if exists "Users can view likes" on public.likes;
drop policy if exists "Users can create likes" on public.likes;
drop policy if exists "Users can delete own likes" on public.likes;

create policy "Users can view likes"
on public.likes for select
using (true);

create policy "Users can create likes"
on public.likes for insert
with check (auth.uid() = user_id);

create policy "Users can delete own likes"
on public.likes for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own saved reels" on public.saved_reels;
drop policy if exists "Users can save reels" on public.saved_reels;
drop policy if exists "Users can unsave reels" on public.saved_reels;
drop policy if exists "Users can view saved reels" on public.saved_reels;
drop policy if exists "Users can create saved reels" on public.saved_reels;
drop policy if exists "Users can delete own saved reels" on public.saved_reels;

create policy "Users can view saved reels"
on public.saved_reels for select
using (auth.uid() = user_id);

create policy "Users can create saved reels"
on public.saved_reels for insert
with check (auth.uid() = user_id);

create policy "Users can delete own saved reels"
on public.saved_reels for delete
using (auth.uid() = user_id);

drop policy if exists "Reposts are viewable by everyone" on public.reposts;
drop policy if exists "Users can repost" on public.reposts;
drop policy if exists "Users can unrepost" on public.reposts;
drop policy if exists "Users can view reposts" on public.reposts;
drop policy if exists "Users can create reposts" on public.reposts;
drop policy if exists "Users can delete own reposts" on public.reposts;

create policy "Users can view reposts"
on public.reposts for select
using (true);

create policy "Users can create reposts"
on public.reposts for insert
with check (auth.uid() = user_id);

create policy "Users can delete own reposts"
on public.reposts for delete
using (auth.uid() = user_id);

drop policy if exists "Comments are viewable by everyone" on public.comments;
drop policy if exists "Users can add comments" on public.comments;
drop policy if exists "Users can delete own comments" on public.comments;
drop policy if exists "Users can view comments" on public.comments;
drop policy if exists "Users can create comments" on public.comments;

create policy "Users can view comments"
on public.comments for select
using (true);

create policy "Users can create comments"
on public.comments for insert
with check (auth.uid() = user_id);

create policy "Users can delete own comments"
on public.comments for delete
using (auth.uid() = user_id);

drop policy if exists "Comment likes are viewable by everyone" on public.comment_likes;
drop policy if exists "Users can like comments" on public.comment_likes;
drop policy if exists "Users can unlike comments" on public.comment_likes;
drop policy if exists "Users can view comment likes" on public.comment_likes;
drop policy if exists "Users can create comment likes" on public.comment_likes;
drop policy if exists "Users can delete own comment likes" on public.comment_likes;

create policy "Users can view comment likes"
on public.comment_likes for select
using (true);

create policy "Users can create comment likes"
on public.comment_likes for insert
with check (auth.uid() = user_id);

create policy "Users can delete own comment likes"
on public.comment_likes for delete
using (auth.uid() = user_id);

grant select on public.follows, public.likes, public.reposts, public.comments, public.comment_likes to anon;
grant select, insert, delete on public.follows, public.likes, public.saved_reels, public.reposts, public.comments, public.comment_likes to authenticated;

-- ---------------------------------------------------------------------------
-- Server-owned counters. Clients should not need to update another user's reel.
-- ---------------------------------------------------------------------------

create or replace function public.muvit_refresh_reel_counts(_reel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reels r
  set
    likes_count = (select count(*)::integer from public.likes l where l.reel_id = _reel_id),
    comments_count = (select count(*)::integer from public.comments c where c.reel_id = _reel_id),
    reposts_count = (select count(*)::integer from public.reposts rp where rp.reel_id = _reel_id)
  where r.id = _reel_id;
end;
$$;

create or replace function public.muvit_refresh_profile_counts(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
  set
    followers_count = (select count(*)::integer from public.follows f where f.following_id = _user_id),
    following_count = (select count(*)::integer from public.follows f where f.follower_id = _user_id),
    reels_count = (select count(*)::integer from public.reels r where r.user_id = _user_id),
    updated_at = now()
  where p.user_id = _user_id;
end;
$$;

create or replace function public.muvit_refresh_comment_like_count(_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.comments c
  set likes_count = (select count(*)::integer from public.comment_likes cl where cl.comment_id = _comment_id)
  where c.id = _comment_id;
end;
$$;

create or replace function public.muvit_after_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.muvit_refresh_reel_counts(coalesce(new.reel_id, old.reel_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_muvit_like_count_insert on public.likes;
drop trigger if exists trg_muvit_like_count_delete on public.likes;
create trigger trg_muvit_like_count_insert
after insert on public.likes
for each row execute function public.muvit_after_like_count();
create trigger trg_muvit_like_count_delete
after delete on public.likes
for each row execute function public.muvit_after_like_count();

create or replace function public.muvit_after_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.muvit_refresh_reel_counts(coalesce(new.reel_id, old.reel_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_muvit_comment_count_insert on public.comments;
drop trigger if exists trg_muvit_comment_count_delete on public.comments;
create trigger trg_muvit_comment_count_insert
after insert on public.comments
for each row execute function public.muvit_after_comment_count();
create trigger trg_muvit_comment_count_delete
after delete on public.comments
for each row execute function public.muvit_after_comment_count();

create or replace function public.muvit_after_repost_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.muvit_refresh_reel_counts(coalesce(new.reel_id, old.reel_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_muvit_repost_count_insert on public.reposts;
drop trigger if exists trg_muvit_repost_count_delete on public.reposts;
create trigger trg_muvit_repost_count_insert
after insert on public.reposts
for each row execute function public.muvit_after_repost_count();
create trigger trg_muvit_repost_count_delete
after delete on public.reposts
for each row execute function public.muvit_after_repost_count();

create or replace function public.muvit_after_follow_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.muvit_refresh_profile_counts(coalesce(new.follower_id, old.follower_id));
  perform public.muvit_refresh_profile_counts(coalesce(new.following_id, old.following_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_muvit_follow_count_insert on public.follows;
drop trigger if exists trg_muvit_follow_count_delete on public.follows;
create trigger trg_muvit_follow_count_insert
after insert on public.follows
for each row execute function public.muvit_after_follow_count();
create trigger trg_muvit_follow_count_delete
after delete on public.follows
for each row execute function public.muvit_after_follow_count();

create or replace function public.muvit_after_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.muvit_refresh_comment_like_count(coalesce(new.comment_id, old.comment_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_muvit_comment_like_count_insert on public.comment_likes;
drop trigger if exists trg_muvit_comment_like_count_delete on public.comment_likes;
create trigger trg_muvit_comment_like_count_insert
after insert on public.comment_likes
for each row execute function public.muvit_after_comment_like_count();
create trigger trg_muvit_comment_like_count_delete
after delete on public.comment_likes
for each row execute function public.muvit_after_comment_like_count();

-- Backfill all current counts once.
update public.reels r
set
  likes_count = (select count(*)::integer from public.likes l where l.reel_id = r.id),
  comments_count = (select count(*)::integer from public.comments c where c.reel_id = r.id),
  reposts_count = (select count(*)::integer from public.reposts rp where rp.reel_id = r.id);

update public.profiles p
set
  followers_count = (select count(*)::integer from public.follows f where f.following_id = p.user_id),
  following_count = (select count(*)::integer from public.follows f where f.follower_id = p.user_id),
  reels_count = (select count(*)::integer from public.reels r where r.user_id = p.user_id),
  updated_at = now();

update public.comments c
set likes_count = (select count(*)::integer from public.comment_likes cl where cl.comment_id = c.id);

-- Realtime helps both PWA and Android refresh without clearing persisted rows.
do $$
begin
  begin alter publication supabase_realtime add table public.follows; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.likes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.saved_reels; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.reposts; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.comments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.comment_likes; exception when duplicate_object then null; end;
end $$;
