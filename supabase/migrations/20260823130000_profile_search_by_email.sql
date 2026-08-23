CREATE OR REPLACE FUNCTION public.search_muvaz(_query text, _limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  verified boolean,
  followers_count integer,
  bio text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    p.id,
    p.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.verified,
    p.followers_count,
    p.bio
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE auth.uid() IS NOT NULL
    AND p.user_id IS DISTINCT FROM auth.uid()
    AND length(trim(_query)) >= 2
    AND (
      p.username ILIKE '%' || trim(_query) || '%'
      OR p.display_name ILIKE '%' || trim(_query) || '%'
      OR u.email ILIKE '%' || trim(_query) || '%'
    )
  ORDER BY
    CASE
      WHEN p.username ILIKE trim(_query) || '%' THEN 0
      WHEN p.display_name ILIKE trim(_query) || '%' THEN 1
      WHEN u.email ILIKE trim(_query) || '%' THEN 2
      ELSE 3
    END,
    p.followers_count DESC NULLS LAST,
    p.display_name ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 20), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.search_muvaz(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_muvaz(text, integer) TO authenticated;
