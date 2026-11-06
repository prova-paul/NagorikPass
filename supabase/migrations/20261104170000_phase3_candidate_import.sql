-- Phase 3: interview candidate import (PRD workflow E, section 6.5).
-- The browser reads the Excel file and shows a preview; this function checks every row again before saving, so a
-- hand-built request cannot skip a rule. Valid rows are saved, rows with problems are reported with every reason.
-- Adds one function. No table, column or existing function is changed.
--
-- p_rows: [{ "full_name", "phone", "purpose", "company", "invited_by", "scheduled_arrival", "guests" }, ...]
--   scheduled_arrival is an ISO timestamp with a time zone (the browser converts the sheet's local time).
-- p_default_purpose: used for rows whose purpose is blank (purpose is mandatory for every visit, PRD 4.1).
-- Every imported visit is a Job Interview visit, Expected, with source 'import'. No approval step.
create function public.import_candidates(p_rows jsonb, p_default_purpose text default 'Job interview') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  elem          jsonb;
  n             integer := 0;
  v_name        text;
  v_phone       text;
  v_purpose     text;
  v_company     text;
  v_invited     text;
  v_arrival     timestamptz;
  v_arrival_txt text;
  v_guests_txt  text;
  v_guests      integer;
  v_default     text := btrim(coalesce(p_default_purpose, ''));
  v_errors      text[];
  v_visitor     uuid;
  v_visit       uuid;
  v_key         text;
  v_seen        jsonb := '{}'::jsonb;
  v_results     jsonb := '[]'::jsonb;
  v_imported    integer := 0;
  v_failed      integer := 0;
begin
  if public.auth_role() is distinct from 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_default = '' then
    raise exception 'validation_error: a default purpose is required';
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
    v_visit := null;
    v_arrival := null;
    v_guests := 1;

    if jsonb_typeof(elem) <> 'object' then
      v_errors := array['The row is not a set of columns'];
    else
      v_name        := btrim(coalesce(elem ->> 'full_name', ''));
      v_phone       := regexp_replace(btrim(coalesce(elem ->> 'phone', '')), '[\s-]', '', 'g');
      v_purpose     := coalesce(nullif(btrim(coalesce(elem ->> 'purpose', '')), ''), v_default);
      v_company     := nullif(btrim(coalesce(elem ->> 'company', '')), '');
      v_invited     := nullif(btrim(coalesce(elem ->> 'invited_by', '')), '');
      v_arrival_txt := nullif(btrim(coalesce(elem ->> 'scheduled_arrival', '')), '');
      v_guests_txt  := nullif(btrim(coalesce(elem ->> 'guests', '')), '');

      if v_name = '' then
        v_errors := array_append(v_errors, 'Candidate name is required');
      elsif char_length(v_name) > 200 then
        v_errors := array_append(v_errors, 'Candidate name must be at most 200 characters');
      end if;

      if v_phone = '' then
        v_errors := array_append(v_errors, 'Phone number is required');
      elsif v_phone !~ '^\+?[0-9]{7,20}$' then
        v_errors := array_append(v_errors, 'Phone number is not valid');
      end if;

      if v_guests_txt is not null then
        if v_guests_txt !~ '^[0-9]{1,4}$' or v_guests_txt::integer < 1 then
          v_errors := array_append(v_errors, 'Number of guests must be a whole number, 1 or more');
        else
          v_guests := v_guests_txt::integer;
        end if;
      end if;

      if v_arrival_txt is not null then
        begin
          v_arrival := v_arrival_txt::timestamptz;
        exception when others then
          v_errors := array_append(v_errors, 'Scheduled arrival is not a valid date and time');
        end;
      end if;

      if cardinality(v_errors) = 0 then
        -- The same candidate at the same time, twice in the file or already waiting from an earlier upload.
        v_key := lower(v_name) || '|' || v_phone || '|' || coalesce(v_arrival::text, '');
        if v_seen ? v_key then
          v_errors := array_append(v_errors, ('Duplicate candidate: same as row ' || (v_seen ->> v_key)));
        else
          v_seen := v_seen || jsonb_build_object(v_key, n);
          if exists (
            select 1 from public.visits vi join public.visitors vr on vr.id = vi.visitor_id
             where lower(btrim(vr.full_name)) = lower(v_name) and vr.phone = v_phone
               and vi.category = 'job_interview' and vi.status = 'expected'
               and vi.scheduled_arrival_at is not distinct from v_arrival
          ) then
            v_errors := array_append(v_errors, 'Already expected: this candidate is already on the Expected Visitors list');
          end if;
        end if;
      end if;
    end if;

    if cardinality(v_errors) = 0 then
      begin
        insert into public.visitors (full_name, phone) values (v_name, v_phone)
        on conflict (lower(btrim(full_name)), phone) do update set updated_at = now()
        returning id into v_visitor;

        insert into public.visits (visitor_id, category, purpose, guest_count, company_organization,
                                   invited_by_name, scheduled_arrival_at, source, registered_by)
        values (v_visitor, 'job_interview', v_purpose, v_guests, v_company, v_invited, v_arrival, 'import', auth.uid())
        returning id into v_visit;
      exception when check_violation or unique_violation then
        v_visit := null;
        v_errors := array['The row does not meet the data rules'];
      end;
    end if;

    if v_visit is null then v_failed := v_failed + 1; else v_imported := v_imported + 1; end if;
    v_results := v_results || jsonb_build_object(
      'row', n,
      'status', case when v_visit is null then 'error' else 'imported' end,
      'errors', to_jsonb(v_errors),
      'visit_id', v_visit
    );
  end loop;

  return jsonb_build_object('imported', v_imported, 'failed', v_failed, 'rows', v_results);
end;
$$;

revoke all on function public.import_candidates(jsonb, text) from public, anon, authenticated;
grant execute on function public.import_candidates(jsonb, text) to authenticated;

-- Visit overview ------------------------------------------------------------------------------------------------
-- One row per visit with the visitor, the host's name and team, and the cards, for the visitor lists, history,
-- search, dashboards and reports. security_invoker makes it run with the caller's own rights, so row-level security
-- decides which visits (and which card rows) each person sees: HR/Admin all, a receptionist what the front desk
-- works with, an employee only their own visitors. The host comes from employee_names (name and team only), so no
-- private employee detail can leak through this view.

-- Name and team of every employee, including those no longer active, because a visit's record keeps its invited-by
-- employee for good (PRD 6.6). employee_directory stays the list of who can be chosen as a host today.
-- Like employee_directory, it runs as its owner and gives nothing to a caller with no active role.
create view public.employee_names as
  select e.id, e.full_name, e.team
    from public.employees e
   where public.auth_role() is not null;

revoke all on public.employee_names from public, anon, authenticated;
grant select on public.employee_names to authenticated;

create view public.visit_overview with (security_invoker = true) as
select
  v.id,
  v.visitor_id,
  vr.visitor_code,
  vr.full_name as visitor_name,
  vr.phone,
  v.category,
  v.purpose,
  v.guest_count,
  v.actual_guest_count,
  v.company_organization,
  v.invited_by_employee_id,
  v.invited_by_name,
  coalesce(d.full_name, v.invited_by_name) as host_name,
  d.team as host_team,
  v.scheduled_arrival_at,
  v.scheduled_departure_at,
  v.status,
  v.source,
  v.registered_by,
  v.checked_in_at,
  v.checked_out_at,
  v.created_at,
  coalesce(v.scheduled_arrival_at, v.checked_in_at, v.created_at) as visit_at,
  ca.card_numbers,
  ca.first_issued_at,
  ca.last_returned_at,
  coalesce(ca.cards_out, 0) as cards_out
from public.visits v
join public.visitors vr on vr.id = v.visitor_id
left join public.employee_names d on d.id = v.invited_by_employee_id
left join lateral (
  select string_agg(c.card_number, ', ' order by a.issued_at, c.card_number) as card_numbers,
         min(a.issued_at) as first_issued_at,
         max(a.returned_at) as last_returned_at,
         count(*) filter (where a.returned_at is null) as cards_out
    from public.card_assignments a
    join public.visitor_cards c on c.id = a.card_id
   where a.visit_id = v.id
) ca on true;

-- Supabase gives new relations to anon and authenticated by default, so reset them first.
revoke all on public.visit_overview from public, anon, authenticated;
grant select on public.visit_overview to authenticated;
