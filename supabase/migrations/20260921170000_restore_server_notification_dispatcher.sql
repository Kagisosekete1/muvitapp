-- Use one server-owned route for every notification event.
--
-- Database triggers must not call OneSignal directly: pg_net only confirms a
-- queued HTTP request, not that OneSignal accepted a valid device recipient.
-- The Edge Function validates the webhook secret, applies preferences and
-- deduplication, targets active subscriptions, and records the provider result.

create or replace function public.muvit_dispatch_notification(_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _functions_url text;
  _webhook_secret text;
  _request_id bigint;
begin
  if coalesce(_payload->>'userId', '') = ''
    or coalesce(_payload->>'fromUserId', '') = ''
    or coalesce(_payload->>'type', '') = '' then
    raise warning 'Muvit notification skipped: event payload is incomplete';
    return;
  end if;

  select supabase_functions_url, notification_webhook_secret
    into _functions_url, _webhook_secret
  from public.muvit_backend_config
  where id = true;

  if coalesce(_functions_url, '') = '' or coalesce(_webhook_secret, '') = '' then
    raise warning 'Muvit notification dispatcher is not configured';
    return;
  end if;

  select net.http_post(
    url := rtrim(_functions_url, '/') || '/notification-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-muvit-webhook-secret', _webhook_secret
    ),
    body := _payload,
    timeout_milliseconds := 5000
  ) into _request_id;

  -- pg_net runs asynchronously. The dispatcher writes the final OneSignal
  -- response back to notifications.provider_response and push_status.
  raise log 'Muvit notification dispatcher request queued: %', _request_id;
end;
$$;
