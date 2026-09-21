-- A browser or Android endpoint with denied notification permission cannot
-- receive a remote push. Keep the delivery table honest and prevent stale
-- phone records from being selected for later sends.
update public.push_subscriptions
set is_active = false,
    updated_at = now()
where coalesce(permission_status, 'unknown') = 'denied'
  and is_active = true;
