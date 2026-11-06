-- Read-only. What cleanup would remove, what stops it, and what it would leave. Run through supabase/cleanup_test_data.ts.
select jsonb_build_object(
  'seed_run', (select seed_run from test_seed.runs),
  'seeded_at', (select started_at from test_seed.runs),
  'to_delete', (select jsonb_object_agg(table_name, ids) from (select table_name, jsonb_agg(record_id order by record_id) ids from test_seed.records group by 1) x),
  'to_delete_counts', (select jsonb_object_agg(table_name, n) from (select table_name, count(*) n from test_seed.records group by 1) x),
  'blockers', coalesce((select jsonb_agg(jsonb_build_object('table', table_name, 'id', record_id, 'why', reason)) from test_seed.blockers), '[]'::jsonb),
  'test_range_untracked', coalesce((select jsonb_agg(jsonb_build_object('table', table_name, 'id', record_id, 'label', label)) from test_seed.test_range), '[]'::jsonb),
  'kept', jsonb_build_object(
    'profiles', (select count(*) from test_seed.preexisting where table_name = 'profiles'),
    'employees', (select count(*) from test_seed.preexisting where table_name = 'employees'),
    'visitors', (select count(*) from test_seed.preexisting where table_name = 'visitors'),
    'visits', (select count(*) from test_seed.preexisting where table_name = 'visits'),
    'visitor_cards', (select count(*) from test_seed.preexisting where table_name = 'visitor_cards')),
  'after_seed_untracked', jsonb_build_object(
    'visits', (select count(*) from public.visits v where v.created_at >= (select started_at from test_seed.runs) and not exists (select 1 from test_seed.records t where t.table_name = 'visits' and t.record_id = v.id)),
    'visitors', (select count(*) from public.visitors v where v.created_at >= (select started_at from test_seed.runs) and not exists (select 1 from test_seed.records t where t.table_name = 'visitors' and t.record_id = v.id)),
    'employees', (select count(*) from public.employees e where e.created_at >= (select started_at from test_seed.runs) and not exists (select 1 from test_seed.records t where t.table_name = 'employees' and t.record_id = e.id)),
    'visitor_cards', (select count(*) from public.visitor_cards c where c.created_at >= (select started_at from test_seed.runs) and not exists (select 1 from test_seed.records t where t.table_name = 'visitor_cards' and t.record_id = c.id)))
) as result;
