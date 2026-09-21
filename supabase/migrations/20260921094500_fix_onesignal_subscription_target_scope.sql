-- The subscription target must be merged into the notification payload, not
-- into additional data. OneSignal otherwise sees a notification with no target.
do $$
declare
  _definition text;
  _updated_definition text;
begin
  select pg_get_functiondef('public.muvit_dispatch_notification(jsonb)'::regprocedure)
  into _definition;

  _updated_definition := replace(
    _definition,
    '      ) || _target' || chr(10) || '    ), timeout_milliseconds := 5000',
    '      )' || chr(10) || '    ) || _target, timeout_milliseconds := 5000'
  );

  if _updated_definition = _definition then
    raise exception 'Could not move OneSignal subscription target to the notification payload';
  end if;

  execute _updated_definition;
end;
$$;
