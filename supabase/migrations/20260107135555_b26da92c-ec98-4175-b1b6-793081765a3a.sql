-- Add is_tutorial column to reels table
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS is_tutorial boolean DEFAULT false;

-- Add live_streams table for active live sessions
CREATE TABLE IF NOT EXISTS public.live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  session_id text NOT NULL UNIQUE,
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  viewer_count integer DEFAULT 0,
  likes_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view active live streams
CREATE POLICY "Anyone can view active live streams"
ON public.live_streams
FOR SELECT
USING (is_active = true);

-- Users can manage their own live streams
CREATE POLICY "Users can manage their own live streams"
ON public.live_streams
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for live_streams
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;