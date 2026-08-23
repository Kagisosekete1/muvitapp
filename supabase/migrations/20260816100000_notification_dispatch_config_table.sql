-- Supabase SQL editor cannot always set custom app.settings.* parameters.
-- Use a locked server-side config table for DB trigger -> Edge Function dispatch instead.

CREATE TABLE IF NOT EXISTS public.muvit_backend_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  supabase_functions_url text NOT NULL DEFAULT 'https://wvtbqmdizkpcikniysgu.supabase.co/functions/v1',
  notification_webhook_secret text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.muvit_backend_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.muvit_backend_config FROM anon;
REVOKE ALL ON public.muvit_backend_config FROM authenticated;
GRANT ALL ON public.muvit_backend_config TO service_role;

INSERT INTO public.muvit_backend_config (id, supabase_functions_url)
VALUES (true, 'https://wvtbqmdizkpcikniysgu.supabase.co/functions/v1')
ON CONFLICT (id) DO UPDATE
SET supabase_functions_url = EXCLUDED.supabase_functions_url,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.muvit_dispatch_notification(_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _functions_url text;
  _webhook_secret text;
BEGIN
  SELECT supabase_functions_url, notification_webhook_secret
  INTO _functions_url, _webhook_secret
  FROM public.muvit_backend_config
  WHERE id = true;

  IF COALESCE(_functions_url, '') = '' OR COALESCE(_webhook_secret, '') = '' THEN
    RAISE WARNING 'Muvit notification dispatcher is not configured. Update public.muvit_backend_config.notification_webhook_secret.';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := _functions_url || '/notification-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-muvit-webhook-secret', _webhook_secret
    ),
    body := _payload,
    timeout_milliseconds := 5000
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.muvit_process_reel_upload(_reel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _functions_url text;
  _webhook_secret text;
BEGIN
  SELECT supabase_functions_url, notification_webhook_secret
  INTO _functions_url, _webhook_secret
  FROM public.muvit_backend_config
  WHERE id = true;

  IF COALESCE(_functions_url, '') = '' OR COALESCE(_webhook_secret, '') = '' THEN
    RAISE WARNING 'Muvit reel processor is not configured. Update public.muvit_backend_config.notification_webhook_secret.';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := _functions_url || '/process-reel-upload',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-muvit-webhook-secret', _webhook_secret
    ),
    body := jsonb_build_object('reelId', _reel_id),
    timeout_milliseconds := 5000
  );
END;
$$;
