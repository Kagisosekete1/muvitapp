
-- 1. Profiles: restrict SELECT to authenticated users
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 2. Reports: add SELECT/UPDATE/DELETE policies
CREATE POLICY "Admins can view all reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Reporters can view their own reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can update reports"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reports"
  ON public.reports FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Watch sessions: require auth on insert
CREATE TABLE IF NOT EXISTS public.watch_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  viewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  watch_duration_seconds integer NOT NULL DEFAULT 0,
  total_video_duration_seconds integer,
  is_complete boolean NOT NULL DEFAULT false,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.watch_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert watch sessions" ON public.watch_sessions;
DROP POLICY IF EXISTS "Users can update their own watch sessions" ON public.watch_sessions;
DROP POLICY IF EXISTS "Users can view their own watch sessions" ON public.watch_sessions;

CREATE POLICY "Authenticated users can insert their own watch sessions"
  ON public.watch_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (viewer_id IS NULL OR viewer_id = auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "Users can update their own watch sessions"
  ON public.watch_sessions FOR UPDATE
  TO authenticated
  USING (viewer_id = auth.uid())
  WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "Users can view their own watch sessions"
  ON public.watch_sessions FOR SELECT
  TO authenticated
  USING (viewer_id = auth.uid() OR user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_watch_sessions_reel_id ON public.watch_sessions(reel_id);
CREATE INDEX IF NOT EXISTS idx_watch_sessions_viewer_id ON public.watch_sessions(viewer_id);
CREATE INDEX IF NOT EXISTS idx_watch_sessions_user_id ON public.watch_sessions(user_id);

-- 4. increment_view_count: skip self-views and unauthenticated
CREATE OR REPLACE FUNCTION public.increment_view_count(reel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  reel_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  SELECT user_id INTO reel_owner FROM public.reels WHERE id = reel_id;
  IF reel_owner IS NOT NULL AND reel_owner <> auth.uid() THEN
    UPDATE public.reels
      SET views_count = COALESCE(views_count, 0) + 1
      WHERE id = reel_id;
  END IF;
END;
$function$;

-- 5. Messages: tighten UPDATE policy + immutability trigger
DROP POLICY IF EXISTS "Users can update their messages read status" ON public.messages;
CREATE POLICY "Recipients can mark messages as read"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_message_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    RAISE EXCEPTION 'Message content cannot be modified';
  END IF;
  IF OLD.sender_id IS DISTINCT FROM NEW.sender_id THEN
    RAISE EXCEPTION 'Message sender cannot be changed';
  END IF;
  IF OLD.conversation_id IS DISTINCT FROM NEW.conversation_id THEN
    RAISE EXCEPTION 'Message conversation cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_message_immutability ON public.messages;
CREATE TRIGGER enforce_message_immutability
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_message_modification();

-- 6. Length constraints on comments & messages
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comment_content_length;
ALTER TABLE public.comments
  ADD CONSTRAINT comment_content_length
  CHECK (length(content) > 0 AND length(content) <= 2000);

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS message_content_length;
ALTER TABLE public.messages
  ADD CONSTRAINT message_content_length
  CHECK (length(content) > 0 AND length(content) <= 5000);
