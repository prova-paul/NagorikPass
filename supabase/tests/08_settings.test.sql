-- Settings: one row, read by every active role, changed only by HR/Admin.
begin;
select tests.fixture();

select tests.ok((select count(*) from public.app_settings) = 1, 'there is exactly one settings row');

select tests.login('hr');
update public.app_settings set organization_name = 'Acme Ltd', hr_contact_name = 'HR Desk', hr_contact_phone = '01710000000', updated_by = auth.uid();
select tests.logout();
select tests.ok((select organization_name || hr_contact_name || hr_contact_phone from public.app_settings) = 'Acme LtdHR Desk01710000000', 'HR/Admin can change the settings');

select tests.login('hr');
select tests.throws($q$insert into public.app_settings (id) values (true)$q$, 'permission denied', 'nobody can add a second row through the API');
select tests.throws($q$delete from public.app_settings$q$, 'permission denied', 'nobody can delete the settings through the API');
select tests.throws($q$update public.app_settings set organization_name = '  '$q$, 'check constraint', 'a blank organization name is refused');
select tests.logout();

select tests.login('desk');
select tests.ok((select hr_contact_phone from public.app_settings) = '01710000000', 'the receptionist can read who to call');
with u as (update public.app_settings set hr_contact_phone = '000' returning 1)
select tests.ok((select count(*) from u) = 0, 'the receptionist cannot change the settings');
select tests.logout();

select tests.login('emp1');
with u as (update public.app_settings set organization_name = 'Hacked' returning 1)
select tests.ok((select count(*) from u) = 0, 'an employee cannot change the settings');
select tests.logout();
select tests.ok((select organization_name from public.app_settings) = 'Acme Ltd', 'those attempts changed nothing');

select tests.login('emp2');
update public.profiles set active = active where false;
select tests.logout();
update public.profiles set active = false where id = tests.id('emp2');
select tests.login('emp2');
select tests.ok(tests.count('select 1 from public.app_settings') = 0, 'a deactivated login reads nothing');
select tests.logout();

select tests.anon();
select tests.throws('select 1 from public.app_settings', 'permission denied', 'a signed-out caller cannot read the settings');
select tests.logout();

rollback;
