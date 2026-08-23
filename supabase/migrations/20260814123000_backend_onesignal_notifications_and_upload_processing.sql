-- Server-owned OneSignal notification dispatch and reel processing state.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS replies boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reposts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS battles boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS uploads boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS earnings boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS announcements boolean NOT NULL DEFAULT true;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS comment_id uuid REFERENCES public.comments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS battle_id uuid REFERENCES public.battles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS live_session_id text,
  ADD COLUMN IF NOT EXISTS push_status text,
  ADD COLUMN IF NOT EXISTS push_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS push_error text;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'follow','like','comment','comment_reply','message','mention',
    'repost','saved','new_reel','live','live_start','live_started','stream_ended',
    'battle_challenge','battle_win','battle_loss',
    'upload_ready','upload_failed','earnings','announcement'
  ]));

CREATE INDEX IF NOT EXISTS notifications_comment_idx ON public.notifications(comment_id);
CREATE INDEX IF NOT EXISTS notifications_battle_idx ON public.notifications(battle_id);
CREATE INDEX IF NOT EXISTS notifications_live_session_idx ON public.notifications(live_session_id);
CREATE INDEX IF NOT EXISTS notifications_unread_user_idx ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS upload_status text NOT NULL DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processing_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS source_storage_path text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS mime_type text;

ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_upload_status_check;
ALTER TABLE public.reels
  ADD CONSTRAINT reels_upload_status_check
  CHECK (upload_status IN ('uploading','uploaded','processing','ready','failed'));

ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_processing_status_check;
ALTER TABLE public.reels
  ADD CONSTRAINT reels_processing_status_check
  CHECK (processing_status IN ('queued','processing','ready','failed'));

CREATE INDEX IF NOT EXISTS reels_processing_status_idx ON public.reels(processing_status, created_at DESC);

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.muvit_dispatch_notification(_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _functions_url text := current_setting('app.settings.supabase_functions_url', true);
  _webhook_secret text := current_setting('app.settings.notification_webhook_secret', true);
BEGIN
  IF COALESCE(_functions_url, '') = '' OR COALESCE(_webhook_secret, '') = '' THEN
    RAISE WARNING 'Muvit notification dispatcher is not configured. Set app.settings.supabase_functions_url and app.settings.notification_webhook_secret.';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := _functions_url || '/notification-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-muvit-webhook-secret', _webhook_secret
    ),
    body := _payload,
    timeout_milliseconds := 5000
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.muvit_process_reel_upload(_reel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _functions_url text := current_setting('app.settings.supabase_functions_url', true);
  _webhook_secret text := current_setting('app.settings.notification_webhook_secret', true);
BEGIN
  IF COALESCE(_functions_url, '') = '' OR COALESCE(_webhook_secret, '') = '' THEN
    RAISE WARNING 'Muvit reel processor is not configured. Set app.settings.supabase_functions_url and app.settings.notification_webhook_secret.';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := _functions_url || '/process-reel-upload',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-muvit-webhook-secret', _webhook_secret
    ),
    body := jsonb_build_object('reelId', _reel_id),
    timeout_milliseconds := 5000
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_like_onesignal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
BEGIN
  SELECT user_id INTO _owner_id FROM public.reels WHERE id = NEW.reel_id;
  IF _owner_id IS NOT NULL AND _owner_id <> NEW.user_id THEN
    PERFORM public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'like:' || NEW.id,
      'userId', _owner_id,
      'fromUserId', NEW.user_id,
      'type', 'like',
      'reelId', NEW.reel_id
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_like_onesignal ON public.likes;
CREATE TRIGGER trg_notify_like_onesignal
AFTER INSERT ON public.likes
FOR EACH ROW
EXECUTE FUNCTION public.notify_like_onesignal();

CREATE OR REPLACE FUNCTION public.notify_comment_onesignal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _reply_owner_id uuid;
BEGIN
  SELECT user_id INTO _owner_id FROM public.reels WHERE id = NEW.reel_id;

  IF NEW.reply_to_id IS NOT NULL THEN
    SELECT user_id INTO _reply_owner_id FROM public.comments WHERE id = NEW.reply_to_id;
    IF _reply_owner_id IS NOT NULL AND _reply_owner_id <> NEW.user_id THEN
      PERFORM public.muvit_dispatch_notification(jsonb_build_object(
        'eventId', 'comment_reply:' || NEW.id,
        'userId', _reply_owner_id,
        'fromUserId', NEW.user_id,
        'type', 'comment_reply',
        'reelId', NEW.reel_id,
        'commentId', NEW.id,
        'message', NEW.content
      ));
    END IF;
  ELSIF _owner_id IS NOT NULL AND _owner_id <> NEW.user_id THEN
    PERFORM public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'comment:' || NEW.id,
      'userId', _owner_id,
      'fromUserId', NEW.user_id,
      'type', 'comment',
      'reelId', NEW.reel_id,
      'commentId', NEW.id,
      'message', NEW.content
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_comment_onesignal ON public.comments;
CREATE TRIGGER trg_notify_comment_onesignal
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_comment_onesignal();

CREATE OR REPLACE FUNCTION public.notify_follow_onesignal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.following_id <> NEW.follower_id THEN
    PERFORM public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'follow:' || NEW.id,
      'userId', NEW.following_id,
      'fromUserId', NEW.follower_id,
      'type', 'follow'
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_follow_onesignal ON public.follows;
CREATE TRIGGER trg_notify_follow_onesignal
AFTER INSERT ON public.follows
FOR EACH ROW
EXECUTE FUNCTION public.notify_follow_onesignal();

CREATE OR REPLACE FUNCTION public.notify_repost_onesignal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
BEGIN
  SELECT user_id INTO _owner_id FROM public.reels WHERE id = NEW.reel_id;
  IF _owner_id IS NOT NULL AND _owner_id <> NEW.user_id THEN
    PERFORM public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'repost:' || NEW.id,
      'userId', _owner_id,
      'fromUserId', NEW.user_id,
      'type', 'repost',
      'reelId', NEW.reel_id
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_repost_onesignal ON public.reposts;
CREATE TRIGGER trg_notify_repost_onesignal
AFTER INSERT ON public.reposts
FOR EACH ROW
EXECUTE FUNCTION public.notify_repost_onesignal();

CREATE OR REPLACE FUNCTION public.notify_new_reel_and_process()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _follower record;
BEGIN
  PERFORM public.muvit_process_reel_upload(NEW.id);

  FOR _follower IN
    SELECT follower_id FROM public.follows WHERE following_id = NEW.user_id
  LOOP
    IF _follower.follower_id <> NEW.user_id THEN
      PERFORM public.muvit_dispatch_notification(jsonb_build_object(
        'eventId', 'new_reel:' || NEW.id || ':' || _follower.follower_id,
        'userId', _follower.follower_id,
        'fromUserId', NEW.user_id,
        'type', 'new_reel',
        'reelId', NEW.id,
        'message', NEW.title
      ));
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_reel_and_process ON public.reels;
CREATE TRIGGER trg_notify_new_reel_and_process
AFTER INSERT ON public.reels
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_reel_and_process();

CREATE OR REPLACE FUNCTION public.notify_live_start_onesignal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _follower record;
  _went_live boolean;
BEGIN
  _went_live :=
    TG_OP = 'INSERT' AND COALESCE(NEW.is_active, false) = true AND COALESCE(NEW.status, 'live') = 'live';

  IF TG_OP = 'UPDATE' THEN
    _went_live :=
      COALESCE(OLD.is_active, false) = false
      AND COALESCE(NEW.is_active, false) = true
      AND COALESCE(NEW.status, 'live') = 'live';
  END IF;

  IF NOT _went_live THEN
    RETURN NEW;
  END IF;

  FOR _follower IN
    SELECT follower_id FROM public.follows WHERE following_id = NEW.user_id
  LOOP
    IF _follower.follower_id <> NEW.user_id THEN
      PERFORM public.muvit_dispatch_notification(jsonb_build_object(
        'eventId', 'live_start:' || NEW.session_id || ':' || _follower.follower_id,
        'userId', _follower.follower_id,
        'fromUserId', NEW.user_id,
        'type', 'live_start',
        'liveSessionId', NEW.session_id,
        'message', NEW.title
      ));
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_live_start_onesignal ON public.live_streams;
CREATE TRIGGER trg_notify_live_start_onesignal
AFTER INSERT OR UPDATE OF is_active, status ON public.live_streams
FOR EACH ROW
EXECUTE FUNCTION public.notify_live_start_onesignal();

CREATE OR REPLACE FUNCTION public.notify_battle_onesignal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.opponent_id IS NOT NULL AND NEW.opponent_id <> NEW.challenger_id THEN
    PERFORM public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'battle_challenge:' || NEW.id,
      'userId', NEW.opponent_id,
      'fromUserId', NEW.challenger_id,
      'type', 'battle_challenge',
      'battleId', NEW.id,
      'message', NEW.title
    ));
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.winner_id IS DISTINCT FROM NEW.winner_id AND NEW.winner_id IS NOT NULL THEN
    PERFORM public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'battle_win:' || NEW.id || ':' || NEW.winner_id,
      'userId', NEW.winner_id,
      'fromUserId', COALESCE(NEW.challenger_id, NEW.winner_id),
      'type', 'battle_win',
      'battleId', NEW.id,
      'message', NEW.title
    ));

    IF NEW.challenger_id IS NOT NULL AND NEW.challenger_id <> NEW.winner_id THEN
      PERFORM public.muvit_dispatch_notification(jsonb_build_object(
        'eventId', 'battle_loss:' || NEW.id || ':' || NEW.challenger_id,
        'userId', NEW.challenger_id,
        'fromUserId', NEW.winner_id,
        'type', 'battle_loss',
        'battleId', NEW.id,
        'message', NEW.title
      ));
    END IF;

    IF NEW.opponent_id IS NOT NULL AND NEW.opponent_id <> NEW.winner_id THEN
      PERFORM public.muvit_dispatch_notification(jsonb_build_object(
        'eventId', 'battle_loss:' || NEW.id || ':' || NEW.opponent_id,
        'userId', NEW.opponent_id,
        'fromUserId', NEW.winner_id,
        'type', 'battle_loss',
        'battleId', NEW.id,
        'message', NEW.title
      ));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_battle_onesignal ON public.battles;
CREATE TRIGGER trg_notify_battle_onesignal
AFTER INSERT OR UPDATE OF winner_id ON public.battles
FOR EACH ROW
EXECUTE FUNCTION public.notify_battle_onesignal();
