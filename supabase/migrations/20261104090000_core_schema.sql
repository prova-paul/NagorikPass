-- NagorikPass core schema. Source of requirements: docs/NagorikPass_PRD.pdf.
-- Written for Supabase PostgreSQL: it relies on auth.users and auth.uid().
-- Row-level security and grants are in 20261104090200_rls_and_grants.sql.

-- The PRD's fixed lists (section 3, 4, 6.4).
create type public.app_role as enum ('admin', 'receptionist', 'employee');

create type public.visitor_category as enum (
  'business_meeting',
  'job_interview',
  'vip_visit',
  'vendor_supplier',
  'maintenance_technician',
  'personal_guest',
  'delivery_courier',
  'other'
);

-- PRD section 5 names these three states. Pending Approval and Rejected (dashboard, section 6.1)
-- are not added: the PRD defines no flow that produces them (open question Q1).
create type public.visit_status as enum ('expected', 'checked_in', 'checked_out');

create type public.card_status as enum ('available', 'issued');

-- Who created the visit: workflow A (admin), B (employee), C and D (receptionist), E (import).
create type public.registration_source as enum ('admin', 'employee', 'receptionist', 'import');

create type public.notification_type as enum ('visitor_checked_in');

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Employee directory. official_email and phone are private: receptionists and other employees
-- never read this table, they read the employee_directory view (name and team only).
-- The PRD does not list employee fields (open question Q7); these are the minimum needed.
create table public.employees (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null check (btrim(full_name) <> ''),
  team           text check (team is null or btrim(team) <> ''),
  official_email text check (official_email is null or btrim(official_email) <> ''),
  phone          text check (phone is null or btrim(phone) <> ''),
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index employees_official_email_key on public.employees (lower(official_email))
  where official_email is not null;
create index employees_full_name_idx on public.employees (lower(full_name));

create trigger employees_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

-- One row per login. The role lives here, never in anything the user can edit.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.app_role not null,
  full_name   text not null check (btrim(full_name) <> ''),
  employee_id uuid unique references public.employees (id),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- An employee login always belongs to an employee record, so their own visitors can be found.
  constraint profiles_employee_has_record check (role <> 'employee' or employee_id is not null)
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- The person. Matched on name and phone, so a returning visitor keeps one Visitor ID.
create sequence public.visitor_code_seq start 1001;

create table public.visitors (
  id           uuid primary key default gen_random_uuid(),
  visitor_code text not null unique default ('V-' || nextval('public.visitor_code_seq')),
  full_name    text not null check (btrim(full_name) <> ''),
  phone        text not null check (btrim(phone) <> ''),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index visitors_identity_key on public.visitors (lower(btrim(full_name)), phone);

create trigger visitors_updated_at before update on public.visitors
  for each row execute function public.set_updated_at();

-- One occurrence of a visit. Mandatory: visitor, purpose, category (PRD 4.1).
-- Additional: guests, invited by, company. Scheduled times are optional (open question Q14).
create table public.visits (
  id                     uuid primary key default gen_random_uuid(),
  visitor_id             uuid not null references public.visitors (id),
  category               public.visitor_category not null,
  purpose                text not null check (btrim(purpose) <> ''),
  guest_count            integer not null default 1 check (guest_count >= 1),
  -- What the Receptionist counted on arrival (workflow F step 2).
  actual_guest_count     integer check (actual_guest_count >= 1),
  company_organization   text check (company_organization is null or btrim(company_organization) <> ''),
  -- Invited By is an employee, or a typed name when the employee was not found (workflow C step 3).
  invited_by_employee_id uuid references public.employees (id),
  invited_by_name        text check (invited_by_name is null or btrim(invited_by_name) <> ''),
  scheduled_arrival_at   timestamptz,
  scheduled_departure_at timestamptz,
  status                 public.visit_status not null default 'expected',
  source                 public.registration_source not null,
  registered_by          uuid references public.profiles (id),
  checked_in_at          timestamptz,
  checked_out_at         timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint visits_departure_after_arrival
    check (scheduled_departure_at is null or scheduled_arrival_at is null or scheduled_departure_at > scheduled_arrival_at),
  constraint visits_expected_has_no_actual_times
    check (status <> 'expected' or (checked_in_at is null and checked_out_at is null)),
  constraint visits_checked_in_has_time
    check (status = 'expected' or checked_in_at is not null),
  constraint visits_checked_out_has_time
    check (status <> 'checked_out' or checked_out_at is not null),
  constraint visits_checkout_after_checkin
    check (checked_out_at is null or checked_out_at >= checked_in_at),
  -- PRD section 5: delivery personnel are never checked in. This holds for every writer, not just the UI.
  constraint visits_delivery_never_checked_in
    check (category <> 'delivery_courier' or status = 'expected')
);

create index visits_visitor_id_idx on public.visits (visitor_id);
create index visits_status_idx on public.visits (status);
create index visits_scheduled_arrival_idx on public.visits (scheduled_arrival_at);
create index visits_registered_by_idx on public.visits (registered_by);
create index visits_invited_by_employee_idx on public.visits (invited_by_employee_id);

create trigger visits_updated_at before update on public.visits
  for each row execute function public.set_updated_at();

-- Visitor cards (PRD 6.4). Registered by HR/Admin only; each number is unique.
create table public.visitor_cards (
  id          uuid primary key default gen_random_uuid(),
  card_number text not null check (btrim(card_number) <> '' and card_number = btrim(card_number)),
  -- Changed only by the assignment trigger below, so it cannot disagree with the history.
  status      public.card_status not null default 'available',
  created_by  uuid references public.profiles (id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index visitor_cards_number_key on public.visitor_cards (lower(card_number));

create trigger visitor_cards_updated_at before update on public.visitor_cards
  for each row execute function public.set_updated_at();

-- Card issue and return history (PRD 5 check-out step 5 and 6.4). Rows are never deleted.
-- Assigned or returned is read from returned_at.
create table public.card_assignments (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references public.visitor_cards (id),
  visit_id    uuid not null references public.visits (id),
  issued_at   timestamptz not null default now(),
  returned_at timestamptz,
  issued_by   uuid not null references public.profiles (id),
  returned_by uuid references public.profiles (id),
  constraint card_assignments_return_after_issue check (returned_at is null or returned_at >= issued_at),
  constraint card_assignments_return_has_actor check ((returned_at is null) = (returned_by is null))
);

-- A card can be out with one visitor at a time, whatever code or session tries to assign it.
create unique index card_assignments_one_open_per_card on public.card_assignments (card_id)
  where returned_at is null;
create index card_assignments_visit_idx on public.card_assignments (visit_id);

-- Keeps the card status and the history in step, and protects the history.
create function public.guard_card_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v public.visits%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception 'card_history_is_permanent';
  end if;

  if tg_op = 'INSERT' then
    select * into v from public.visits where id = new.visit_id;
    if v.category = 'delivery_courier' then
      raise exception 'delivery_not_permitted';
    end if;
    if v.status <> 'checked_in' then
      raise exception 'visit_not_checked_in';
    end if;
    return new;
  end if;

  -- Only a return may change a row, and only once.
  if old.returned_at is not null
     or new.card_id <> old.card_id
     or new.visit_id <> old.visit_id
     or new.issued_at <> old.issued_at
     or new.issued_by <> old.issued_by then
    raise exception 'card_history_is_permanent';
  end if;
  return new;
end;
$$;

create trigger card_assignments_guard
  before insert or update or delete on public.card_assignments
  for each row execute function public.guard_card_assignment();

create function public.sync_card_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.visitor_cards set status = 'issued' where id = new.card_id and status = 'available';
    if not found then
      raise exception 'card_unavailable';
    end if;
  else
    update public.visitor_cards set status = 'available' where id = new.card_id;
  end if;
  return null;
end;
$$;

create trigger card_assignments_sync_insert
  after insert on public.card_assignments
  for each row execute function public.sync_card_status();

create trigger card_assignments_sync_return
  after update of returned_at on public.card_assignments
  for each row when (old.returned_at is null and new.returned_at is not null)
  execute function public.sync_card_status();

-- A record that someone must be told. Delivery by WhatsApp, Telegram or email is not built:
-- the PRD makes the channel conditional (open question Q10).
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  type         public.notification_type not null,
  visit_id     uuid not null references public.visits (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

-- Who is calling. These read profiles as the table owner, so the lookup is not itself blocked by
-- row-level security. An inactive profile has no role.
create function public.auth_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active;
$$;

create function public.auth_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select employee_id from public.profiles where id = auth.uid() and active;
$$;

-- "Today" for the Receptionist's lists. The organization's time zone is not stated in the PRD;
-- Asia/Dhaka is the zone the previous implementation used. Change it here once confirmed.
create function public.org_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Dhaka')::date;
$$;

-- What a Receptionist or employee may know about an employee: name and team (PRD section 7).
-- The view runs as its owner, so it can read employees while the callers cannot.
create view public.employee_directory as
  select e.id, e.full_name, e.team
    from public.employees e
   where e.active and public.auth_role() is not null;
