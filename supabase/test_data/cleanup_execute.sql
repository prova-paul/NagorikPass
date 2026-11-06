-- Removes only rows tracked for NAGORIKPASS-TEST-SEED-001. One statement: it all happens or none of it does. Run through supabase/cleanup_test_data.ts.
-- It never touches auth.users. The test logins are removed separately, on request, by that script.
do $cleanup$
declare
  c_adopt constant boolean := /*ADOPT*/false/*END*/;
  v_run   text;
  v_added integer;
  v_block integer;
  v_gone  integer;
  s       test_seed.settings_backup%rowtype;
begin
  select seed_run into v_run from test_seed.runs;

  if c_adopt then
    -- Only on an explicit request, after the preview listed these IDs: test activity that depends on seed rows, and rows in the reserved test ranges.
    insert into test_seed.records (seed_run, table_name, record_id, adopted)
      select v_run, table_name, record_id, true from test_seed.test_range on conflict do nothing;
    loop
      insert into test_seed.records (seed_run, table_name, record_id, adopted)
        select v_run, table_name, record_id, true from test_seed.blockers on conflict do nothing;
      get diagnostics v_added = row_count;
      exit when v_added = 0;
    end loop;
    -- A visitor created during testing whose visits are all going too would otherwise be left behind.
    insert into test_seed.records (seed_run, table_name, record_id, adopted)
      select distinct v_run, 'visitors', v.visitor_id, true from public.visits v
        join test_seed.records t on t.table_name = 'visits' and t.record_id = v.id and t.adopted
       where not exists (select 1 from test_seed.preexisting p where p.table_name = 'visitors' and p.record_id = v.visitor_id)
         and not exists (select 1 from public.visits o where o.visitor_id = v.visitor_id
                          and not exists (select 1 from test_seed.records t2 where t2.table_name = 'visits' and t2.record_id = o.id))
      on conflict do nothing;
  end if;

  select count(*) into v_block from test_seed.blockers;
  if v_block > 0 then
    raise exception 'cleanup_refused: % rows that the seed did not create depend on seed rows. Nothing was removed. See the preview', v_block;
  end if;
  -- A pre-existing row must never be in the delete list, whatever happened to the tracker.
  if exists (select 1 from test_seed.records t join test_seed.preexisting p using (table_name, record_id)) then
    raise exception 'cleanup_refused: a row that existed before the seed is on the delete list. Nothing was removed';
  end if;
  -- The login cleanup must never touch.
  if exists (select 1 from test_seed.records t join public.profiles p on p.id = t.record_id where t.table_name = 'profiles' and p.role = 'admin') then
    raise exception 'cleanup_refused: an HR/Admin profile is on the delete list. Nothing was removed';
  end if;

  delete from public.notifications n using test_seed.records t where t.table_name = 'notifications' and t.record_id = n.id;

  -- Card history is protected against deletion for good reason. That protection is lifted only for this transaction and only for the
  -- tracked rows below; if anything fails, the transaction rolls back and the trigger was never off.
  alter table public.card_assignments disable trigger card_assignments_guard;
  delete from public.card_assignments a using test_seed.records t where t.table_name = 'card_assignments' and t.record_id = a.id;
  alter table public.card_assignments enable trigger card_assignments_guard;

  delete from public.visits v using test_seed.records t where t.table_name = 'visits' and t.record_id = v.id;
  delete from public.visitors v using test_seed.records t where t.table_name = 'visitors' and t.record_id = v.id;
  delete from public.visitor_cards c using test_seed.records t where t.table_name = 'visitor_cards' and t.record_id = c.id;
  delete from public.profiles p using test_seed.records t where t.table_name = 'profiles' and t.record_id = p.id;
  delete from public.employees e using test_seed.records t where t.table_name = 'employees' and t.record_id = e.id;

  -- Settings: back to what they were, unless someone has changed them since.
  select * into s from test_seed.settings_backup;
  update public.app_settings set
    organization_name = case when organization_name is not distinct from s.set_organization_name then s.organization_name else organization_name end,
    hr_contact_name   = case when hr_contact_name   is not distinct from s.set_hr_contact_name   then s.hr_contact_name   else hr_contact_name end,
    hr_contact_phone  = case when hr_contact_phone  is not distinct from s.set_hr_contact_phone  then s.hr_contact_phone  else hr_contact_phone end,
    updated_by        = s.updated_by;

  -- Proof, before anything is committed: everything from before the seed is still here, and nothing tracked is.
  select count(*) into v_gone from test_seed.preexisting p where not (
    (p.table_name = 'profiles' and exists (select 1 from public.profiles x where x.id = p.record_id)) or
    (p.table_name = 'employees' and exists (select 1 from public.employees x where x.id = p.record_id)) or
    (p.table_name = 'visitors' and exists (select 1 from public.visitors x where x.id = p.record_id)) or
    (p.table_name = 'visits' and exists (select 1 from public.visits x where x.id = p.record_id)) or
    (p.table_name = 'visitor_cards' and exists (select 1 from public.visitor_cards x where x.id = p.record_id)) or
    (p.table_name = 'card_assignments' and exists (select 1 from public.card_assignments x where x.id = p.record_id)) or
    (p.table_name = 'notifications' and exists (select 1 from public.notifications x where x.id = p.record_id)));
  if v_gone > 0 then raise exception 'cleanup_failed: % rows from before the seed would be lost. Nothing was removed', v_gone; end if;

  if exists (select 1 from pg_trigger where tgname = 'card_assignments_guard' and tgenabled <> 'O') then
    raise exception 'cleanup_failed: the card history guard is not back on. Nothing was removed';
  end if;

  drop schema test_seed cascade;
end;
$cleanup$;

select jsonb_build_object(
  'tracker_removed', to_regnamespace('test_seed') is null,
  'left_in_database', jsonb_build_object(
    'profiles', (select count(*) from public.profiles), 'employees', (select count(*) from public.employees),
    'visitors', (select count(*) from public.visitors), 'visits', (select count(*) from public.visits),
    'visitor_cards', (select count(*) from public.visitor_cards), 'card_assignments', (select count(*) from public.card_assignments),
    'notifications', (select count(*) from public.notifications))
) as result;
