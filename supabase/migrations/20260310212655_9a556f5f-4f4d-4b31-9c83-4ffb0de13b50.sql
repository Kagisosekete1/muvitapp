
-- User coin balances
CREATE TABLE public.user_coins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  balance INTEGER NOT NULL DEFAULT 1000,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_coins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own coins" ON public.user_coins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own coins" ON public.user_coins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own coins" ON public.user_coins FOR UPDATE USING (auth.uid() = user_id);

-- Live gifts sent during streams
CREATE TABLE public.live_gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  gift_type TEXT NOT NULL,
  gift_name TEXT NOT NULL,
  coin_cost INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.live_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view live gifts" ON public.live_gifts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can send gifts" ON public.live_gifts FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Pinned messages in live streams
CREATE TABLE public.live_pinned_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  pinned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.live_pinned_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pinned messages" ON public.live_pinned_messages FOR SELECT USING (true);
CREATE POLICY "Users can pin messages" ON public.live_pinned_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unpin their messages" ON public.live_pinned_messages FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for live_gifts
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_gifts;
