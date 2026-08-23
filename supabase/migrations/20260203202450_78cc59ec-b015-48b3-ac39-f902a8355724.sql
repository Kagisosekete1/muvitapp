-- Create table for comment likes
CREATE TABLE public.comment_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Enable RLS
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Create policies for comment likes
CREATE POLICY "Users can view all comment likes"
ON public.comment_likes
FOR SELECT
USING (true);

CREATE POLICY "Users can like comments"
ON public.comment_likes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike their own likes"
ON public.comment_likes
FOR DELETE
USING (auth.uid() = user_id);

-- Add reply_to_id column to comments for threaded replies
ALTER TABLE public.comments 
ADD COLUMN reply_to_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
ADD COLUMN reply_to_username TEXT;

-- Add likes_count to comments for quick reference
ALTER TABLE public.comments
ADD COLUMN likes_count INTEGER NOT NULL DEFAULT 0;

-- Create index for faster comment queries
CREATE INDEX idx_comment_likes_comment_id ON public.comment_likes(comment_id);
CREATE INDEX idx_comments_reply_to ON public.comments(reply_to_id);