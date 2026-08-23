-- Create profile_views table to track who views profiles
CREATE TABLE public.profile_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_user_id UUID NOT NULL,
  viewer_user_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

-- Create index for fast lookups
CREATE INDEX idx_profile_views_profile_user ON public.profile_views(profile_user_id);
CREATE INDEX idx_profile_views_viewer ON public.profile_views(viewer_user_id);
CREATE INDEX idx_profile_views_viewed_at ON public.profile_views(viewed_at DESC);

-- RLS Policies: Users can insert views and see views on their own profile
CREATE POLICY "Anyone can create profile views"
ON public.profile_views
FOR INSERT
WITH CHECK (auth.uid() = viewer_user_id);

CREATE POLICY "Users can view their own profile views"
ON public.profile_views
FOR SELECT
USING (auth.uid() = profile_user_id);

-- Enable realtime for profile_views
ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_views;