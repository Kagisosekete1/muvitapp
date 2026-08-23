DROP POLICY IF EXISTS "Participants can add their battle videos" ON public.battles;
REVOKE UPDATE ON public.battles FROM authenticated;

CREATE OR REPLACE FUNCTION public.submit_battle_response(
  _battle_id uuid,
  _video_url text,
  _thumbnail_url text DEFAULT NULL,
  _caption text DEFAULT NULL
)
RETURNS public.battles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _battle public.battles;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _video_url IS NULL OR length(trim(_video_url)) = 0 THEN
    RAISE EXCEPTION 'Video is required';
  END IF;

  SELECT * INTO _battle
  FROM public.battles
  WHERE id = _battle_id
  FOR UPDATE;

  IF _battle.id IS NULL THEN
    RAISE EXCEPTION 'Battle not found';
  END IF;

  IF _battle.opponent_id IS DISTINCT FROM _uid THEN
    RAISE EXCEPTION 'Only the challenged opponent can respond';
  END IF;

  IF _battle.opponent_video_url IS NOT NULL THEN
    RAISE EXCEPTION 'This battle already has a response';
  END IF;

  IF _battle.status <> 'open' THEN
    RAISE EXCEPTION 'This battle is not open';
  END IF;

  UPDATE public.battles
  SET opponent_video_url = _video_url,
      opponent_thumbnail_url = _thumbnail_url,
      opponent_caption = NULLIF(trim(COALESCE(_caption, '')), ''),
      starts_at = now(),
      ends_at = now() + interval '24 hours'
  WHERE id = _battle_id
  RETURNING * INTO _battle;

  RETURN _battle;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_battle_response(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_battle_response(uuid, text, text, text) TO service_role;