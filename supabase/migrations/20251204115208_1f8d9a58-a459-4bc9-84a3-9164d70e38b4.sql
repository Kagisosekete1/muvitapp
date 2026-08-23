-- Create function to increment view count (only for non-owners)
CREATE OR REPLACE FUNCTION public.increment_view_count(reel_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reels 
  SET views_count = COALESCE(views_count, 0) + 1 
  WHERE id = reel_id;
END;
$$;