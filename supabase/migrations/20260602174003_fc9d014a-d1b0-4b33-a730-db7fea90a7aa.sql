CREATE TABLE public.battles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL DEFAULT 'Dance Battle',
  prompt text,
  challenger_id uuid NOT NULL,
  opponent_id uuid,
  challenger_reel_id uuid,
  opponent_reel_id uuid,
  challenger_video_url text,
  opponent_video_url text,
  challenger_thumbnail_url text,
  opponent_thumbnail_url text,
  challenger_caption text,
  opponent_caption text,
  status text NOT NULL DEFAULT 'open',
  challenger_votes integer NOT NULL DEFAULT 0,
  opponent_votes integer NOT NULL DEFAULT 0,
  winner_id uuid,
  winner_side text,
  bonus_coins integer NOT NULL DEFAULT 250,
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  ends_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  results_recorded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.battles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.battles TO authenticated;
GRANT ALL ON public.battles TO service_role;

ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Battles are viewable by everyone"
ON public.battles
FOR SELECT
USING (true);

CREATE POLICY "Users can create their own battles"
ON public.battles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Participants can add their battle videos"
ON public.battles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = challenger_id OR auth.uid() = opponent_id
)
WITH CHECK (
  auth.uid() = challenger_id OR auth.uid() = opponent_id
);

CREATE TABLE public.battle_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id uuid NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL,
  voted_for_user_id uuid NOT NULL,
  voted_side text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (battle_id, voter_id)
);

GRANT SELECT ON public.battle_votes TO anon;
GRANT SELECT, INSERT ON public.battle_votes TO authenticated;
GRANT ALL ON public.battle_votes TO service_role;

ALTER TABLE public.battle_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Battle votes are viewable by everyone"
ON public.battle_votes
FOR SELECT
USING (true);

CREATE POLICY "Users can vote once per battle"
ON public.battle_votes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = voter_id);

CREATE INDEX idx_battles_status_ends_at ON public.battles(status, ends_at DESC);
CREATE INDEX idx_battles_winner ON public.battles(winner_id) WHERE winner_id IS NOT NULL;
CREATE INDEX idx_battle_votes_battle ON public.battle_votes(battle_id);

CREATE TRIGGER update_battles_updated_at
BEFORE UPDATE ON public.battles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.submit_battle_vote(_battle_id uuid, _voted_side text)
RETURNS public.battles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _battle public.battles;
  _voted_for uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _voted_side NOT IN ('challenger', 'opponent') THEN
    RAISE EXCEPTION 'Invalid vote side';
  END IF;

  SELECT * INTO _battle
  FROM public.battles
  WHERE id = _battle_id
  FOR UPDATE;

  IF _battle.id IS NULL THEN
    RAISE EXCEPTION 'Battle not found';
  END IF;

  IF _battle.status <> 'open' OR now() >= _battle.ends_at THEN
    RAISE EXCEPTION 'Battle voting is closed';
  END IF;

  IF _battle.challenger_video_url IS NULL OR _battle.opponent_video_url IS NULL THEN
    RAISE EXCEPTION 'Battle is not ready for voting';
  END IF;

  IF _voted_side = 'challenger' THEN
    _voted_for := _battle.challenger_id;
  ELSE
    _voted_for := _battle.opponent_id;
  END IF;

  IF _voted_for IS NULL THEN
    RAISE EXCEPTION 'This battle side is empty';
  END IF;

  IF _uid = _battle.challenger_id OR _uid = _battle.opponent_id THEN
    RAISE EXCEPTION 'Participants cannot vote in their own battle';
  END IF;

  INSERT INTO public.battle_votes (battle_id, voter_id, voted_for_user_id, voted_side)
  VALUES (_battle_id, _uid, _voted_for, _voted_side);

  IF _voted_side = 'challenger' THEN
    UPDATE public.battles
    SET challenger_votes = challenger_votes + 1
    WHERE id = _battle_id
    RETURNING * INTO _battle;
  ELSE
    UPDATE public.battles
    SET opponent_votes = opponent_votes + 1
    WHERE id = _battle_id
    RETURNING * INTO _battle;
  END IF;

  RETURN _battle;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_battle_vote(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_battle_vote(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_battle(_battle_id uuid)
RETURNS public.battles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _battle public.battles;
  _winner uuid;
  _winner_side text;
BEGIN
  SELECT * INTO _battle
  FROM public.battles
  WHERE id = _battle_id
  FOR UPDATE;

  IF _battle.id IS NULL THEN
    RAISE EXCEPTION 'Battle not found';
  END IF;

  IF _battle.results_recorded_at IS NOT NULL THEN
    RETURN _battle;
  END IF;

  IF _battle.status <> 'open' OR now() < _battle.ends_at THEN
    RAISE EXCEPTION 'Battle is not ready to finalize';
  END IF;

  IF _battle.opponent_id IS NULL OR _battle.challenger_video_url IS NULL OR _battle.opponent_video_url IS NULL THEN
    RAISE EXCEPTION 'Battle is incomplete';
  END IF;

  IF _battle.challenger_votes >= _battle.opponent_votes THEN
    _winner := _battle.challenger_id;
    _winner_side := 'challenger';
  ELSE
    _winner := _battle.opponent_id;
    _winner_side := 'opponent';
  END IF;

  INSERT INTO public.user_coins (user_id, balance, total_earned)
  VALUES (_winner, _battle.bonus_coins, _battle.bonus_coins)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = public.user_coins.balance + EXCLUDED.balance,
      total_earned = public.user_coins.total_earned + EXCLUDED.total_earned,
      updated_at = now();

  INSERT INTO public.user_badges (user_id, badge_type, milestone)
  SELECT _winner, 'battle_win', 1
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_badges
    WHERE user_id = _winner AND badge_type = 'battle_win' AND milestone = 1
  );

  UPDATE public.battles
  SET status = 'completed',
      winner_id = _winner,
      winner_side = _winner_side,
      results_recorded_at = now()
  WHERE id = _battle_id
  RETURNING * INTO _battle;

  RETURN _battle;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_battle(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.finalize_battle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_battle(uuid) TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.battles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_votes;