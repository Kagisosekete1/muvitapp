ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted'
  CHECK (status IN ('pending', 'accepted')),
ADD COLUMN IF NOT EXISTS requested_by uuid,
ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

UPDATE public.conversations
SET status = 'accepted',
    accepted_at = COALESCE(accepted_at, created_at)
WHERE status IS NULL OR status = 'accepted';

CREATE INDEX IF NOT EXISTS conversations_status_idx ON public.conversations(status);
CREATE INDEX IF NOT EXISTS conversations_requested_by_idx ON public.conversations(requested_by);
