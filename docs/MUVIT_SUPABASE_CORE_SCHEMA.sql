-- Muv'it core Supabase schema for a fresh project.
-- Run this in Supabase SQL Editor after creating the project.
-- Then deploy Edge Functions and set secrets:
--   notification-dispatcher
--   send-push-notification
--   process-reel-upload
--   livekit-token
--
-- Replace CHANGE_ME_NOTIFICATION_WEBHOOK_SECRET before running.

create extension if not exists pgcrypto;
create extension if not exists pg_net with schema extensions;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles
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

alter table public.profiles enable row level security;
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'display_name', 'New User'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Reels / Muv'z
create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_url text not null,
  thumbnail_url text,
  title text not null,
  description text,
  likes_count integer default 0,
  comments_count integer default 0,
  shares_count integer default 0,
  views_count integer default 0,
  reposts_count integer default 0,
  is_portrait boolean default true,
  is_tutorial boolean default false,
  upload_status text not null default 'ready',
  processing_status text not null default 'ready',
  processing_started_at timestamptz default now(),
  processing_completed_at timestamptz,
  processing_error text,
  source_storage_path text,
  file_size_bytes bigint,
  mime_type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint reels_upload_status_check check (upload_status in ('uploading','uploaded','processing','ready','failed')),
  constraint reels_processing_status_check check (processing_status in ('queued','processing','ready','failed'))
);

alter table public.reels enable row level security;
drop policy if exists "Reels are viewable by everyone" on public.reels;
drop policy if exists "Users can insert own reels" on public.reels;
drop policy if exists "Users can update own reels" on public.reels;
drop policy if exists "Users can delete own reels" on public.reels;
create policy "Reels are viewable by everyone" on public.reels for select using (true);
create policy "Users can insert own reels" on public.reels for insert with check (auth.uid() = user_id);
create policy "Users can update own reels" on public.reels for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own reels" on public.reels for delete using (auth.uid() = user_id);
create index if not exists reels_user_created_idx on public.reels(user_id, created_at desc);
create index if not exists reels_processing_status_idx on public.reels(processing_status, created_at desc);

-- Follows
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

alter table public.follows enable row level security;
drop policy if exists "Follows are viewable by everyone" on public.follows;
drop policy if exists "Users can follow" on public.follows;
drop policy if exists "Users can unfollow" on public.follows;
create policy "Follows are viewable by everyone" on public.follows for select using (true);
create policy "Users can follow" on public.follows for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow" on public.follows for delete using (auth.uid() = follower_id);
create index if not exists follows_follower_idx on public.follows(follower_id);
create index if not exists follows_following_idx on public.follows(following_id);

-- Likes
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reel_id uuid not null references public.reels(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, reel_id)
);

alter table public.likes enable row level security;
drop policy if exists "Likes are viewable by everyone" on public.likes;
drop policy if exists "Users can like reels" on public.likes;
drop policy if exists "Users can unlike reels" on public.likes;
create policy "Likes are viewable by everyone" on public.likes for select using (true);
create policy "Users can like reels" on public.likes for insert with check (auth.uid() = user_id);
create policy "Users can unlike reels" on public.likes for delete using (auth.uid() = user_id);
create index if not exists likes_reel_idx on public.likes(reel_id);

-- Comments and replies
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  reply_to_id uuid references public.comments(id) on delete cascade,
  likes_count integer default 0,
  created_at timestamptz default now()
);

alter table public.comments enable row level security;
drop policy if exists "Comments are viewable by everyone" on public.comments;
drop policy if exists "Users can add comments" on public.comments;
drop policy if exists "Users can delete own comments" on public.comments;
create policy "Comments are viewable by everyone" on public.comments for select using (true);
create policy "Users can add comments" on public.comments for insert with check (auth.uid() = user_id);
create policy "Users can delete own comments" on public.comments for delete using (auth.uid() = user_id);
create index if not exists comments_reel_idx on public.comments(reel_id, created_at desc);
create index if not exists comments_reply_to_idx on public.comments(reply_to_id);

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(comment_id, user_id)
);

alter table public.comment_likes enable row level security;
drop policy if exists "Comment likes are viewable by everyone" on public.comment_likes;
drop policy if exists "Users can like comments" on public.comment_likes;
drop policy if exists "Users can unlike comments" on public.comment_likes;
create policy "Comment likes are viewable by everyone" on public.comment_likes for select using (true);
create policy "Users can like comments" on public.comment_likes for insert with check (auth.uid() = user_id);
create policy "Users can unlike comments" on public.comment_likes for delete using (auth.uid() = user_id);

-- Saves and reposts
create table if not exists public.saved_reels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reel_id uuid not null references public.reels(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, reel_id)
);

alter table public.saved_reels enable row level security;
drop policy if exists "Users can view own saved reels" on public.saved_reels;
drop policy if exists "Users can save reels" on public.saved_reels;
drop policy if exists "Users can unsave reels" on public.saved_reels;
create policy "Users can view own saved reels" on public.saved_reels for select using (auth.uid() = user_id);
create policy "Users can save reels" on public.saved_reels for insert with check (auth.uid() = user_id);
create policy "Users can unsave reels" on public.saved_reels for delete using (auth.uid() = user_id);

create table if not exists public.reposts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reel_id uuid not null references public.reels(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, reel_id)
);

alter table public.reposts enable row level security;
drop policy if exists "Reposts are viewable by everyone" on public.reposts;
drop policy if exists "Users can repost" on public.reposts;
drop policy if exists "Users can unrepost" on public.reposts;
create policy "Reposts are viewable by everyone" on public.reposts for select using (true);
create policy "Users can repost" on public.reposts for insert with check (auth.uid() = user_id);
create policy "Users can unrepost" on public.reposts for delete using (auth.uid() = user_id);

-- Conversations and messages
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_one uuid not null references auth.users(id) on delete cascade,
  participant_two uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(participant_one, participant_two),
  constraint conversations_no_self check (participant_one <> participant_two),
  constraint conversations_status_check check (status in ('pending','accepted','blocked'))
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
drop policy if exists "Users can view their conversations" on public.conversations;
drop policy if exists "Users can create conversations" on public.conversations;
drop policy if exists "Users can view messages in their conversations" on public.messages;
drop policy if exists "Users can send messages" on public.messages;
drop policy if exists "Users can update their messages read status" on public.messages;
create policy "Users can view their conversations" on public.conversations for select using (auth.uid() = participant_one or auth.uid() = participant_two);
create policy "Users can create conversations" on public.conversations for insert with check (auth.uid() = participant_one or auth.uid() = participant_two);
create policy "Users can view messages in their conversations" on public.messages for select using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id
    and (c.participant_one = auth.uid() or c.participant_two = auth.uid())
  )
);
create policy "Users can send messages" on public.messages for insert with check (auth.uid() = sender_id);
create policy "Users can update their messages read status" on public.messages for update using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id
    and (c.participant_one = auth.uid() or c.participant_two = auth.uid())
  )
);

-- Live
create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  session_id text unique not null default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  description text,
  thumbnail_url text,
  status text not null default 'live',
  is_active boolean not null default true,
  viewer_count integer not null default 0,
  started_at timestamptz default now(),
  ended_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint live_streams_status_check check (status in ('scheduled','live','ended'))
);

create table if not exists public.live_comments (
  id uuid primary key default gen_random_uuid(),
  live_id uuid references public.live_streams(id) on delete cascade,
  session_id text,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz default now()
);

alter table public.live_streams enable row level security;
alter table public.live_comments enable row level security;
drop policy if exists "Live streams are viewable by everyone" on public.live_streams;
drop policy if exists "Users can create own live streams" on public.live_streams;
drop policy if exists "Streamers can update own live streams" on public.live_streams;
drop policy if exists "Live comments are viewable by everyone" on public.live_comments;
drop policy if exists "Users can add live comments" on public.live_comments;
create policy "Live streams are viewable by everyone" on public.live_streams for select using (true);
create policy "Users can create own live streams" on public.live_streams for insert with check (auth.uid() = user_id);
create policy "Streamers can update own live streams" on public.live_streams for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Live comments are viewable by everyone" on public.live_comments for select using (true);
create policy "Users can add live comments" on public.live_comments for insert with check (auth.uid() = user_id);

-- Battles
create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid references auth.users(id) on delete cascade,
  challenger_reel_id uuid references public.reels(id) on delete set null,
  opponent_reel_id uuid references public.reels(id) on delete set null,
  title text not null,
  status text not null default 'pending',
  winner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint battles_status_check check (status in ('pending','accepted','declined','active','ended','cancelled'))
);

create table if not exists public.battle_votes (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  voted_for_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(battle_id, voter_id)
);

alter table public.battles enable row level security;
alter table public.battle_votes enable row level security;
drop policy if exists "Battles are viewable by everyone" on public.battles;
drop policy if exists "Users can create battles" on public.battles;
drop policy if exists "Battle participants can update battles" on public.battles;
drop policy if exists "Battle votes are viewable by everyone" on public.battle_votes;
drop policy if exists "Users can vote in battles" on public.battle_votes;
create policy "Battles are viewable by everyone" on public.battles for select using (true);
create policy "Users can create battles" on public.battles for insert with check (auth.uid() = challenger_id);
create policy "Battle participants can update battles" on public.battles for update using (auth.uid() = challenger_id or auth.uid() = opponent_id);
create policy "Battle votes are viewable by everyone" on public.battle_votes for select using (true);
create policy "Users can vote in battles" on public.battle_votes for insert with check (auth.uid() = voter_id);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_user_id uuid references auth.users(id) on delete set null,
  type text not null,
  reel_id uuid references public.reels(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete set null,
  battle_id uuid references public.battles(id) on delete set null,
  live_session_id text,
  conversation_id uuid references public.conversations(id) on delete set null,
  title text,
  body text,
  message text,
  deep_link text,
  actor_avatar_url text,
  event_key text,
  is_read boolean not null default false,
  read_at timestamptz,
  push_status text,
  push_sent_at timestamptz,
  push_error text,
  delivery_attempts integer not null default 0,
  provider_response jsonb,
  created_at timestamptz default now(),
  constraint notifications_type_check check (type = any (array[
    'follow','follow_request','follow_accepted',
    'like','comment','comment_reply','message','message_request','mention','tag',
    'repost','share','saved','new_reel',
    'live','live_start','live_started','live_invitation','stream_ended',
    'battle_challenge','battle_invitation','battle_started','battle_accepted','battle_declined','battle_win','battle_loss',
    'gift','stars','upload_ready','upload_failed','earnings',
    'verification','moderation','announcement'
  ]))
);

alter table public.notifications enable row level security;
drop policy if exists "Users can view their own notifications" on public.notifications;
drop policy if exists "Users can insert notifications for others" on public.notifications;
drop policy if exists "Users can update their own notifications" on public.notifications;
drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can view their own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users can insert notifications for others" on public.notifications for insert with check (auth.uid() = from_user_id);
create policy "Users can update their own notifications" on public.notifications for update using (auth.uid() = user_id);
create policy "Users can delete their own notifications" on public.notifications for delete using (auth.uid() = user_id);
create unique index if not exists notifications_event_key_uidx on public.notifications(event_key) where event_key is not null;
create index if not exists notifications_user_unread_idx on public.notifications(user_id, is_read, created_at desc);
create index if not exists notifications_reel_idx on public.notifications(reel_id);
create index if not exists notifications_comment_idx on public.notifications(comment_id);
create index if not exists notifications_battle_idx on public.notifications(battle_id);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  push_enabled boolean not null default true,
  likes boolean not null default true,
  comments boolean not null default true,
  replies boolean not null default true,
  follows boolean not null default true,
  new_reels boolean not null default true,
  reposts boolean not null default true,
  mentions boolean not null default true,
  messages boolean not null default true,
  message_requests boolean not null default true,
  live_alerts boolean not null default true,
  live_invitations boolean not null default true,
  battles boolean not null default true,
  uploads boolean not null default true,
  earnings boolean not null default true,
  gifts boolean not null default true,
  verification boolean not null default true,
  moderation boolean not null default true,
  announcements boolean not null default true,
  sound_enabled boolean not null default true,
  vibration_enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.notification_preferences enable row level security;
drop policy if exists "Users can view their own notification preferences" on public.notification_preferences;
drop policy if exists "Users can insert their own notification preferences" on public.notification_preferences;
drop policy if exists "Users can update their own notification preferences" on public.notification_preferences;
create policy "Users can view their own notification preferences" on public.notification_preferences for select using (auth.uid() = user_id);
create policy "Users can insert their own notification preferences" on public.notification_preferences for insert with check (auth.uid() = user_id);
create policy "Users can update their own notification preferences" on public.notification_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists update_notification_preferences_updated_at on public.notification_preferences;
create trigger update_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.update_updated_at_column();

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  provider text not null default 'onesignal',
  subscription_id text not null,
  platform text not null,
  permission_status text not null default 'unknown',
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, device_id, provider),
  unique(provider, subscription_id)
);

alter table public.push_subscriptions enable row level security;
drop policy if exists "Users can view their own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can create their own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can update their own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can delete their own push subscriptions" on public.push_subscriptions;
create policy "Users can view their own push subscriptions" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "Users can create their own push subscriptions" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "Users can update their own push subscriptions" on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own push subscriptions" on public.push_subscriptions for delete using (auth.uid() = user_id);
create index if not exists push_subscriptions_user_active_idx on public.push_subscriptions(user_id, is_active, permission_status);

drop trigger if exists update_push_subscriptions_updated_at on public.push_subscriptions;
create trigger update_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row execute function public.update_updated_at_column();

-- Backend dispatch config for DB triggers -> Edge Function -> OneSignal.
create table if not exists public.muvit_backend_config (
  id boolean primary key default true check (id = true),
  supabase_functions_url text not null,
  notification_webhook_secret text,
  updated_at timestamptz not null default now()
);

alter table public.muvit_backend_config enable row level security;
revoke all on public.muvit_backend_config from anon;
revoke all on public.muvit_backend_config from authenticated;
grant all on public.muvit_backend_config to service_role;

insert into public.muvit_backend_config (id, supabase_functions_url, notification_webhook_secret)
values (
  true,
  'https://wvtbqmdizkpcikniysgu.supabase.co/functions/v1',
  'CHANGE_ME_NOTIFICATION_WEBHOOK_SECRET'
)
on conflict (id) do update
set supabase_functions_url = excluded.supabase_functions_url,
    notification_webhook_secret = excluded.notification_webhook_secret,
    updated_at = now();

create or replace function public.muvit_dispatch_notification(_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _functions_url text;
  _webhook_secret text;
begin
  select supabase_functions_url, notification_webhook_secret
  into _functions_url, _webhook_secret
  from public.muvit_backend_config
  where id = true;

  if coalesce(_functions_url, '') = '' or coalesce(_webhook_secret, '') = '' then
    raise warning 'Muvit notification dispatcher is not configured.';
    return;
  end if;

  perform net.http_post(
    url := _functions_url || '/notification-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-muvit-webhook-secret', _webhook_secret
    ),
    body := _payload,
    timeout_milliseconds := 5000
  );
end;
$$;

create or replace function public.muvit_process_reel_upload(_reel_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _functions_url text;
  _webhook_secret text;
begin
  select supabase_functions_url, notification_webhook_secret
  into _functions_url, _webhook_secret
  from public.muvit_backend_config
  where id = true;

  if coalesce(_functions_url, '') = '' or coalesce(_webhook_secret, '') = '' then
    raise warning 'Muvit reel processor is not configured.';
    return;
  end if;

  perform net.http_post(
    url := _functions_url || '/process-reel-upload',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-muvit-webhook-secret', _webhook_secret
    ),
    body := jsonb_build_object('reelId', _reel_id),
    timeout_milliseconds := 5000
  );
end;
$$;

-- Notification triggers
create or replace function public.notify_like_onesignal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _owner_id uuid;
begin
  select user_id into _owner_id from public.reels where id = new.reel_id;
  if _owner_id is not null and _owner_id <> new.user_id then
    perform public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'like:' || new.id,
      'userId', _owner_id,
      'fromUserId', new.user_id,
      'type', 'like',
      'reelId', new.reel_id
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_like_onesignal on public.likes;
create trigger trg_notify_like_onesignal
after insert on public.likes
for each row execute function public.notify_like_onesignal();

create or replace function public.notify_comment_onesignal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _owner_id uuid;
  _reply_owner_id uuid;
begin
  select user_id into _owner_id from public.reels where id = new.reel_id;

  if new.reply_to_id is not null then
    select user_id into _reply_owner_id from public.comments where id = new.reply_to_id;
    if _reply_owner_id is not null and _reply_owner_id <> new.user_id then
      perform public.muvit_dispatch_notification(jsonb_build_object(
        'eventId', 'comment_reply:' || new.id,
        'userId', _reply_owner_id,
        'fromUserId', new.user_id,
        'type', 'comment_reply',
        'reelId', new.reel_id,
        'commentId', new.id,
        'message', new.content
      ));
    end if;
  elsif _owner_id is not null and _owner_id <> new.user_id then
    perform public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'comment:' || new.id,
      'userId', _owner_id,
      'fromUserId', new.user_id,
      'type', 'comment',
      'reelId', new.reel_id,
      'commentId', new.id,
      'message', new.content
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_comment_onesignal on public.comments;
create trigger trg_notify_comment_onesignal
after insert on public.comments
for each row execute function public.notify_comment_onesignal();

create or replace function public.notify_follow_onesignal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.following_id <> new.follower_id then
    perform public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'follow:' || new.id,
      'userId', new.following_id,
      'fromUserId', new.follower_id,
      'type', 'follow'
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_follow_onesignal on public.follows;
create trigger trg_notify_follow_onesignal
after insert on public.follows
for each row execute function public.notify_follow_onesignal();

create or replace function public.notify_repost_onesignal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _owner_id uuid;
begin
  select user_id into _owner_id from public.reels where id = new.reel_id;
  if _owner_id is not null and _owner_id <> new.user_id then
    perform public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'repost:' || new.id,
      'userId', _owner_id,
      'fromUserId', new.user_id,
      'type', 'repost',
      'reelId', new.reel_id
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_repost_onesignal on public.reposts;
create trigger trg_notify_repost_onesignal
after insert on public.reposts
for each row execute function public.notify_repost_onesignal();

create or replace function public.notify_saved_reel_onesignal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _owner_id uuid;
begin
  select user_id into _owner_id from public.reels where id = new.reel_id;
  if _owner_id is not null and _owner_id <> new.user_id then
    perform public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'saved:' || new.id,
      'userId', _owner_id,
      'fromUserId', new.user_id,
      'type', 'saved',
      'reelId', new.reel_id
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_saved_reel_onesignal on public.saved_reels;
create trigger trg_notify_saved_reel_onesignal
after insert on public.saved_reels
for each row execute function public.notify_saved_reel_onesignal();

create or replace function public.notify_new_reel_and_process()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _follower record;
begin
  perform public.muvit_process_reel_upload(new.id);

  for _follower in select follower_id from public.follows where following_id = new.user_id
  loop
    if _follower.follower_id <> new.user_id then
      perform public.muvit_dispatch_notification(jsonb_build_object(
        'eventId', 'new_reel:' || new.id || ':' || _follower.follower_id,
        'userId', _follower.follower_id,
        'fromUserId', new.user_id,
        'type', 'new_reel',
        'reelId', new.id,
        'message', new.title
      ));
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_new_reel_and_process on public.reels;
create trigger trg_notify_new_reel_and_process
after insert on public.reels
for each row execute function public.notify_new_reel_and_process();

create or replace function public.notify_message_onesignal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _conversation public.conversations;
  _recipient uuid;
  _type text;
begin
  select * into _conversation from public.conversations where id = new.conversation_id;
  if _conversation.id is null then
    return new;
  end if;

  _recipient := case
    when _conversation.participant_one = new.sender_id then _conversation.participant_two
    else _conversation.participant_one
  end;

  if _recipient is null or _recipient = new.sender_id then
    return new;
  end if;

  _type := case when _conversation.status = 'pending' then 'message_request' else 'message' end;

  perform public.muvit_dispatch_notification(jsonb_build_object(
    'eventId', _type || ':' || new.id,
    'userId', _recipient,
    'fromUserId', new.sender_id,
    'type', _type,
    'conversationId', new.conversation_id,
    'message', left(new.content, 120)
  ));

  return new;
end;
$$;

drop trigger if exists trg_notify_message_onesignal on public.messages;
create trigger trg_notify_message_onesignal
after insert on public.messages
for each row execute function public.notify_message_onesignal();

create or replace function public.notify_live_start_onesignal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _follower record;
  _went_live boolean;
begin
  _went_live :=
    tg_op = 'INSERT'
    and coalesce(new.is_active, false) = true
    and coalesce(new.status, 'live') = 'live';

  if tg_op = 'UPDATE' then
    _went_live :=
      coalesce(old.is_active, false) = false
      and coalesce(new.is_active, false) = true
      and coalesce(new.status, 'live') = 'live';
  end if;

  if not _went_live then
    return new;
  end if;

  for _follower in select follower_id from public.follows where following_id = new.user_id
  loop
    if _follower.follower_id <> new.user_id then
      perform public.muvit_dispatch_notification(jsonb_build_object(
        'eventId', 'live_start:' || new.session_id || ':' || _follower.follower_id,
        'userId', _follower.follower_id,
        'fromUserId', new.user_id,
        'type', 'live_start',
        'liveSessionId', new.session_id,
        'message', new.title
      ));
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_live_start_onesignal on public.live_streams;
create trigger trg_notify_live_start_onesignal
after insert or update of is_active, status on public.live_streams
for each row execute function public.notify_live_start_onesignal();

create or replace function public.notify_battle_onesignal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.opponent_id is not null and new.opponent_id <> new.challenger_id then
    perform public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'battle_challenge:' || new.id,
      'userId', new.opponent_id,
      'fromUserId', new.challenger_id,
      'type', 'battle_challenge',
      'battleId', new.id,
      'message', new.title
    ));
  end if;

  if tg_op = 'UPDATE' and old.winner_id is distinct from new.winner_id and new.winner_id is not null then
    perform public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'battle_win:' || new.id || ':' || new.winner_id,
      'userId', new.winner_id,
      'fromUserId', coalesce(new.challenger_id, new.winner_id),
      'type', 'battle_win',
      'battleId', new.id,
      'message', new.title
    ));

    if new.challenger_id is not null and new.challenger_id <> new.winner_id then
      perform public.muvit_dispatch_notification(jsonb_build_object(
        'eventId', 'battle_loss:' || new.id || ':' || new.challenger_id,
        'userId', new.challenger_id,
        'fromUserId', new.winner_id,
        'type', 'battle_loss',
        'battleId', new.id,
        'message', new.title
      ));
    end if;

    if new.opponent_id is not null and new.opponent_id <> new.winner_id then
      perform public.muvit_dispatch_notification(jsonb_build_object(
        'eventId', 'battle_loss:' || new.id || ':' || new.opponent_id,
        'userId', new.opponent_id,
        'fromUserId', new.winner_id,
        'type', 'battle_loss',
        'battleId', new.id,
        'message', new.title
      ));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_battle_onesignal on public.battles;
create trigger trg_notify_battle_onesignal
after insert or update of winner_id on public.battles
for each row execute function public.notify_battle_onesignal();

-- Helpful realtime setup. Supabase may warn if a table is already in the publication; that is safe.
do $$
begin
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.comments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.live_comments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.live_streams; exception when duplicate_object then null; end;
end $$;
