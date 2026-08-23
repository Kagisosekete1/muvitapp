
-- Allow media-only messages in DMs
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS message_content_length;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_type text;
ALTER TABLE public.messages
  ADD CONSTRAINT message_content_length
  CHECK (
    (length(content) <= 5000)
    AND (length(content) > 0 OR media_url IS NOT NULL)
  );
ALTER TABLE public.messages
  ADD CONSTRAINT message_media_type_check
  CHECK (media_type IS NULL OR media_type IN ('image','video'));

-- Allow @mention notifications + existing battle/repost types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'follow','like','comment','message','mention',
    'repost','battle_challenge','battle_win','battle_loss'
  ]));
