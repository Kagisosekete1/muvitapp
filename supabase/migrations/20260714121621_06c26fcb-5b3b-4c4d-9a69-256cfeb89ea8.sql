
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onesignal_player_id text;
CREATE INDEX IF NOT EXISTS profiles_onesignal_player_id_idx ON public.profiles(onesignal_player_id);

CREATE TABLE IF NOT EXISTS public.gift_catalog (
  id text PRIMARY KEY,
  name text NOT NULL,
  emoji text NOT NULL,
  cost integer NOT NULL CHECK (cost > 0),
  animation text NOT NULL DEFAULT 'bounce',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gift_catalog TO anon, authenticated;
GRANT ALL ON public.gift_catalog TO service_role;
ALTER TABLE public.gift_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gift catalog readable by everyone"
ON public.gift_catalog FOR SELECT
USING (true);

CREATE POLICY "Only admins can modify gift catalog"
ON public.gift_catalog FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.gift_catalog (id, name, emoji, cost, animation, sort_order) VALUES
  ('rose',     'Rose',     '🌹', 1,   'bounce', 1),
  ('heart',    'Heart',    '❤️', 5,   'pulse',  2),
  ('fire',     'Fire',     '🔥', 10,  'shake',  3),
  ('star',     'Star',     '⭐', 25,  'spin',   4),
  ('diamond',  'Diamond',  '💎', 50,  'bounce', 5),
  ('crown',    'Crown',    '👑', 100, 'spin',   6),
  ('rocket',   'Rocket',   '🚀', 200, 'bounce', 7),
  ('universe', 'Universe', '🌌', 500, 'pulse',  8)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, emoji = EXCLUDED.emoji, cost = EXCLUDED.cost,
  animation = EXCLUDED.animation, sort_order = EXCLUDED.sort_order, updated_at = now();

CREATE OR REPLACE FUNCTION public.send_live_gift(_session_id text, _gift_id text)
RETURNS TABLE(new_balance integer, gift_name text, gift_emoji text, gift_cost integer, gift_animation text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _stream public.live_streams;
  _gift public.gift_catalog;
  _balance integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _stream FROM public.live_streams WHERE session_id = _session_id AND is_active = true;
  IF _stream.id IS NULL THEN RAISE EXCEPTION 'Live stream not found or ended'; END IF;

  SELECT * INTO _gift FROM public.gift_catalog WHERE id = _gift_id AND active = true;
  IF _gift.id IS NULL THEN RAISE EXCEPTION 'Invalid gift'; END IF;

  UPDATE public.user_coins
  SET balance = balance - _gift.cost,
      total_spent = total_spent + _gift.cost,
      updated_at = now()
  WHERE user_id = _uid AND balance >= _gift.cost
  RETURNING balance INTO _balance;

  IF _balance IS NULL THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  INSERT INTO public.live_gifts (session_id, sender_id, receiver_id, gift_type, gift_name, coin_cost)
  VALUES (_session_id, _uid, _stream.user_id, _gift.id, _gift.name, _gift.cost);

  RETURN QUERY SELECT _balance, _gift.name, _gift.emoji, _gift.cost, _gift.animation;
END;
$$;
