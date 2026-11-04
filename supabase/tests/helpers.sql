-- TEST ONLY. Helpers for the SQL tests: make users, switch role, assert.
create schema tests;
grant usage on schema tests to public;

create table tests.ctx (name text primary key, id uuid not null);
grant select on tests.ctx to public;

create function tests.id(p_name text) returns uuid language sql stable as
$$ select id from tests.ctx where name = p_name $$;
grant execute on function tests.id(text) to public;

-- Creates an auth user and its profile (run as the superuser, before logging in).
create function tests.make_user(p_name text, p_role public.app_role, p_employee text default null)
returns uuid language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (v_id, p_name || '@example.test');
  insert into public.profiles (id, role, full_name, employee_id)
  values (v_id, p_role, p_name, case when p_employee is null then null else tests.id(p_employee) end);
  insert into tests.ctx values (p_name, v_id);
  return v_id;
end;
$$;

create function tests.make_employee(p_key text, p_name text, p_team text, p_email text, p_phone text)
returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.employees (employee_code, full_name, team, official_email, phone)
  values ('E-' || p_key, p_name, p_team, p_email, p_phone) returning id into v_id;
  insert into tests.ctx values (p_key, v_id);
  return v_id;
end;
$$;

-- Acts as a signed-in user, the way Supabase does for a request.
create function tests.login(p_user text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.id(p_user), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
grant execute on function tests.login(text) to public;

create function tests.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end;
$$;

create function tests.service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'service_role', true);
end;
$$;
grant execute on function tests.service() to public;

create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;
grant execute on function tests.logout() to public;

create function tests.ok(p_condition boolean, p_message text) returns void language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'FAILED: %', p_message;
  end if;
  raise notice 'ok - %', p_message;
end;
$$;

-- Runs statement p_sql and requires it to fail with an error containing p_expect.
create function tests.throws(p_sql text, p_expect text, p_message text) returns void language plpgsql as $$
declare
  v_error text;
begin
  begin
    execute p_sql;
  exception when others then
    v_error := sqlerrm;
  end;
  if v_error is null then
    raise exception 'FAILED (no error was raised): %', p_message;
  elsif position(p_expect in v_error) = 0 then
    raise exception 'FAILED (wrong error "%"): %', v_error, p_message;
  end if;
  raise notice 'ok - %', p_message;
end;
$$;

-- Lets a test save an id while acting as a restricted role.
create function tests.remember(p_name text, p_id uuid) returns uuid language sql security definer as
$$ insert into tests.ctx values (p_name, p_id) returning id $$;
grant execute on function tests.remember(text, uuid) to public;

-- Like throws, but also checks the SQLSTATE (42501 is how a privilege error reaches the application).
create function tests.throws_state(p_sql text, p_state text, p_expect text, p_message text) returns void language plpgsql as $$
declare
  v_state text;
  v_error text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    v_error := sqlerrm;
  end;
  if v_error is null then
    raise exception 'FAILED (no error was raised): %', p_message;
  elsif v_state <> p_state or position(p_expect in v_error) = 0 then
    raise exception 'FAILED (got % "%"): %', v_state, v_error, p_message;
  end if;
  raise notice 'ok - %', p_message;
end;
$$;
grant execute on function tests.throws_state(text, text, text, text) to public;

create function tests.count(p_sql text) returns bigint language plpgsql as $$
declare
  n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') t' into n;
  return n;
end;
$$;
grant execute on function tests.count(text) to public;
grant execute on function tests.ok(boolean, text) to public;
grant execute on function tests.throws(text, text, text) to public;
grant execute on function tests.anon() to public;

-- The standard cast: HR/Admin, a Receptionist, two employees with private contact details, two cards.
create function tests.fixture() returns void language plpgsql as $$
begin
  perform tests.make_employee('emp_row_1', 'Nusrat Jahan', 'Finance', 'nusrat.private@corp.test', '+880 1700 000001');
  perform tests.make_employee('emp_row_2', 'Imran Hossain', 'Legal', 'imran.private@corp.test', '+880 1700 000002');
  perform tests.make_user('hr', 'admin');
  perform tests.make_user('hr2', 'admin');
  perform tests.make_user('desk', 'receptionist');
  perform tests.make_user('emp1', 'employee', 'emp_row_1');
  perform tests.make_user('emp2', 'employee', 'emp_row_2');
  insert into public.visitor_cards (card_number, created_by) values ('001', tests.id('hr')), ('002', tests.id('hr')), ('003', tests.id('hr'));
  insert into tests.ctx select 'c' || card_number::int, id from public.visitor_cards;
end;
$$;
