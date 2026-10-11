-- Play Store launch: preserve history but block new money and virtual-currency operations.
UPDATE public.gift_catalog SET active = false WHERE active = true;

REVOKE EXECUTE ON FUNCTION public.send_live_gift(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spend_coins(integer) FROM anon, authenticated;

DROP POLICY IF EXISTS "Users can request payouts" ON public.creator_payouts;

CREATE OR REPLACE FUNCTION public.finalize_battle(_battle_id uuid)
RETURNS public.battles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _battle public.battles;
  _winner uuid;
  _loser uuid;
  _winner_side text;
BEGIN
  SELECT * INTO _battle FROM public.battles WHERE id = _battle_id FOR UPDATE;
  IF _battle.id IS NULL THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF _battle.results_recorded_at IS NOT NULL THEN RETURN _battle; END IF;
  IF _battle.status <> 'open' OR now() < _battle.ends_at THEN RAISE EXCEPTION 'Battle is not ready to finalize'; END IF;
  IF _battle.opponent_id IS NULL OR _battle.challenger_video_url IS NULL OR _battle.opponent_video_url IS NULL THEN RAISE EXCEPTION 'Battle is incomplete'; END IF;

  IF _battle.challenger_votes >= _battle.opponent_votes THEN
    _winner := _battle.challenger_id;
    _loser := _battle.opponent_id;
    _winner_side := 'challenger';
  ELSE
    _winner := _battle.opponent_id;
    _loser := _battle.challenger_id;
    _winner_side := 'opponent';
  END IF;

  INSERT INTO public.user_badges (user_id, badge_type, milestone)
  SELECT _winner, 'battle_win', 1
  WHERE NOT EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = _winner AND badge_type = 'battle_win' AND milestone = 1);

  INSERT INTO public.notifications (user_id, from_user_id, type, message)
  VALUES (_winner, _loser, 'battle_win', 'You won the battle "' || _battle.title || '"'),
         (_loser, _winner, 'battle_loss', 'Battle "' || _battle.title || '" ended. Great moves!');

  UPDATE public.battles
  SET status = 'completed', winner_id = _winner, winner_side = _winner_side, results_recorded_at = now()
  WHERE id = _battle_id RETURNING * INTO _battle;
  RETURN _battle;
END;
$$;
