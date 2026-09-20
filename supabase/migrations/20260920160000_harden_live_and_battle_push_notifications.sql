-- Live and battle notifications must be emitted by the database, not by an open client.
-- Target the OneSignal external user ID so every active device/PWA subscription receives it.

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
  _request_id bigint;
begin
  if _user_id is null or _from_user_id is null or coalesce(_type, '') = '' then
    return;
  end if;

  if _user_id = _from_user_id and _type not in ('upload_ready', 'upload_failed', 'earnings', 'announcement') then
    return;
  end if;

  select coalesce(nullif(display_name, ''), nullif(username, ''), 'Someone'), nullif(avatar_url, ''), username
  into _sender_name, _sender_avatar, _actor_username
  from public.profiles where user_id = _from_user_id;

  _sender_name := coalesce(_sender_name, 'Someone');
  _sender_avatar := coalesce(_sender_avatar, 'https://muvit.site/icons/android/icon-192x192.png');
  _title := public.muvit_notification_title(_type);
  _body := public.muvit_notification_body(_type, _sender_name, _message);

  if _type in ('message', 'message_request') and _conversation_id is not null then
    _deep_link := '/inbox?conversation=' || _conversation_id::text;
  elsif _type in ('live', 'live_start', 'live_started', 'stream_ended') and _live_session_id is not null then
    _deep_link := '/live?session=' || _live_session_id;
  elsif _reel_id is not null then
    _deep_link := '/activity?reel=' || _reel_id::text || '&type=' || _type;
  elsif _type = 'follow' and coalesce(_actor_username, '') <> '' then
    _deep_link := '/user/' || _actor_username;
  elsif left(_type, 7) = 'battle_' then
    _deep_link := '/battles';
  end if;

  insert into public.notifications (
    user_id, from_user_id, type, reel_id, comment_id, battle_id, conversation_id, live_session_id,
    title, body, message, event_key, deep_link, actor_avatar_url, push_status, delivery_attempts
  ) values (
    _user_id, _from_user_id, _type, _reel_id, _comment_id, _battle_id, _conversation_id, _live_session_id,
    _title, _body, _body, _event_key, _deep_link, _sender_avatar, 'queued', 0
  ) on conflict (event_key) where event_key is not null do update
    set push_status = case when public.notifications.push_status in ('sent', 'disabled', 'preference_skipped', 'submitted_to_onesignal')
      then public.notifications.push_status else 'queued' end
  returning id, push_status into _notification_id, _existing_status;

  if _notification_id is null or _existing_status in ('sent', 'disabled', 'preference_skipped', 'submitted_to_onesignal') then
    return;
  end if;

  select onesignal_app_id, onesignal_rest_api_key
  into _onesignal_app_id, _onesignal_rest_api_key
  from public.muvit_backend_config where id = true;

  if coalesce(_onesignal_app_id, '') = '' or coalesce(_onesignal_rest_api_key, '') = '' or _onesignal_rest_api_key = 'CHANGE_ME_ONESIGNAL_REST_API_KEY' then
    update public.notifications set push_status = 'not_configured', push_error = 'OneSignal is not configured', delivery_attempts = delivery_attempts + 1
    where id = _notification_id;
    return;
  end if;

  select coalesce(push_enabled, true) into _push_enabled from public.notification_preferences where user_id = _user_id;
  if coalesce(_push_enabled, true) = false then
    update public.notifications set push_status = 'disabled' where id = _notification_id;
    return;
  end if;

  _pref_field := public.muvit_notification_pref_field(_type);
  if _pref_field is not null then
    execute format('select coalesce(%I, true) from public.notification_preferences where user_id = $1', _pref_field)
      into _pref_enabled using _user_id;
    if coalesce(_pref_enabled, true) = false then
      update public.notifications set push_status = 'preference_skipped' where id = _notification_id;
      return;
    end if;
  end if;

  select net.http_post(
    url := 'https://api.onesignal.com/notifications?c=push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Key ' || _onesignal_rest_api_key),
    body := jsonb_build_object(
      'app_id', _onesignal_app_id,
      'include_aliases', jsonb_build_object('external_id', jsonb_build_array(_user_id::text)),
      'target_channel', 'push',
      'headings', jsonb_build_object('en', _title),
      'contents', jsonb_build_object('en', _body),
      'large_icon', _sender_avatar,
      'big_picture', _sender_avatar,
      'chrome_web_icon', 'https://muvit.site/icons/android/icon-192x192.png',
      'chrome_web_badge', 'https://muvit.site/icons/onesignal/muvit-badge.png',
      'chrome_web_image', _sender_avatar,
      'small_icon', 'ic_stat_onesignal_default',
      'collapse_id', _notification_id::text,
      'android_group', 'muvit-activity',
      'android_group_message', jsonb_build_object('en', '$[notif_count] new Muv''it notifications'),
      'data', jsonb_build_object(
        'type', _type, 'notification_id', _notification_id::text, 'from_user_id', _from_user_id::text,
        'actor_username', _actor_username, 'reel_id', _reel_id, 'comment_id', _comment_id,
        'battle_id', _battle_id, 'conversation_id', _conversation_id, 'live_session_id', _live_session_id, 'url', _deep_link
      )
    ), timeout_milliseconds := 5000
  ) into _request_id;

  update public.notifications
  set push_status = 'submitted_to_onesignal', push_sent_at = now(), delivery_attempts = delivery_attempts + 1,
      push_error = null, provider_response = jsonb_build_object('pg_net_request_id', _request_id, 'target', 'external_id')
  where id = _notification_id;
end;
$$;

create or replace function public.notify_live_start_onesignal()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _follower record;
  _went_live boolean := false;
  _ended_live boolean := false;
begin
  _went_live := TG_OP = 'INSERT' and coalesce(NEW.is_active, false) and coalesce(NEW.status, 'live') = 'live';
  if TG_OP = 'UPDATE' then
    _went_live := not coalesce(OLD.is_active, false) and coalesce(NEW.is_active, false) and coalesce(NEW.status, 'live') = 'live';
    _ended_live := coalesce(OLD.is_active, false) and (not coalesce(NEW.is_active, false) or NEW.status = 'ended');
  end if;
  if not _went_live and not _ended_live then return NEW; end if;

  for _follower in select follower_id from public.follows where following_id = NEW.user_id loop
    if _follower.follower_id <> NEW.user_id then
      perform public.muvit_dispatch_notification(jsonb_build_object(
        'eventId', case when _went_live then 'live_start:' else 'stream_ended:' end || NEW.session_id || ':' || _follower.follower_id,
        'userId', _follower.follower_id, 'fromUserId', NEW.user_id,
        'type', case when _went_live then 'live_start' else 'stream_ended' end,
        'liveSessionId', NEW.session_id, 'message', NEW.title
      ));
    end if;
  end loop;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_live_start_onesignal on public.live_streams;
create trigger trg_notify_live_start_onesignal
after insert or update of is_active, status on public.live_streams
for each row execute function public.notify_live_start_onesignal();

create or replace function public.notify_battle_onesignal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' and NEW.opponent_id is not null and NEW.opponent_id <> NEW.challenger_id then
    perform public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'battle_challenge:' || NEW.id || ':' || NEW.opponent_id,
      'userId', NEW.opponent_id, 'fromUserId', NEW.challenger_id, 'type', 'battle_challenge', 'battleId', NEW.id, 'message', NEW.title));
  end if;

  if TG_OP = 'UPDATE' and NEW.opponent_id is distinct from OLD.opponent_id
    and NEW.opponent_id is not null and NEW.opponent_id <> NEW.challenger_id then
    perform public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'battle_challenge:' || NEW.id || ':' || NEW.opponent_id,
      'userId', NEW.opponent_id, 'fromUserId', NEW.challenger_id, 'type', 'battle_challenge', 'battleId', NEW.id, 'message', NEW.title));
  end if;

  if TG_OP = 'UPDATE' and OLD.opponent_video_url is null and NEW.opponent_video_url is not null then
    perform public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'battle_accepted:' || NEW.id || ':' || NEW.challenger_id,
      'userId', NEW.challenger_id, 'fromUserId', NEW.opponent_id, 'type', 'battle_accepted', 'battleId', NEW.id, 'message', NEW.title));
  end if;

  if TG_OP = 'UPDATE' and OLD.winner_id is distinct from NEW.winner_id and NEW.winner_id is not null then
    perform public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'battle_win:' || NEW.id || ':' || NEW.winner_id, 'userId', NEW.winner_id,
      'fromUserId', case when NEW.winner_id = NEW.challenger_id then NEW.opponent_id else NEW.challenger_id end,
      'type', 'battle_win', 'battleId', NEW.id, 'message', NEW.title));
    if NEW.challenger_id is not null and NEW.challenger_id <> NEW.winner_id then
      perform public.muvit_dispatch_notification(jsonb_build_object('eventId', 'battle_loss:' || NEW.id || ':' || NEW.challenger_id,
        'userId', NEW.challenger_id, 'fromUserId', NEW.winner_id, 'type', 'battle_loss', 'battleId', NEW.id, 'message', NEW.title));
    end if;
    if NEW.opponent_id is not null and NEW.opponent_id <> NEW.winner_id then
      perform public.muvit_dispatch_notification(jsonb_build_object('eventId', 'battle_loss:' || NEW.id || ':' || NEW.opponent_id,
        'userId', NEW.opponent_id, 'fromUserId', NEW.winner_id, 'type', 'battle_loss', 'battleId', NEW.id, 'message', NEW.title));
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_battle_onesignal on public.battles;
create trigger trg_notify_battle_onesignal
after insert or update of opponent_id, opponent_video_url, winner_id on public.battles
for each row execute function public.notify_battle_onesignal();
