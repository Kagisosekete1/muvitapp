-- 1. Add live_alerts preference (default true)
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS live_alerts boolean NOT NULL DEFAULT true;

-- 2. Enable realtime publication for engagement tables
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.likes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.comments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reposts; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_reels; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reels; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Make sure full row payloads are sent for updates
ALTER TABLE public.likes REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.reposts REPLICA IDENTITY FULL;
ALTER TABLE public.saved_reels REPLICA IDENTITY FULL;
ALTER TABLE public.reels REPLICA IDENTITY FULL;