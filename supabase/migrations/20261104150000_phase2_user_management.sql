-- Phase 2: user management. Adds a batch default for the visitor-registration permission to the bulk import
-- (EM-6 / A1), and narrows what HR/Admin can write to profiles so a login's role and identity cannot be
-- edited through the API. Adds and tightens only: no data is changed.

-- Bulk import with a default permission for the whole batch ---------------------------------------
-- Same function as 20261104130000, with one added parameter. A call with only p_rows still works and
-- keeps the default of ON (A1). The old one-parameter version is removed so the name stays unambiguous.
drop function public.import_employees(jsonb);

create function public.import_employees(p_rows jsonb, p_can_register_visitors boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_email_pattern constant text := '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';
  elem            jsonb;
  n               integer := 0;
  v_code          text;
  v_name          text;
  v_email         text;
  v_phone         text;
  v_team          text;
  v_designation   text;
  v_errors        text[];
  v_id            uuid;
  v_constraint    text;
  v_seen_codes    jsonb := '{}'::jsonb;
  v_seen_emails   jsonb := '{}'::jsonb;
  v_results       jsonb := '[]'::jsonb;
  v_imported      integer := 0;
  v_failed        integer := 0;
begin
  if public.auth_role() is distinct from 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_can_register_visitors is null then
    raise exception 'validation_error: the visitor-registration permission must be on or off';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'validation_error: rows must be a list';
  end if;
  if jsonb_array_length(p_rows) = 0 then
    raise exception 'validation_error: there are no rows to import';
  end if;
  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'validation_error: at most 1000 rows can be imported at once';
  end if;

  for elem in select value from jsonb_array_elements(p_rows) loop
    n := n + 1;
    v_errors := array[]::text[];
    v_id := null;

    v_code        := btrim(coalesce(elem ->> 'employee_code', ''));
    v_name        := btrim(coalesce(elem ->> 'full_name', ''));
    v_email       := lower(btrim(coalesce(elem ->> 'email', '')));
    v_phone       := nullif(btrim(coalesce(elem ->> 'phone', '')), '');
    v_team        := nullif(btrim(coalesce(elem ->> 'team', '')), '');
    v_designation := nullif(btrim(coalesce(elem ->> 'designation', '')), '');

    if v_code = '' then
      v_errors := array_append(v_errors, 'Employee ID is required');
    elsif char_length(v_code) > 50 then
      v_errors := array_append(v_errors, 'Employee ID must be at most 50 characters');
    elsif v_seen_codes ? lower(v_code) then
      v_errors := array_append(v_errors, ('Duplicate Employee ID: same as row ' || (v_seen_codes ->> lower(v_code))));
    else
      v_seen_codes := v_seen_codes || jsonb_build_object(lower(v_code), n);
      if exists (select 1 from public.employees where lower(employee_code) = lower(v_code)) then
        v_errors := array_append(v_errors, 'Employee ID already exists');
      end if;
    end if;

    if v_name = '' then
      v_errors := array_append(v_errors, 'Full Name is required');
    end if;

    if v_email = '' then
      v_errors := array_append(v_errors, 'Email is required');
    elsif char_length(v_email) > 254 or v_email !~ c_email_pattern then
      v_errors := array_append(v_errors, 'Email is not a valid address');
    elsif v_seen_emails ? v_email then
      v_errors := array_append(v_errors, ('Duplicate email: same as row ' || (v_seen_emails ->> v_email)));
    else
      v_seen_emails := v_seen_emails || jsonb_build_object(v_email, n);
      if exists (select 1 from public.employees where lower(official_email) = v_email) then
        v_errors := array_append(v_errors, 'Email already exists');
      end if;
    end if;

    if cardinality(v_errors) = 0 then
      begin
        insert into public.employees (employee_code, full_name, official_email, phone, team, designation, can_register_visitors)
        values (v_code, v_name, v_email, v_phone, v_team, v_designation, p_can_register_visitors)
        returning id into v_id;
      exception
        when unique_violation then
          -- Someone saved a clashing employee after the checks above ran.
          get stacked diagnostics v_constraint = constraint_name;
          v_id := null;
          v_errors := array[case when v_constraint like '%employee_code%' then 'Employee ID already exists'
                                 else 'Email already exists' end];
        when check_violation then
          v_id := null;
          v_errors := array['The row does not meet the data rules'];
      end;
    end if;

    if v_id is null then v_failed := v_failed + 1; else v_imported := v_imported + 1; end if;
    v_results := v_results || jsonb_build_object(
      'row', n,
      'status', case when v_id is null then 'error' else 'imported' end,
      'errors', to_jsonb(v_errors),
      'employee_id', v_id
    );
  end loop;

  return jsonb_build_object('imported', v_imported, 'failed', v_failed, 'rows', v_results);
end;
$$;

revoke all on function public.import_employees(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.import_employees(jsonb, boolean) to authenticated;

-- Profiles: HR/Admin may rename a login and switch it on or off, nothing else ---------------------
-- Logins are created only by the invite-user function (service role), and their role and employee link
-- never change afterwards. Row-level security still limits these writes to HR/Admin.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, active) on public.profiles to authenticated;

-- An HR/Admin account cannot be switched off through the API, so nobody can lock everyone out.
-- Maintenance run directly in the database (no signed-in user) is not affected.
create function public.guard_admin_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.role = 'admin' and not new.active and old.active and auth.uid() is not null then
    raise exception 'admin_account';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_admin before update of active on public.profiles
  for each row execute function public.guard_admin_profile();

revoke all on function public.guard_admin_profile() from public, anon, authenticated;
