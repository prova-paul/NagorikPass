-- Committed fixtures for the race test: two visits and one card, three desk logins are not needed.
begin;
select tests.fixture();
select tests.login('desk');
select tests.remember('v1', public.register_visit('First Visitor', '01711111111', 'Meeting', 'business_meeting'));
select tests.remember('v2', public.register_visit('Second Visitor', '01722222222', 'Meeting', 'business_meeting'));
select tests.logout();
commit;

create function tests.try_check_in(p_visit text, p_card text) returns text language plpgsql as $$
begin
  perform public.check_in_visit(tests.id(p_visit), array[tests.id(p_card)]);
  -- Hold the locks for a moment so the other session really has to wait.
  perform pg_sleep(1.5);
  return 'ok';
exception when others then
  return sqlerrm;
end;
$$;
grant execute on function tests.try_check_in(text, text) to public;
