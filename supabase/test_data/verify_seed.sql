-- Read-only. The figures the dashboards should show, computed directly from the tables with the same conditions as the app (lib/visitQueries.ts),
-- plus consistency checks. Compare these with the screens:  npx supabase db query --remote --read-only -f supabase/test_data/verify_seed.sql
with day as (
  select ((now() at time zone 'Asia/Dhaka')::date)::timestamp at time zone 'Asia/Dhaka' as s,
         ((now() at time zone 'Asia/Dhaka')::date + 1)::timestamp at time zone 'Asia/Dhaka' as e
)
select jsonb_build_object(
  'admin', jsonb_build_object(
    'total_visitors', (select count(*) from public.visitors),
    'expected_today', (select count(*) from public.visits v, day where v.status = 'expected' and ((v.scheduled_arrival_at >= day.s and v.scheduled_arrival_at < day.e) or (v.scheduled_arrival_at is null and v.created_at >= day.s and v.created_at < day.e))),
    'checked_in', (select count(*) from public.visits where status = 'checked_in'),
    'completed', (select count(*) from public.visits where status = 'checked_out')),
  'reception', jsonb_build_object(
    'total_visitors_today', (select count(*) from public.visits v, day where v.checked_in_at >= day.s and v.checked_in_at < day.e),
    'currently_checked_in', (select count(*) from public.visits where status = 'checked_in'),
    'checked_out_today', (select count(*) from public.visits v, day where v.status = 'checked_out' and v.checked_out_at >= day.s and v.checked_out_at < day.e)),
  'cards', jsonb_build_object(
    'total', (select count(*) from public.visitor_cards),
    'available', (select count(*) from public.visitor_cards where status = 'available'),
    'issued', (select count(*) from public.visitor_cards where status = 'issued')),
  'consistency', jsonb_build_object(
    'issued_cards', (select count(*) from public.visitor_cards where status = 'issued'),
    'open_assignments', (select count(*) from public.card_assignments where returned_at is null),
    'checked_in_without_card', (select count(*) from public.visits v where v.status = 'checked_in' and not exists (select 1 from public.card_assignments a where a.visit_id = v.id and a.returned_at is null)),
    'checked_out_with_card', (select count(*) from public.visits v where v.status = 'checked_out' and exists (select 1 from public.card_assignments a where a.visit_id = v.id and a.returned_at is null)),
    'delivery_checked_in', (select count(*) from public.visits where category = 'delivery_courier' and status <> 'expected'),
    'delivery_with_card', (select count(*) from public.card_assignments a join public.visits v on v.id = a.visit_id where v.category = 'delivery_courier'))
) as result;
