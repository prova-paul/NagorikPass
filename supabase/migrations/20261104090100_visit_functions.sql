-- The operations that must be atomic (PRD section 5). They run as the table owner so they can write
-- the history and card status that callers may not touch directly, and each one checks the caller's
-- role first. Errors use stable names so the application can show a clear message.

-- Registers a visit for workflows A, B, C and D. The role decides the source. No approval step exists:
-- the visit is Expected as soon as it is saved (workflow B step 5, workflow C last line).
create function public.register_visit(
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

-- Standard check-in (PRD section 5): one or more Available cards are assigned, the visit becomes
-- Checked In, the cards become Issued, HR/Admin and the registering employee are notified.
-- Several cards are accepted because workflow F issues "visitor cards" for a group.
create function public.check_in_visit(
  p_visit_id           uuid,
  p_card_ids           uuid[],
  p_actual_guest_count integer default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v        public.visits%rowtype;
  v_found  integer;
  v_free   integer;
begin
  if public.auth_role() is distinct from 'receptionist' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- The visit is locked first, then the cards in id order, so two receptionists cannot deadlock.
  select * into v from public.visits where id = p_visit_id for update;
  if not found then raise exception 'visit_not_found'; end if;
  if v.category = 'delivery_courier' then raise exception 'delivery_not_permitted'; end if;
  if v.status <> 'expected' then raise exception 'invalid_visit_state'; end if;

  if p_card_ids is null or cardinality(p_card_ids) = 0 then raise exception 'card_required'; end if;
  if (select count(distinct c) from unnest(p_card_ids) c) <> cardinality(p_card_ids) then
    raise exception 'duplicate_card';
  end if;

  perform 1 from public.visitor_cards where id = any (p_card_ids) order by id for update;
  select count(*), count(*) filter (where status = 'available')
    into v_found, v_free
    from public.visitor_cards where id = any (p_card_ids);
  if v_found <> cardinality(p_card_ids) then raise exception 'card_not_found'; end if;
  if v_free <> cardinality(p_card_ids) then raise exception 'card_unavailable'; end if;

  update public.visits
     set status = 'checked_in', checked_in_at = now(), actual_guest_count = p_actual_guest_count
   where id = p_visit_id;

  insert into public.card_assignments (card_id, visit_id, issued_by)
  select c, p_visit_id, auth.uid() from unnest(p_card_ids) c;

  insert into public.notifications (type, visit_id, recipient_id)
  select 'visitor_checked_in'::public.notification_type, p_visit_id, p.id
    from public.profiles p where p.role = 'admin' and p.active
  union
  select 'visitor_checked_in'::public.notification_type, p_visit_id, p.id
    from public.profiles p where p.id = v.registered_by and p.active and v.source = 'employee';

  return jsonb_build_object('visit_id', p_visit_id, 'status', 'checked_in', 'card_ids', to_jsonb(p_card_ids));
end;
$$;

-- Standard check-out (PRD section 5). "No" changes nothing: the visitor stays Checked In and the
-- card stays Issued. "Yes" closes the card history, frees the cards and completes the visit.
create function public.check_out_visit(
  p_visit_id      uuid,
  p_card_returned boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v public.visits%rowtype;
begin
  if public.auth_role() is distinct from 'receptionist' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_card_returned is null then raise exception 'confirmation_required'; end if;

  select * into v from public.visits where id = p_visit_id for update;
  if not found then raise exception 'visit_not_found'; end if;
  if v.status <> 'checked_in' then raise exception 'invalid_visit_state'; end if;

  if not p_card_returned then
    return jsonb_build_object('visit_id', p_visit_id, 'completed', false, 'reason', 'card_not_returned');
  end if;

  update public.card_assignments
     set returned_at = now(), returned_by = auth.uid()
   where visit_id = p_visit_id and returned_at is null;

  update public.visits
     set status = 'checked_out', checked_out_at = now()
   where id = p_visit_id;

  return jsonb_build_object('visit_id', p_visit_id, 'completed', true, 'status', 'checked_out');
end;
$$;
