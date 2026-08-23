
-- 1. PRIVATE LOCATION TABLE
CREATE TABLE IF NOT EXISTS public.user_locations (
  user_id uuid PRIMARY KEY,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own location" ON public.user_locations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own location" ON public.user_locations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own location" ON public.user_locations FOR UPDATE USING (auth.uid() = user_id);

INSERT INTO public.user_locations (user_id, latitude, longitude, updated_at)
SELECT user_id, latitude, longitude, COALESCE(location_updated_at, now())
FROM public.profiles
WHERE user_id IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS latitude;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS longitude;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS location_updated_at;

CREATE OR REPLACE FUNCTION public.find_nearby_users(
  _lat double precision,
  _lng double precision,
  _radius_km double precision DEFAULT 50,
  _limit integer DEFAULT 50
)
RETURNS TABLE(user_id uuid, distance_km double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT user_id, distance_km FROM (
    SELECT
      ul.user_id,
      (6371 * acos(LEAST(1.0, GREATEST(-1.0,
        cos(radians(_lat)) * cos(radians(ul.latitude)) *
        cos(radians(ul.longitude) - radians(_lng)) +
        sin(radians(_lat)) * sin(radians(ul.latitude))
      ))))::double precision AS distance_km
    FROM public.user_locations ul
    WHERE ul.user_id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  ) sub
  WHERE distance_km <= _radius_km
  ORDER BY distance_km ASC
  LIMIT _limit;
$$;

-- 2. PRIVATE FINANCIAL FIELDS
CREATE TABLE IF NOT EXISTS public.creator_financials (
  user_id uuid PRIMARY KEY,
  is_monetized boolean NOT NULL DEFAULT false,
  monetization_date timestamptz,
  total_watch_hours numeric NOT NULL DEFAULT 0,
  lifetime_earnings numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_financials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own financials" ON public.creator_financials FOR SELECT USING (auth.uid() = user_id);

INSERT INTO public.creator_financials (user_id, is_monetized, monetization_date, total_watch_hours, lifetime_earnings)
SELECT user_id, COALESCE(is_monetized,false), monetization_date, COALESCE(total_watch_hours,0), COALESCE(lifetime_earnings,0)
FROM public.profiles WHERE user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_monetized;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS monetization_date;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS total_watch_hours;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS lifetime_earnings;

-- 3. BADGES — server-validated awarding
DROP POLICY IF EXISTS "Users can insert their own badges" ON public.user_badges;

CREATE OR REPLACE FUNCTION public.award_badge_if_earned(_badge_type text, _milestone integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _actual numeric := 0;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF _badge_type NOT IN ('likes','views','followers','uploads') THEN RETURN false; END IF;
  IF _milestone <= 0 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_badges WHERE user_id=_uid AND badge_type=_badge_type AND milestone=_milestone) THEN
    RETURN false;
  END IF;
  IF _badge_type='likes' THEN
    SELECT COALESCE(SUM(likes_count),0) INTO _actual FROM public.reels WHERE user_id=_uid;
  ELSIF _badge_type='views' THEN
    SELECT COALESCE(SUM(views_count),0) INTO _actual FROM public.reels WHERE user_id=_uid;
  ELSIF _badge_type='followers' THEN
    SELECT COUNT(*) INTO _actual FROM public.follows WHERE following_id=_uid;
  ELSIF _badge_type='uploads' THEN
    SELECT COUNT(*) INTO _actual FROM public.reels WHERE user_id=_uid;
  END IF;
  IF _actual >= _milestone THEN
    INSERT INTO public.user_badges (user_id, badge_type, milestone) VALUES (_uid, _badge_type, _milestone);
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- 4. COINS — server-validated mutations
DROP POLICY IF EXISTS "Users can update their own coins" ON public.user_coins;

CREATE OR REPLACE FUNCTION public.ensure_user_coins()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_coins (user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_coins(_amount integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _new_balance integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  UPDATE public.user_coins
  SET balance = balance - _amount,
      total_spent = total_spent + _amount,
      updated_at = now()
  WHERE user_id = _uid AND balance >= _amount
  RETURNING balance INTO _new_balance;
  IF _new_balance IS NULL THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  RETURN _new_balance;
END;
$$;

-- 5. REMOVE SENSITIVE TABLES FROM REALTIME
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.watch_sessions;
  EXCEPTION WHEN undefined_object OR undefined_table THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.profile_views;
  EXCEPTION WHEN undefined_object OR undefined_table THEN
    NULL;
  END;
END;
$$;

-- 6. REALTIME CHANNEL AUTHORIZATION
DO $$
BEGIN
  RAISE NOTICE 'Skipping realtime.messages RLS changes; Supabase owns the internal realtime schema on hosted projects.';
END;
$$;
