-- Settings (PRD 6.1: "Manage application configuration"). The PRD does not list the settings (open question Q13), so this holds
-- only what the app actually uses: the organization's name on reports, and who the receptionist calls or messages when automatic
-- notifications are unavailable (PRD 6.3). Adds one table with one row. Nothing existing is changed.
create table public.app_settings (
  -- One row only: the key can only ever be true.
  id                boolean primary key default true check (id),
  organization_name text check (organization_name is null or btrim(organization_name) <> ''),
  hr_contact_name   text check (hr_contact_name is null or btrim(hr_contact_name) <> ''),
  hr_contact_phone  text check (hr_contact_phone is null or btrim(hr_contact_phone) <> ''),
  updated_by        uuid references public.profiles (id) on delete set null,
  updated_at        timestamptz not null default now()
);

create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (id) values (true);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from public, anon, authenticated;

-- Everyone with an active role reads them (the receptionist needs the contact). Only HR/Admin changes them, and only these columns.
grant select on public.app_settings to authenticated;
grant update (organization_name, hr_contact_name, hr_contact_phone, updated_by) on public.app_settings to authenticated;

create policy app_settings_select on public.app_settings for select to authenticated
  using (public.auth_role() is not null);
create policy app_settings_admin_update on public.app_settings for update to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');
