-- Complete Muv'it notification categories around existing social, message, live, gift and earnings tables.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS message_requests boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS live_invitations boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS gifts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS verification boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS moderation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sound_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vibration_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_response jsonb;

UPDATE public.notifications
SET body = COALESCE(body, message)
WHERE body IS NULL;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'follow','follow_request','follow_accepted',
    'like','comment','comment_reply','message','message_request','mention','tag',
    'repost','share','saved','new_reel',
    'live','live_start','live_started','live_invitation','stream_ended',
    'battle_challenge','battle_invitation','battle_started','battle_accepted','battle_declined','battle_win','battle_loss',
    'gift','stars','upload_ready','upload_failed','earnings',
    'verification','moderation','announcement'
  ]));

CREATE INDEX IF NOT EXISTS notifications_conversation_idx ON public.notifications(conversation_id);
CREATE INDEX IF NOT EXISTS notifications_type_created_idx ON public.notifications(type, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_notification_read_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_read = true AND COALESCE(OLD.is_read, false) = false THEN
    NEW.read_at = COALESCE(NEW.read_at, now());
  END IF;
  IF NEW.is_read = false THEN
    NEW.read_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_notification_read_at ON public.notifications;
CREATE TRIGGER trg_set_notification_read_at
BEFORE UPDATE OF is_read ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.set_notification_read_at();

CREATE OR REPLACE FUNCTION public.notify_message_onesignal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _conversation public.conversations;
  _recipient uuid;
  _type text;
BEGIN
  SELECT * INTO _conversation FROM public.conversations WHERE id = NEW.conversation_id;
  IF _conversation.id IS NULL THEN
    RETURN NEW;
  END IF;

  _recipient := CASE
    WHEN _conversation.participant_one = NEW.sender_id THEN _conversation.participant_two
    ELSE _conversation.participant_one
  END;

  IF _recipient IS NULL OR _recipient = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  _type := CASE WHEN _conversation.status = 'pending' THEN 'message_request' ELSE 'message' END;

  PERFORM public.muvit_dispatch_notification(jsonb_build_object(
    'eventId', _type || ':' || NEW.id,
    'userId', _recipient,
    'fromUserId', NEW.sender_id,
    'type', _type,
    'conversationId', NEW.conversation_id,
    'message', left(NEW.content, 120)
  ));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_message_onesignal ON public.messages;
CREATE TRIGGER trg_notify_message_onesignal
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_message_onesignal();

CREATE OR REPLACE FUNCTION public.notify_saved_reel_onesignal()
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
      'eventId', 'saved:' || NEW.id,
      'userId', _owner_id,
      'fromUserId', NEW.user_id,
      'type', 'saved',
      'reelId', NEW.reel_id
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_saved_reel_onesignal ON public.saved_reels;
CREATE TRIGGER trg_notify_saved_reel_onesignal
AFTER INSERT ON public.saved_reels
FOR EACH ROW
EXECUTE FUNCTION public.notify_saved_reel_onesignal();

CREATE OR REPLACE FUNCTION public.notify_live_gift_onesignal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.receiver_id IS NOT NULL AND NEW.receiver_id <> NEW.sender_id THEN
    PERFORM public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'gift:' || NEW.id,
      'userId', NEW.receiver_id,
      'fromUserId', NEW.sender_id,
      'type', CASE WHEN lower(NEW.gift_type) = 'stars' THEN 'stars' ELSE 'gift' END,
      'liveSessionId', NEW.session_id,
      'message', 'sent you ' || NEW.gift_name
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_live_gift_onesignal ON public.live_gifts;
CREATE TRIGGER trg_notify_live_gift_onesignal
AFTER INSERT ON public.live_gifts
FOR EACH ROW
EXECUTE FUNCTION public.notify_live_gift_onesignal();

CREATE OR REPLACE FUNCTION public.notify_creator_earnings_onesignal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.net_earnings, 0) > 0 THEN
    PERFORM public.muvit_dispatch_notification(jsonb_build_object(
      'eventId', 'earnings:' || NEW.id,
      'userId', NEW.user_id,
      'fromUserId', NEW.user_id,
      'type', 'earnings',
      'reelId', NEW.reel_id,
      'message', 'You earned ' || NEW.currency || ' ' || NEW.net_earnings::text
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_creator_earnings_onesignal ON public.creator_earnings;
CREATE TRIGGER trg_notify_creator_earnings_onesignal
AFTER INSERT ON public.creator_earnings
FOR EACH ROW
EXECUTE FUNCTION public.notify_creator_earnings_onesignal();
