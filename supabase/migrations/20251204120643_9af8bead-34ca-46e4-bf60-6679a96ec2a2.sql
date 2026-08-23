-- Create saved_reels table for bookmarking
CREATE TABLE public.saved_reels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reel_id UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, reel_id)
);

-- Enable RLS
ALTER TABLE public.saved_reels ENABLE ROW LEVEL SECURITY;

-- Users can view their own saved reels
CREATE POLICY "Users can view own saved reels"
ON public.saved_reels FOR SELECT
USING (auth.uid() = user_id);

-- Users can save reels
CREATE POLICY "Users can save reels"
ON public.saved_reels FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can unsave reels
CREATE POLICY "Users can unsave reels"
ON public.saved_reels FOR DELETE
USING (auth.uid() = user_id);

-- Create comments table
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Comments are viewable by everyone
CREATE POLICY "Comments are viewable by everyone"
ON public.comments FOR SELECT
USING (true);

-- Users can add comments
CREATE POLICY "Users can add comments"
ON public.comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete own comments
CREATE POLICY "Users can delete own comments"
ON public.comments FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

-- Create likes table for proper tracking
CREATE TABLE public.likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reel_id UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, reel_id)
);

-- Enable RLS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Likes are viewable by everyone
CREATE POLICY "Likes are viewable by everyone"
ON public.likes FOR SELECT
USING (true);

-- Users can like reels
CREATE POLICY "Users can like reels"
ON public.likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can unlike reels
CREATE POLICY "Users can unlike reels"
ON public.likes FOR DELETE
USING (auth.uid() = user_id);