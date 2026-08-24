-- Muv'it closed-app OneSignal push repair.
--
-- Run this in Supabase SQL Editor when in-app Activity rows appear but
-- Android/iOS push notifications do not arrive after the app is closed.
--
-- IMPORTANT:
-- 1. Replace CHANGE_ME_ONESIGNAL_REST_API_KEY with the OneSignal REST API key
--    before running this SQL.
-- 2. Do not commit a filled-in secret key to GitHub.
-- 3. This sends push from Supabase/Postgres via pg_net, not from open app JS.

create extension if not exists pg_net with schema extensions;

create table if not exists public.muvit_backend_config (
  id boolean primary key default true check (id = true),
  supabase_functions_url text,
  notification_webhook_secret text,
  onesignal_app_id text,
  onesignal_rest_api_key text,
  updated_at timestamptz not null default now()
);

alter table public.muvit_backend_config enable row level security;
revoke all on public.muvit_backend_config from anon;
revoke all on public.muvit_backend_config from authenticated;
grant all on public.muvit_backend_config to service_role;

insert into public.muvit_backend_config (
  id,
  supabase_functions_url,
  onesignal_app_id,
  onesignal_rest_api_key
)
values (
  true,
  'https://wvtbqmdizkpcikniysgu.supabase.co/functions/v1',
  '0b049171-0951-40ba-b90e-38fe7e06ae21',
  'CHANGE_ME_ONESIGNAL_REST_API_KEY'
)
on conflict (id) do update
set supabase_functions_url = excluded.supabase_functions_url,
    onesignal_app_id = excluded.onesignal_app_id,
    onesignal_rest_api_key = excluded.onesignal_rest_api_key,
    updated_at = now();

alter table public.notification_preferences
  add column if not exists replies boolean not null default true,
  add column if not exists reposts boolean not null default true,
  add column if not exists battles boolean not null default true,
  add column if not exists uploads boolean not null default true,
  add column if not exists earnings boolean not null default true,
  add column if not exists announcements boolean not null default true,
  add column if not exists message_requests boolean not null default true,
  add column if not exists live_invitations boolean not null default true,
  add column if not exists gifts boolean not null default true,
  add column if not exists verification boolean not null default true,
  add column if not exists moderation boolean not null default true,
  add column if not exists sound_enabled boolean not null default true,
  add column if not exists vibration_enabled boolean not null default true;

alter table public.notifications
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists event_key text,
  add column if not exists deep_link text,
  add column if not exists actor_avatar_url text,
  add column if not exists comment_id uuid,
  add column if not exists battle_id uuid,
  add column if not exists conversation_id uuid,
  add column if not exists live_session_id text,
  add column if not exists push_status text,
  add column if not exists push_sent_at timestamptz,
  add column if not exists push_error text,
  add column if not exists delivery_attempts integer not null default 0,
  add column if not exists provider_response jsonb;

create unique index if not exists notifications_event_key_uidx
  on public.notifications(event_key)
  where event_key is not null;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array[
    'follow','like','comment','comment_reply','message','message_request',
    'mention','tag','repost','share','saved','new_reel',
    'live','live_start','live_started','live_invitation','stream_ended',
    'battle_challenge','battle_invitation','battle_started','battle_accepted',
    'battle_declined','battle_win','battle_loss',
    'gift','stars','upload_ready','upload_failed','earnings',
    'verification','moderation','announcement'
  ]));

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  provider text not null default 'onesignal',
  subscription_id text not null,
  platform text,
  permission_status text not null default 'unknown',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id, provider)
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can view their own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can insert their own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can update their own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can delete their own push subscriptions" on public.push_subscriptions;

create policy "Users can view their own push subscriptions"
on public.push_subscriptions for select
using (auth.uid() = user_id);

create policy "Users can insert their own push subscriptions"
on public.push_subscriptions for insert
with check (auth.uid() = user_id);

create policy "Users can update their own push subscriptions"
on public.push_subscriptions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own push subscriptions"
on public.push_subscriptions for delete
using (auth.uid() = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions(user_id, is_active, permission_status);

create or replace function public.muvit_notification_pref_field(_type text)
returns text
language sql
immutable
as $$
  select case _type
    when 'like' then 'likes'
    when 'saved' then 'likes'
    when 'comment' then 'comments'
    when 'comment_reply' then 'replies'
    when 'follow' then 'follows'
    when 'mention' then 'mentions'
    when 'tag' then 'mentions'
    when 'message' then 'messages'
    when 'message_request' then 'message_requests'
    when 'new_reel' then 'new_reels'
    when 'repost' then 'reposts'
    when 'share' then 'reposts'
    when 'live' then 'live_alerts'
    when 'live_start' then 'live_alerts'
    when 'live_started' then 'live_alerts'
    when 'stream_ended' then 'live_alerts'
    when 'live_invitation' then 'live_invitations'
    when 'battle_challenge' then 'battles'
    when 'battle_invitation' then 'battles'
    when 'battle_started' then 'battles'
    when 'battle_accepted' then 'battles'
    when 'battle_declined' then 'battles'
    when 'battle_win' then 'battles'
    when 'battle_loss' then 'battles'
    when 'upload_ready' then 'uploads'
    when 'upload_failed' then 'uploads'
    when 'earnings' then 'earnings'
    when 'gift' then 'gifts'
    when 'stars' then 'gifts'
    when 'verification' then 'verification'
    when 'moderation' then 'moderation'
    when 'announcement' then 'announcements'
    else null
  end;
$$;

create or replace function public.muvit_notification_title(_type text)
returns text
language sql
immutable
as $$
  select case _type
    when 'like' then 'New Like'
    when 'comment' then 'New Comment'
    when 'comment_reply' then 'New Reply'
    when 'follow' then 'New Follower'
    when 'new_reel' then 'New Muv''z'
    when 'saved' then 'Muv''z Saved'
    when 'message' then 'New Message'
    when 'message_request' then 'New Message Request'
    when 'mention' then 'New Mention'
    when 'tag' then 'You Were Tagged'
    when 'repost' then 'New Repost'
    when 'share' then 'New Share'
    when 'live' then 'Muv''it Live'
    when 'live_start' then 'Muv''it Live'
    when 'live_started' then 'Muv''it Live'
    when 'live_invitation' then 'Live Invitation'
    when 'stream_ended' then 'Live Ended'
    when 'battle_challenge' then 'Battle Challenge'
    when 'battle_invitation' then 'Battle Invitation'
    when 'battle_started' then 'Battle Started'
    when 'battle_accepted' then 'Battle Accepted'
    when 'battle_declined' then 'Battle Declined'
    when 'battle_win' then 'Battle Winner'
    when 'battle_loss' then 'Battle Result'
    when 'upload_ready' then 'Muv''z Ready'
    when 'upload_failed' then 'Upload Needs Attention'
    when 'earnings' then 'Muv''it Earnings'
    when 'gift' then 'New Gift'
    when 'stars' then 'New Stars'
    when 'verification' then 'Verification Update'
    when 'moderation' then 'Account Notice'
    when 'announcement' then 'Muv''it'
    else 'Muv''it'
  end;
$$;

create or replace function public.muvit_notification_body(_type text, _sender_name text, _message text)
returns text
language plpgsql
immutable
as $$
begin
  case _type
    when 'like' then return _sender_name || ' liked your Muv''z';
    when 'comment' then return case when coalesce(_message, '') <> '' then _sender_name || ': "' || left(_message, 120) || '"' else _sender_name || ' commented on your Muv''z' end;
    when 'comment_reply' then return case when coalesce(_message, '') <> '' then _sender_name || ': "' || left(_message, 120) || '"' else _sender_name || ' replied to your comment' end;
    when 'follow' then return _sender_name || ' started following you';
    when 'new_reel' then return _sender_name || ' posted a new Muv''z';
    when 'saved' then return _sender_name || ' saved your Muv''z';
    when 'message' then return case when coalesce(_message, '') <> '' then _sender_name || ': "' || left(_message, 120) || '"' else _sender_name || ' sent you a message' end;
    when 'message_request' then return _sender_name || ' wants to message you';
    when 'mention' then return _sender_name || ' mentioned you';
    when 'tag' then return _sender_name || ' tagged you';
    when 'repost' then return _sender_name || ' reposted your Muv''z';
    when 'share' then return _sender_name || ' shared your Muv''z';
    when 'live' then return _sender_name || ' is live now';
    when 'live_start' then return _sender_name || ' is live now';
    when 'live_started' then return _sender_name || ' is live now';
    when 'live_invitation' then return _sender_name || ' invited you to join a live';
    when 'stream_ended' then return _sender_name || '''s live has ended';
    when 'battle_challenge' then return _sender_name || ' challenged you to a dance battle';
    when 'battle_invitation' then return _sender_name || ' invited you to a dance battle';
    when 'battle_started' then return _sender_name || ' started a dance battle';
    when 'battle_accepted' then return _sender_name || ' accepted your battle invitation';
    when 'battle_declined' then return _sender_name || ' declined your battle invitation';
    when 'battle_win' then return 'You won your dance battle';
    when 'battle_loss' then return 'Your battle result is ready';
    when 'upload_ready' then return 'Your Muv''z is ready to watch and share';
    when 'upload_failed' then return 'Your Muv''z could not finish processing. Please try again.';
    when 'earnings' then return coalesce(_message, 'Your monetization update is ready');
    when 'gift' then return _sender_name || ' sent you a gift';
    when 'stars' then return _sender_name || ' sent you stars';
    when 'verification' then return coalesce(_message, 'Your verification status was updated');
    when 'moderation' then return coalesce(_message, 'There is an important update about your account or content');
    when 'announcement' then return coalesce(_message, 'There is a new Muv''it announcement');
    else return coalesce(_message, 'You have a new Muv''it notification');
  end case;
end;
$$;

create or replace function public.muvit_dispatch_notification(_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _user_id uuid := nullif(_payload->>'userId', '')::uuid;
  _from_user_id uuid := nullif(_payload->>'fromUserId', '')::uuid;
  _type text := _payload->>'type';
  _event_key text := coalesce(nullif(_payload->>'eventId', ''), md5(_payload::text));
  _reel_id uuid := nullif(_payload->>'reelId', '')::uuid;
  _comment_id uuid := nullif(_payload->>'commentId', '')::uuid;
  _battle_id uuid := nullif(_payload->>'battleId', '')::uuid;
  _conversation_id uuid := nullif(_payload->>'conversationId', '')::uuid;
  _live_session_id text := nullif(_payload->>'liveSessionId', '');
  _message text := _payload->>'message';
  _sender_name text;
  _sender_avatar text;
  _actor_username text;
  _title text;
  _body text;
  _deep_link text := '/activity';
  _notification_id uuid;
  _pref_field text;
  _pref_enabled boolean := true;
  _push_enabled boolean := true;
  _onesignal_app_id text;
  _onesignal_rest_api_key text;
  _subscription_ids text[];
  _target jsonb;
  _request_id bigint;
begin
  if _user_id is null or _from_user_id is null or coalesce(_type, '') = '' then
    return;
  end if;

  if _user_id = _from_user_id and _type not in ('upload_ready', 'upload_failed', 'earnings', 'announcement') then
    return;
  end if;

  select
    coalesce(nullif(display_name, ''), nullif(username, ''), 'Someone'),
    nullif(avatar_url, ''),
    username
  into _sender_name, _sender_avatar, _actor_username
  from public.profiles
  where user_id = _from_user_id;

  _sender_name := coalesce(_sender_name, 'Someone');
  _sender_avatar := coalesce(_sender_avatar, 'https://muvit.site/muvit-logo.png');
  _title := public.muvit_notification_title(_type);
  _body := public.muvit_notification_body(_type, _sender_name, _message);

  if _type in ('message', 'message_request') and _conversation_id is not null then
    _deep_link := '/inbox?conversation=' || _conversation_id::text;
  elsif _type in ('live', 'live_start', 'live_started') and _live_session_id is not null then
    _deep_link := '/live?session=' || _live_session_id;
  elsif _reel_id is not null then
    _deep_link := '/activity?reel=' || _reel_id::text || '&type=' || _type;
  elsif _type = 'follow' and coalesce(_actor_username, '') <> '' then
    _deep_link := '/user/' || _actor_username;
  elsif left(_type, 7) = 'battle_' then
    _deep_link := '/battles';
  end if;

  insert into public.notifications (
    user_id,
    from_user_id,
    type,
    reel_id,
    comment_id,
    battle_id,
    conversation_id,
    live_session_id,
    title,
    body,
    message,
    event_key,
    deep_link,
    actor_avatar_url,
    push_status,
    delivery_attempts
  )
  values (
    _user_id,
    _from_user_id,
    _type,
    _reel_id,
    _comment_id,
    _battle_id,
    _conversation_id,
    _live_session_id,
    _title,
    _body,
    _body,
    _event_key,
    _deep_link,
    _sender_avatar,
    'queued',
    0
  )
  on conflict (event_key) do nothing
  returning id into _notification_id;

  if _notification_id is null then
    return;
  end if;

  select onesignal_app_id, onesignal_rest_api_key
  into _onesignal_app_id, _onesignal_rest_api_key
  from public.muvit_backend_config
  where id = true;

  if coalesce(_onesignal_app_id, '') = '' or coalesce(_onesignal_rest_api_key, '') = '' or _onesignal_rest_api_key = 'CHANGE_ME_ONESIGNAL_REST_API_KEY' then
    update public.notifications
    set push_status = 'not_configured',
        push_error = 'OneSignal REST API key is not configured'
    where id = _notification_id;
    return;
  end if;

  select coalesce(push_enabled, true) into _push_enabled
  from public.notification_preferences
  where user_id = _user_id;

  _push_enabled := coalesce(_push_enabled, true);
  if _push_enabled = false then
    update public.notifications set push_status = 'disabled' where id = _notification_id;
    return;
  end if;

  _pref_field := public.muvit_notification_pref_field(_type);
  if _pref_field is not null then
    execute format('select coalesce(%I, true) from public.notification_preferences where user_id = $1', _pref_field)
    into _pref_enabled
    using _user_id;

    _pref_enabled := coalesce(_pref_enabled, true);
    if _pref_enabled = false then
      update public.notifications set push_status = 'disabled' where id = _notification_id;
      return;
    end if;
  end if;

  select array_agg(distinct subscription_id)
  into _subscription_ids
  from public.push_subscriptions
  where user_id = _user_id
    and provider = 'onesignal'
    and is_active = true
    and permission_status = 'granted'
    and coalesce(subscription_id, '') <> '';

  _target := case
    when coalesce(array_length(_subscription_ids, 1), 0) > 0 then
      jsonb_build_object('include_subscription_ids', to_jsonb(_subscription_ids))
    else
      jsonb_build_object(
        'include_aliases',
        jsonb_build_object('external_id', jsonb_build_array(_user_id::text)),
        'target_channel',
        'push'
      )
  end;

  select net.http_post(
    url := 'https://api.onesignal.com/notifications?c=push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Key ' || _onesignal_rest_api_key
    ),
    body := jsonb_build_object(
      'app_id', _onesignal_app_id,
      'headings', jsonb_build_object('en', _title),
      'contents', jsonb_build_object('en', _body),
      'large_icon', _sender_avatar,
      'big_picture', _sender_avatar,
      'chrome_web_icon', _sender_avatar,
      'chrome_web_image', _sender_avatar,
      'small_icon', 'ic_stat_onesignal_default',
      'data', jsonb_build_object(
        'type', _type,
        'notification_id', _notification_id::text,
        'from_user_id', _from_user_id::text,
        'actor_username', _actor_username,
        'reel_id', _reel_id,
        'comment_id', _comment_id,
        'battle_id', _battle_id,
        'conversation_id', _conversation_id,
        'live_session_id', _live_session_id,
        'url', _deep_link
      )
    ) || _target,
    timeout_milliseconds := 5000
  )
  into _request_id;

  update public.notifications
  set push_status = 'submitted_to_onesignal',
      push_sent_at = now(),
      delivery_attempts = delivery_attempts + 1,
      provider_response = jsonb_build_object('pg_net_request_id', _request_id)
  where id = _notification_id;
end;
$$;

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

-- Diagnostics after testing:
-- select id, type, push_status, push_error, provider_response, created_at
-- from public.notifications
-- order by created_at desc
-- limit 20;
--
-- select provider, platform, permission_status, is_active, count(*)
-- from public.push_subscriptions
-- group by 1,2,3,4
-- order by 1,2,3,4;
