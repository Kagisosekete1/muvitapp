-- Fix closed-app OneSignal delivery for Muv'it.
-- This keeps notification creation server-side and sends remote push from Supabase.

create extension if not exists pg_net with schema extensions;

alter table public.muvit_backend_config
  add column if not exists onesignal_app_id text,
  add column if not exists onesignal_rest_api_key text;

alter table public.notifications
  add column if not exists event_key text,
  add column if not exists push_status text,
  add column if not exists push_error text,
  add column if not exists push_sent_at timestamptz,
  add column if not exists delivery_attempts integer not null default 0,
  add column if not exists provider_response jsonb;

delete from public.notifications n
using public.notifications newer
where n.event_key is not null
  and newer.event_key = n.event_key
  and newer.created_at > n.created_at;

drop index if exists public.notifications_event_key_uidx;
create unique index notifications_event_key_uidx
  on public.notifications(event_key)
  where event_key is not null;

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
  _existing_status text;
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
  on conflict (event_key) where event_key is not null do update
    set push_status = case
      when public.notifications.push_status in ('sent', 'disabled', 'preference_skipped') then public.notifications.push_status
      else 'queued'
    end
  returning id, push_status into _notification_id, _existing_status;

  if _notification_id is null then
    return;
  end if;

  if _existing_status in ('sent', 'disabled', 'preference_skipped') then
    return;
  end if;

  select onesignal_app_id, onesignal_rest_api_key
  into _onesignal_app_id, _onesignal_rest_api_key
  from public.muvit_backend_config
  where id = true;

  if coalesce(_onesignal_app_id, '') = '' or coalesce(_onesignal_rest_api_key, '') = '' or _onesignal_rest_api_key = 'CHANGE_ME_ONESIGNAL_REST_API_KEY' then
    update public.notifications
    set push_status = 'not_configured',
        push_error = 'OneSignal REST API key is not configured',
        delivery_attempts = delivery_attempts + 1
    where id = _notification_id;
    return;
  end if;

  select coalesce(push_enabled, true) into _push_enabled
  from public.notification_preferences
  where user_id = _user_id;

  if coalesce(_push_enabled, true) = false then
    update public.notifications set push_status = 'disabled' where id = _notification_id;
    return;
  end if;

  _pref_field := public.muvit_notification_pref_field(_type);
  if _pref_field is not null then
    execute format('select coalesce(%I, true) from public.notification_preferences where user_id = $1', _pref_field)
    into _pref_enabled
    using _user_id;

    if coalesce(_pref_enabled, true) = false then
      update public.notifications set push_status = 'preference_skipped' where id = _notification_id;
      return;
    end if;
  end if;

  select array_agg(distinct subscription_id)
  into _subscription_ids
  from public.push_subscriptions
  where user_id = _user_id
    and provider = 'onesignal'
    and is_active = true
    and coalesce(permission_status, 'unknown') <> 'denied'
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
      push_error = null,
      provider_response = jsonb_build_object(
        'pg_net_request_id', _request_id,
        'target', case
          when coalesce(array_length(_subscription_ids, 1), 0) > 0 then 'subscription_ids'
          else 'external_id'
        end,
        'subscription_count', coalesce(array_length(_subscription_ids, 1), 0)
      )
  where id = _notification_id;
end;
$$;
