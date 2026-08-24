-- Muv'it direct OneSignal push patch.
-- Use this if in-app notifications work but closed-app pushes do not.
--
-- What this does:
-- 1. Keeps notification creation server-side in Supabase.
-- 2. Sends OneSignal push directly from Postgres via pg_net.
-- 3. Does not depend on app JavaScript being open.
-- 4. Does not depend on Edge Function JWT settings for notification-dispatcher.
--
-- Before running:
-- Replace CHANGE_ME_ONESIGNAL_REST_API_KEY with the OneSignal REST API key.

create extension if not exists pg_net with schema extensions;

alter table public.muvit_backend_config
  add column if not exists onesignal_app_id text,
  add column if not exists onesignal_rest_api_key text;

update public.muvit_backend_config
set
  onesignal_app_id = '0b049171-0951-40ba-b90e-38fe7e06ae21',
  onesignal_rest_api_key = 'CHANGE_ME_ONESIGNAL_REST_API_KEY',
  updated_at = now()
where id = true;

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
    when 'battle_win' then 'battles'
    when 'battle_loss' then 'battles'
    when 'upload_ready' then 'uploads'
    when 'upload_failed' then 'uploads'
    when 'earnings' then 'earnings'
    when 'gift' then 'gifts'
    when 'stars' then 'gifts'
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
    when 'new_reel' then 'New Muv'
    when 'saved' then 'Muv Saved'
    when 'message' then 'New Message'
    when 'message_request' then 'New Message Request'
    when 'mention' then 'New Mention'
    when 'tag' then 'New Tag'
    when 'repost' then 'New Repost'
    when 'share' then 'New Share'
    when 'live' then 'Muv''it Live'
    when 'live_start' then 'Muv''it Live'
    when 'live_started' then 'Muv''it Live'
    when 'stream_ended' then 'Live Ended'
    when 'battle_challenge' then 'Battle Challenge'
    when 'battle_win' then 'Battle Won'
    when 'battle_loss' then 'Battle Result'
    when 'upload_ready' then 'Muv''z Ready'
    when 'upload_failed' then 'Upload Needs Attention'
    when 'earnings' then 'Muv''it Earnings'
    when 'gift' then 'New Gift'
    when 'stars' then 'New Stars'
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
    when 'stream_ended' then return _sender_name || '''s live has ended';
    when 'battle_challenge' then return _sender_name || ' challenged you to a dance battle';
    when 'battle_win' then return 'Your battle result is ready';
    when 'battle_loss' then return 'Your battle result is ready';
    when 'upload_ready' then return 'Your Muv''z is ready to watch and share';
    when 'upload_failed' then return 'Your Muv''z could not finish processing. Please try again.';
    when 'earnings' then return coalesce(_message, 'Your monetization update is ready');
    when 'gift' then return _sender_name || ' sent you a gift';
    when 'stars' then return _sender_name || ' sent you stars';
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
  _user_id uuid := (_payload->>'userId')::uuid;
  _from_user_id uuid := (_payload->>'fromUserId')::uuid;
  _type text := _payload->>'type';
  _event_key text := coalesce(_payload->>'eventId', md5(_payload::text));
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
begin
  if _user_id is null or _from_user_id is null or coalesce(_type, '') = '' then
    return;
  end if;

  if _user_id = _from_user_id and _type <> 'earnings' then
    return;
  end if;

  select
    coalesce(nullif(display_name, ''), nullif(username, ''), 'Someone'),
    avatar_url,
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
    live_session_id,
    conversation_id,
    title,
    body,
    message,
    event_key,
    deep_link,
    actor_avatar_url,
    push_status
  )
  values (
    _user_id,
    _from_user_id,
    _type,
    _reel_id,
    _comment_id,
    _battle_id,
    _live_session_id,
    _conversation_id,
    _title,
    _body,
    _body,
    _event_key,
    _deep_link,
    _sender_avatar,
    'queued'
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

  select push_enabled into _push_enabled
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

  perform net.http_post(
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
  );

  update public.notifications
  set push_status = 'sent',
      push_sent_at = now()
  where id = _notification_id;
end;
$$;
