-- Employee management: Employee ID and designation, the can_register_visitors permission, bulk import,
-- and the database side of account invitations. Design and decisions: docs/EMPLOYEE_MANAGEMENT_DESIGN.md.
--
-- Adds and tightens only. The hosted employees table is empty when this is applied, so the new
-- not-null columns need no backfill. It does not run on a table that already holds employees.

-- Employees ------------------------------------------------------------------------------------

alter table public.employees
  add column employee_code          text not null,
  add column designation            text,
  -- A1: ON by default. HR/Admin can turn it off per employee at any time.
  add column can_register_visitors  boolean not null default true,
  alter column official_email set not null;

alter table public.employees
  add constraint employees_employee_code_valid
    check (employee_code <> '' and char_length(employee_code) <= 50),
  add constraint employees_designation_valid
    check (designation is null or btrim(designation) <> ''),
  add constraint employees_email_valid
    check (char_length(official_email) <= 254
           and official_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- Employee IDs are unique ignoring case. (Email already has a unique index from the core schema.)
create unique index employees_employee_code_key on public.employees (lower(employee_code));
create index employees_team_idx on public.employees (lower(team));

-- Keeps stored values tidy whatever wrote them: trimmed, email in lower case, blanks become null.
create function public.normalize_employee() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.employee_code  := btrim(new.employee_code);
  new.full_name      := btrim(new.full_name);
  new.official_email := lower(btrim(new.official_email));
  new.team           := nullif(btrim(new.team), '');
  new.designation    := nullif(btrim(new.designation), '');
  new.phone          := nullif(btrim(new.phone), '');
  return new;
end;
$$;

create trigger employees_normalize before insert or update on public.employees
  for each row execute function public.normalize_employee();

-- A5: once an employee has a login, the email cannot be edited, because the login's email would stop matching.
create function public.guard_employee_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(btrim(new.official_email)) is distinct from old.official_email
     and exists (select 1 from public.profiles where employee_id = old.id) then
    raise exception 'email_locked_after_login';
  end if;
  return new;
end;
$$;

create trigger employees_guard_email before update of official_email on public.employees
  for each row execute function public.guard_employee_email();

-- Deactivating an employee deactivates their login in the same transaction, and reactivating restores it,
-- whatever path made the change. A deactivated login has no role, so every policy then denies it.
create function public.sync_login_active() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set active = new.active where employee_id = new.id and active is distinct from new.active;
  return null;
end;
$$;

create trigger employees_sync_login after update of active on public.employees
  for each row when (old.active is distinct from new.active)
  execute function public.sync_login_active();

-- Profiles -------------------------------------------------------------------------------------

alter table public.profiles
  add column email        text check (email is null or email = lower(btrim(email))),
  add column invited_at   timestamptz,
  add column activated_at timestamptz;

create unique index profiles_email_key on public.profiles (lower(email)) where email is not null;

-- The visitor-registration permission (EM-8 and EM-9) -------------------------------------------
-- Same function as before with one addition: an employee must be active and have the permission.
-- The role check, the other validations and the rest of the body are unchanged.
create or replace function public.register_visit(
  p_full_name              text,
  p_phone                  text,
  p_purpose                text,
  p_category               public.visitor_category,
  p_guest_count            integer default 1,
  p_company_organization   text default null,
  p_invited_by_employee_id uuid default null,
  p_invited_by_name        text default null,
  p_scheduled_arrival_at   timestamptz default null,
  p_scheduled_departure_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_role    public.app_role := public.auth_role();
  v_source  public.registration_source;
  v_name    text := btrim(coalesce(p_full_name, ''));
  v_phone   text := regexp_replace(btrim(coalesce(p_phone, '')), '[\s-]', '', 'g');
  v_purpose text := btrim(coalesce(p_purpose, ''));
  v_visitor uuid;
  v_visit   uuid;
begin
  if v_role is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- An employee may register visitors only while their record is active and the permission is on.
  if v_role = 'employee' and not exists (
       select 1 from public.employees e
        where e.id = public.auth_employee_id() and e.active and e.can_register_visitors) then
    raise exception 'visitor_registration_not_permitted' using errcode = '42501';
  end if;

  v_source := case v_role
    when 'admin' then 'admin'::public.registration_source
    when 'receptionist' then 'receptionist'::public.registration_source
    else 'employee'::public.registration_source
  end;

  -- Mandatory fields (PRD 4.1).
  if v_name = '' then raise exception 'validation_error: visitor name is required'; end if;
  if v_phone = '' then raise exception 'validation_error: phone number is required'; end if;
  if v_purpose = '' then raise exception 'validation_error: purpose of visit is required'; end if;
  if p_category is null then raise exception 'validation_error: visitor category is required'; end if;

  if p_invited_by_employee_id is not null
     and not exists (select 1 from public.employees where id = p_invited_by_employee_id and active) then
    raise exception 'validation_error: the invited-by employee was not found';
  end if;

  insert into public.visitors (full_name, phone)
  values (v_name, v_phone)
  on conflict (lower(btrim(full_name)), phone) do update set updated_at = now()
  returning id into v_visitor;

  insert into public.visits (
    visitor_id, category, purpose, guest_count, company_organization,
    invited_by_employee_id, invited_by_name, scheduled_arrival_at, scheduled_departure_at,
    source, registered_by
  ) values (
    v_visitor, p_category, v_purpose, coalesce(p_guest_count, 1), nullif(btrim(p_company_organization), ''),
    p_invited_by_employee_id, nullif(btrim(p_invited_by_name), ''), p_scheduled_arrival_at, p_scheduled_departure_at,
    v_source, auth.uid()
  ) returning id into v_visit;

  return v_visit;
end;
$$;

-- Bulk import (EM-6) ----------------------------------------------------------------------------
-- The browser reads the file and shows a preview; this function checks every row again before saving, so a
-- hand-built request cannot skip a rule. Valid rows are saved in one transaction. Each row gets a result:
-- imported, or error with every reason. Nothing is skipped silently.
--
-- p_rows: [{ "employee_code": "...", "full_name": "...", "email": "...", "phone": "...", "team": "...", "designation": "..." }, ...]
-- A row's duplicate check looks at earlier rows in the same call whether or not they were imported, so the
-- message can always name the other row.
create function public.import_employees(p_rows jsonb) returns jsonb
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
        insert into public.employees (employee_code, full_name, official_email, phone, team, designation)
        values (v_code, v_name, v_email, v_phone, v_team, v_designation)
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

-- Invitations (EM-7, EM-10) ---------------------------------------------------------------------
-- Called only by the invite-user Edge Function, with the service role. That role gets no table access: it can
-- run these two functions and nothing else on our data.

-- Creates the profile for a login that Supabase Auth has just invited.
create function public.admin_create_profile(
  p_user_id     uuid,
  p_role        public.app_role,
  p_full_name   text,
  p_email       text,
  p_employee_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_employee public.employees%rowtype;
begin
  if p_role not in ('receptionist', 'employee') then
    raise exception 'role_not_invitable';
  end if;
  if v_email = '' then
    raise exception 'validation_error: email is required';
  end if;

  if p_role = 'employee' then
    if p_employee_id is null then
      raise exception 'validation_error: an employee login needs an employee record';
    end if;
    select * into v_employee from public.employees where id = p_employee_id;
    if not found then raise exception 'employee_not_found'; end if;
    if not v_employee.active then raise exception 'employee_inactive'; end if;
    if lower(v_employee.official_email) <> v_email then raise exception 'email_does_not_match_employee'; end if;
    if exists (select 1 from public.profiles where employee_id = p_employee_id) then
      raise exception 'employee_already_has_login';
    end if;
  elsif p_employee_id is not null then
    raise exception 'validation_error: a receptionist login is not linked to an employee record';
  end if;

  insert into public.profiles (id, role, full_name, email, employee_id, invited_at)
  values (p_user_id, p_role, btrim(p_full_name), v_email, p_employee_id, now());
end;
$$;

-- Records that an invitation was sent again, for a login that has not yet been activated.
create function public.admin_mark_invited(p_user_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.profiles set invited_at = now() where id = p_user_id and activated_at is null;
$$;

-- A signed-in user marks their own account active on first sign-in. It touches only their own profile.
create function public.mark_account_active() returns void
language sql security definer set search_path = public as $$
  update public.profiles set activated_at = now() where id = auth.uid() and active and activated_at is null;
$$;

-- Privileges -------------------------------------------------------------------------------------
-- New functions start with no access for anyone; each grant below is deliberate.
revoke all on function
  public.normalize_employee(),
  public.guard_employee_email(),
  public.sync_login_active(),
  public.import_employees(jsonb),
  public.admin_create_profile(uuid, public.app_role, text, text, uuid),
  public.admin_mark_invited(uuid),
  public.mark_account_active()
from public, anon, authenticated;

grant execute on function public.import_employees(jsonb), public.mark_account_active() to authenticated;

grant execute on function
  public.admin_create_profile(uuid, public.app_role, text, text, uuid),
  public.admin_mark_invited(uuid)
to service_role;
