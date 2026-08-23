-- Harden Muv'it Live around LiveKit rooms, session lifecycle, comments, and cleanup.

ALTER TABLE public.live_streams
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.live_streams
  DROP CONSTRAINT IF EXISTS live_streams_status_check;

ALTER TABLE public.live_streams
  ADD CONSTRAINT live_streams_status_check
  CHECK (status IN ('scheduled', 'live', 'ended'));

UPDATE public.live_streams
SET status = CASE WHEN is_active THEN 'live' ELSE 'ended' END
WHERE status IS NULL OR status NOT IN ('scheduled', 'live', 'ended');

WITH ranked_active_lives AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id ORDER BY started_at DESC NULLS LAST, created_at DESC NULLS LAST) AS rn
  FROM public.live_streams
  WHERE is_active = true
)
UPDATE public.live_streams ls
SET is_active = false,
    status = 'ended',
    ended_at = COALESCE(ls.ended_at, now())
FROM ranked_active_lives ranked
WHERE ls.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS live_streams_one_active_per_streamer_idx
  ON public.live_streams (user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS live_streams_active_started_idx
  ON public.live_streams (is_active, started_at DESC);

CREATE INDEX IF NOT EXISTS live_streams_session_active_idx
  ON public.live_streams (session_id, is_active);

CREATE TABLE IF NOT EXISTS public.live_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id text NOT NULL REFERENCES public.live_streams(session_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(trim(message)) > 0 AND char_length(message) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Live comments visible for active streams" ON public.live_comments;
DROP POLICY IF EXISTS "Users can comment on active streams" ON public.live_comments;
DROP POLICY IF EXISTS "Users can delete own live comments" ON public.live_comments;

CREATE POLICY "Live comments visible for active streams"
ON public.live_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.live_streams ls
    WHERE ls.session_id = live_comments.live_id
      AND (ls.is_active = true OR ls.user_id = auth.uid())
  )
);

CREATE POLICY "Users can comment on active streams"
ON public.live_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.live_streams ls
    WHERE ls.session_id = live_comments.live_id
      AND ls.is_active = true
  )
);

CREATE POLICY "Users can delete own live comments"
ON public.live_comments FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS live_comments_live_created_idx
  ON public.live_comments (live_id, created_at DESC);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_comments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.mark_stale_live_streams_ended()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated integer;
BEGIN
  UPDATE public.live_streams
  SET is_active = false,
      status = 'ended',
      ended_at = COALESCE(ended_at, now())
  WHERE is_active = true
    AND last_heartbeat_at < now() - interval '3 minutes';

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;
$$;
