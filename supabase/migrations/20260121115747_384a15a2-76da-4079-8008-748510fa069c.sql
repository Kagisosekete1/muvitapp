-- Create table for country VAT rates
CREATE TABLE public.country_vat_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code text NOT NULL UNIQUE,
  country_name text NOT NULL,
  vat_rate decimal(5,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert common country VAT rates
INSERT INTO public.country_vat_rates (country_code, country_name, vat_rate, currency) VALUES
  ('US', 'United States', 0, 'USD'),
  ('GB', 'United Kingdom', 20, 'GBP'),
  ('DE', 'Germany', 19, 'EUR'),
  ('FR', 'France', 20, 'EUR'),
  ('IT', 'Italy', 22, 'EUR'),
  ('ES', 'Spain', 21, 'EUR'),
  ('NL', 'Netherlands', 21, 'EUR'),
  ('BE', 'Belgium', 21, 'EUR'),
  ('AT', 'Austria', 20, 'EUR'),
  ('CA', 'Canada', 5, 'CAD'),
  ('AU', 'Australia', 10, 'AUD'),
  ('JP', 'Japan', 10, 'JPY'),
  ('ZA', 'South Africa', 15, 'ZAR'),
  ('NG', 'Nigeria', 7.5, 'NGN'),
  ('KE', 'Kenya', 16, 'KES'),
  ('GH', 'Ghana', 12.5, 'GHS'),
  ('IN', 'India', 18, 'INR'),
  ('BR', 'Brazil', 17, 'BRL'),
  ('MX', 'Mexico', 16, 'MXN'),
  ('AE', 'United Arab Emirates', 5, 'AED'),
  ('SG', 'Singapore', 8, 'SGD'),
  ('MY', 'Malaysia', 6, 'MYR'),
  ('PH', 'Philippines', 12, 'PHP'),
  ('TH', 'Thailand', 7, 'THB'),
  ('ID', 'Indonesia', 11, 'IDR'),
  ('PK', 'Pakistan', 17, 'PKR'),
  ('EG', 'Egypt', 14, 'EGP'),
  ('TR', 'Turkey', 18, 'TRY'),
  ('PL', 'Poland', 23, 'PLN'),
  ('SE', 'Sweden', 25, 'SEK');

-- Enable RLS
ALTER TABLE public.country_vat_rates ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read VAT rates
CREATE POLICY "VAT rates are viewable by everyone"
ON public.country_vat_rates
FOR SELECT
USING (true);

-- Create table for creator earnings
CREATE TABLE public.creator_earnings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  reel_id uuid REFERENCES public.reels(id) ON DELETE SET NULL,
  country_code text NOT NULL DEFAULT 'US',
  gross_earnings decimal(12,4) NOT NULL DEFAULT 0,
  vat_amount decimal(12,4) NOT NULL DEFAULT 0,
  net_earnings decimal(12,4) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  earning_type text NOT NULL DEFAULT 'view', -- 'view', 'engagement', 'bonus'
  watch_hours decimal(10,4) NOT NULL DEFAULT 0,
  period_start timestamp with time zone NOT NULL DEFAULT date_trunc('day', now()),
  period_end timestamp with time zone NOT NULL DEFAULT date_trunc('day', now()) + interval '1 day',
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;

-- Users can view their own earnings
CREATE POLICY "Users can view their own earnings"
ON public.creator_earnings
FOR SELECT
USING (auth.uid() = user_id);

-- System can insert earnings (via service role)
CREATE POLICY "System can insert earnings"
ON public.creator_earnings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create table for creator payout history
CREATE TABLE public.creator_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount decimal(12,4) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  country_code text NOT NULL,
  vat_deducted decimal(12,4) NOT NULL DEFAULT 0,
  payout_method text, -- 'paypal', 'bank', 'mobile_money'
  payout_reference text,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;

-- Users can view their own payouts
CREATE POLICY "Users can view their own payouts"
ON public.creator_payouts
FOR SELECT
USING (auth.uid() = user_id);

-- Users can request payouts
CREATE POLICY "Users can request payouts"
ON public.creator_payouts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add country_code to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country_code text DEFAULT 'US';

-- Add monetization status to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_monetized boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monetization_date timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_watch_hours decimal(12,4) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lifetime_earnings decimal(12,4) DEFAULT 0;

-- Create trigger to update updated_at
CREATE TRIGGER update_country_vat_rates_updated_at
BEFORE UPDATE ON public.country_vat_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_creator_earnings_updated_at
BEFORE UPDATE ON public.creator_earnings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();