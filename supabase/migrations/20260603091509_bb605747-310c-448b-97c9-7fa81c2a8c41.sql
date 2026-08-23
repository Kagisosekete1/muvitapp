-- Allow logged-out users to see profiles (public profile pics on Muv'z)
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are publicly viewable"
ON public.profiles
FOR SELECT
USING (true);

GRANT SELECT ON public.profiles TO anon;

-- Notify opponent when challenged, and both participants when battle finalizes
CREATE OR REPLACE FUNCTION public.notify_on_battle_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.opponent_id IS NOT NULL AND NEW.opponent_id <> NEW.challenger_id THEN
    INSERT INTO public.notifications (user_id, from_user_id, type, message, reel_id)
    VALUES (NEW.opponent_id, NEW.challenger_id, 'battle_challenge',
            'challenged you to a dance battle: ' || NEW.title, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_battle_created ON public.battles;
CREATE TRIGGER trg_notify_on_battle_created
AFTER INSERT ON public.battles
FOR EACH ROW EXECUTE FUNCTION public.notify_on_battle_created();

-- Hook into finalize_battle to also send win/loss notifications
CREATE OR REPLACE FUNCTION public.finalize_battle(_battle_id uuid)
 RETURNS battles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _battle public.battles;
  _winner uuid;
  _loser uuid;
  _winner_side text;
BEGIN
  SELECT * INTO _battle FROM public.battles WHERE id = _battle_id FOR UPDATE;

  IF _battle.id IS NULL THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF _battle.results_recorded_at IS NOT NULL THEN RETURN _battle; END IF;
  IF _battle.status <> 'open' OR now() < _battle.ends_at THEN
    RAISE EXCEPTION 'Battle is not ready to finalize';
  END IF;
  IF _battle.opponent_id IS NULL OR _battle.challenger_video_url IS NULL OR _battle.opponent_video_url IS NULL THEN
    RAISE EXCEPTION 'Battle is incomplete';
  END IF;

  IF _battle.challenger_votes >= _battle.opponent_votes THEN
    _winner := _battle.challenger_id;
    _loser := _battle.opponent_id;
    _winner_side := 'challenger';
  ELSE
    _winner := _battle.opponent_id;
    _loser := _battle.challenger_id;
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

  -- Notify winner and loser
  INSERT INTO public.notifications (user_id, from_user_id, type, message)
  VALUES (_winner, _loser, 'battle_win',
          'You won the battle "' || _battle.title || '" 🏆 +' || _battle.bonus_coins || ' coins');
  INSERT INTO public.notifications (user_id, from_user_id, type, message)
  VALUES (_loser, _winner, 'battle_loss',
          'Battle "' || _battle.title || '" ended. Great moves!');

  UPDATE public.battles
  SET status = 'completed',
      winner_id = _winner,
      winner_side = _winner_side,
      results_recorded_at = now()
  WHERE id = _battle_id
  RETURNING * INTO _battle;

  RETURN _battle;
END;
$function$;