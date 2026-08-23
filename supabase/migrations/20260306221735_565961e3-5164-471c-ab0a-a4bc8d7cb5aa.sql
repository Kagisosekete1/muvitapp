
CREATE TABLE public.reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, reel_id)
);

ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reposts are viewable by everyone" ON public.reposts FOR SELECT USING (true);
CREATE POLICY "Users can repost" ON public.reposts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unrepost" ON public.reposts FOR DELETE USING (auth.uid() = user_id);

-- Add reposts_count to reels
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS reposts_count integer DEFAULT 0;
