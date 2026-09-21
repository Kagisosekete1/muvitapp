-- A saved OneSignal subscription is the reliable path for installed PWAs.
-- Some existing subscriptions predate external-id linking, so aliases alone
-- are accepted by OneSignal but have no recipient.
do $$
declare
  _definition text;
  _updated_definition text;
begin
  select pg_get_functiondef('public.muvit_dispatch_notification(jsonb)'::regprocedure)
  into _definition;

  _updated_definition := replace(
    _definition,
    '  _request_id bigint;' || chr(10) || 'begin',
    '  _request_id bigint;' || chr(10) || '  _subscription_ids text[];' || chr(10) || '  _target jsonb;' || chr(10) || 'begin'
  );

  _updated_definition := replace(
    _updated_definition,
    '  select net.http_post(',
    '  select array_agg(distinct subscription_id) into _subscription_ids from public.push_subscriptions' || chr(10) ||
    '  where user_id = _user_id and provider = ''onesignal'' and is_active = true' || chr(10) ||
    '    and coalesce(permission_status, ''unknown'') <> ''denied'' and coalesce(subscription_id, '''') <> '''';' || chr(10) ||
    '  _target := case when coalesce(array_length(_subscription_ids, 1), 0) > 0' || chr(10) ||
    '    then jsonb_build_object(''include_subscription_ids'', to_jsonb(_subscription_ids))' || chr(10) ||
    '    else jsonb_build_object(''include_aliases'', jsonb_build_object(''external_id'', jsonb_build_array(_user_id::text)), ''target_channel'', ''push'') end;' || chr(10) ||
    '  select net.http_post('
  );

  _updated_definition := replace(
    _updated_definition,
    '      ''include_aliases'', jsonb_build_object(''external_id'', jsonb_build_array(_user_id::text)),' || chr(10) ||
    '      ''target_channel'', ''push'',' || chr(10),
    ''
  );

  _updated_definition := replace(
    _updated_definition,
    '      )' || chr(10) || '    ), timeout_milliseconds := 5000',
    '      ) || _target' || chr(10) || '    ), timeout_milliseconds := 5000'
  );

  if _updated_definition = _definition then
    raise exception 'Could not add OneSignal subscription targeting to muvit_dispatch_notification';
  end if;

  execute _updated_definition;
end;
$$;
