-- Create user_badges table for milestone tracking
CREATE TABLE public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_type TEXT NOT NULL, -- 'likes', 'views', 'followers', 'uploads'
  milestone INTEGER NOT NULL, -- e.g., 1000, 10000, 50000
  achieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_type, milestone)
);

-- Enable RLS
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Users can view all badges (for displaying on profiles)
CREATE POLICY "Badges are viewable by everyone"
ON public.user_badges
FOR SELECT
USING (true);

-- Only the system can insert badges (via service role or triggers)
CREATE POLICY "Users can insert their own badges"
ON public.user_badges
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX idx_user_badges_type_milestone ON public.user_badges(badge_type, milestone);