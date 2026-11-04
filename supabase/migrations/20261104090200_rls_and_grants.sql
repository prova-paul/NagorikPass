-- Row-level security and privileges (PRD section 7 and 8: role-based access and database policies).
-- Two layers: grants say which columns a signed-in user may touch at all; policies say which rows.
-- Supabase gives anon and authenticated default privileges on new tables, so ours are revoked first.

-- Tables and sequences: the public schema is empty before this project's migrations, so "all" is only ours.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Functions: revoked by name. A hosted project already has a platform function in public
-- (rls_auto_enable, used by its automatic-RLS event trigger) that must not be touched.
revoke all on function
  public.set_updated_at(),
  public.guard_card_assignment(),
  public.sync_card_status(),
  public.auth_role(),
  public.auth_employee_id(),
  public.org_today(),
  public.register_visit(text, text, text, public.visitor_category, integer, text, uuid, text, timestamptz, timestamptz),
  public.check_in_visit(uuid, uuid[], integer),
  public.check_out_visit(uuid, boolean)
from public, anon, authenticated;

alter table public.profiles          enable row level security;
alter table public.employees         enable row level security;
alter table public.visitors          enable row level security;
alter table public.visits            enable row level security;
alter table public.visitor_cards     enable row level security;
alter table public.card_assignments  enable row level security;
alter table public.notifications     enable row level security;

-- Callable by signed-in users. Each checks the role itself. anon can call none of them.
grant execute on function
  public.auth_role(),
  public.auth_employee_id(),
  public.org_today(),
  public.register_visit(text, text, text, public.visitor_category, integer, text, uuid, text, timestamptz, timestamptz),
  public.check_in_visit(uuid, uuid[], integer),
  public.check_out_visit(uuid, boolean)
to authenticated;

-- profiles: you see your own; HR/Admin manages all (creating logins is done with the service role).
grant select, insert, update, delete on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.auth_role() = 'admin');
create policy profiles_admin_write on public.profiles for all to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');

-- employees: HR/Admin manages. An employee reads their own record. Receptionists and other
-- employees have no access to this table at all; they use employee_directory.
grant select, insert, update, delete on public.employees to authenticated;
create policy employees_admin_all on public.employees for all to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');
create policy employees_select_own on public.employees for select to authenticated
  using (id = public.auth_employee_id());

grant select on public.employee_directory to authenticated;

-- visits: HR/Admin sees all. Receptionist sees what the front desk works with: Expected, Checked In,
-- and visits checked out today. An employee sees visits they registered or are named on.
-- Rows are created only by register_visit and changed only by the check-in and check-out functions.
grant select on public.visits to authenticated;
grant update (category, purpose, guest_count, company_organization, invited_by_employee_id,
              invited_by_name, scheduled_arrival_at, scheduled_departure_at)
  on public.visits to authenticated;

create policy visits_admin_select on public.visits for select to authenticated
  using (public.auth_role() = 'admin');
create policy visits_admin_update on public.visits for update to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');
create policy visits_receptionist_select on public.visits for select to authenticated
  using (
    public.auth_role() = 'receptionist'
    and (
      status in ('expected', 'checked_in')
      or (status = 'checked_out' and (checked_out_at at time zone 'Asia/Dhaka')::date = public.org_today())
    )
  );
create policy visits_employee_select on public.visits for select to authenticated
  using (
    public.auth_role() = 'employee'
    and (registered_by = auth.uid() or invited_by_employee_id = public.auth_employee_id())
  );

-- visitors: you see a visitor when you can see one of their visits. HR/Admin may correct name and phone.
grant select on public.visitors to authenticated;
grant update (full_name, phone) on public.visitors to authenticated;

create policy visitors_admin_select on public.visitors for select to authenticated
  using (public.auth_role() = 'admin');
create policy visitors_admin_update on public.visitors for update to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');
create policy visitors_scoped_select on public.visitors for select to authenticated
  using (
    public.auth_role() in ('receptionist', 'employee')
    and exists (select 1 from public.visits v where v.visitor_id = visitors.id)
  );

-- visitor_cards: only HR/Admin registers or removes cards (PRD section 7). The Receptionist reads them
-- to pick an Available one. Nobody can write the status: it is set by the assignment trigger.
grant select, delete on public.visitor_cards to authenticated;
grant insert (card_number), update (card_number) on public.visitor_cards to authenticated;

create policy cards_select on public.visitor_cards for select to authenticated
  using (public.auth_role() in ('admin', 'receptionist'));
create policy cards_admin_insert on public.visitor_cards for insert to authenticated
  with check (public.auth_role() = 'admin');
create policy cards_admin_update on public.visitor_cards for update to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');
create policy cards_admin_delete on public.visitor_cards for delete to authenticated
  using (public.auth_role() = 'admin');

-- card_assignments: HR/Admin reads the full history. The Receptionist reads only cards still out, to
-- show each checked-in visitor's card. No one writes it directly.
grant select on public.card_assignments to authenticated;

create policy assignments_admin_select on public.card_assignments for select to authenticated
  using (public.auth_role() = 'admin');
create policy assignments_receptionist_select on public.card_assignments for select to authenticated
  using (public.auth_role() = 'receptionist' and returned_at is null);

-- notifications: you read your own.
grant select on public.notifications to authenticated;
create policy notifications_select_own on public.notifications for select to authenticated
  using (recipient_id = auth.uid());
