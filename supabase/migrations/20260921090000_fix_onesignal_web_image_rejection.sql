-- OneSignal rejects a whole notification when chrome_web_image contains a long
-- signed avatar/storage URL. Keep the Muv'it web icon and badge, but omit that
-- optional field so Android and PWA pushes are accepted.
do $$
declare
  _definition text;
  _updated_definition text;
begin
  select pg_get_functiondef('public.muvit_dispatch_notification(jsonb)'::regprocedure)
  into _definition;

  _updated_definition := regexp_replace(
    _definition,
    E'[[:space:]]*''chrome_web_image'',[[:space:]]*_sender_avatar,?',
    E'\n',
    'g'
  );

  if _updated_definition = _definition then
    raise exception 'Could not remove the invalid chrome_web_image field from muvit_dispatch_notification';
  end if;

  execute _updated_definition;
end;
$$;
