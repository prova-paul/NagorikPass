-- Standard check-in and check-out with cards (PRD section 5), delivery restriction, history.
begin;
select tests.fixture();

select tests.login('emp1');
select tests.remember('v1', public.register_visit('Rafsan Ahmed', '01712345678', 'Meeting', 'business_meeting'));
select tests.logout();
select tests.login('hr');
select tests.remember('v2', public.register_visit('Mitali Das', '01887654321', 'Interview', 'job_interview'));
select tests.remember('v5', public.register_visit('VIP Delegation', '01600000000', 'Courtesy visit', 'vip_visit', 3, 'Embassy', tests.id('emp_row_2')));
select tests.logout();
select tests.login('desk');
select tests.remember('v3', public.register_visit('Karim Courier', '01500000000', 'Parcel', 'delivery_courier'));
select tests.logout();

-- Only the receptionist checks in and out.
select tests.login('hr');
select tests.throws($q$select public.check_in_visit(tests.id('v1'), array[tests.id('c1')])$q$, 'forbidden', 'HR/Admin cannot check a visitor in');
select tests.throws($q$select public.check_out_visit(tests.id('v1'), true)$q$, 'forbidden', 'HR/Admin cannot check a visitor out');
select tests.logout();
select tests.login('emp1');
select tests.throws($q$select public.check_in_visit(tests.id('v1'), array[tests.id('c1')])$q$, 'forbidden', 'an employee cannot check a visitor in');
select tests.logout();
select tests.anon();
select tests.throws($q$select public.check_in_visit(gen_random_uuid(), array[gen_random_uuid()])$q$, 'permission denied', 'a signed-out caller cannot check in');
select tests.logout();

-- Delivery personnel are never checked in and never get a card, at every layer.
select tests.login('desk');
select tests.throws($q$select public.check_in_visit(tests.id('v3'), array[tests.id('c1')])$q$, 'delivery_not_permitted', 'the receptionist cannot check in a delivery visitor');
select tests.logout();
select tests.throws($q$update public.visits set status = 'checked_in', checked_in_at = now() where id = tests.id('v3')$q$, 'visits_delivery_never_checked_in', 'the database refuses a checked-in delivery visit');
select tests.throws($q$insert into public.card_assignments (card_id, visit_id, issued_by) values (tests.id('c1'), tests.id('v3'), tests.id('desk'))$q$, 'delivery_not_permitted', 'the database refuses a card for a delivery visit');
select tests.ok((select status::text from public.visits where id = tests.id('v3')) = 'expected', 'the delivery visit is unchanged');
select tests.ok((select status::text from public.visitor_cards where id = tests.id('c1')) = 'available', 'no card was issued to the delivery visitor');

-- Check-in needs a real, available card.
select tests.login('desk');
select tests.throws($q$select public.check_in_visit(tests.id('v1'), array[]::uuid[])$q$, 'card_required', 'check-in needs a card');
select tests.throws($q$select public.check_in_visit(tests.id('v1'), null)$q$, 'card_required', 'a missing card list is refused');
select tests.throws($q$select public.check_in_visit(tests.id('v1'), array[tests.id('c1'), tests.id('c1')])$q$, 'duplicate_card', 'the same card cannot be listed twice');
select tests.throws($q$select public.check_in_visit(tests.id('v1'), array[gen_random_uuid()])$q$, 'card_not_found', 'an unknown card is refused');
select tests.throws($q$select public.check_in_visit(gen_random_uuid(), array[tests.id('c1')])$q$, 'visit_not_found', 'an unknown visit is refused');
select tests.logout();
select tests.ok((select status::text from public.visits where id = tests.id('v1')) = 'expected', 'a refused check-in changes nothing');

-- A good check-in.
select tests.login('desk');
select tests.ok((public.check_in_visit(tests.id('v1'), array[tests.id('c1')]) ->> 'status') = 'checked_in', 'check-in succeeds with an available card');
select tests.logout();
select tests.ok((select status::text from public.visits where id = tests.id('v1')) = 'checked_in', 'the visit is Checked In');
select tests.ok((select checked_in_at from public.visits where id = tests.id('v1')) is not null, 'the check-in time is recorded');
select tests.ok((select status::text from public.visitor_cards where id = tests.id('c1')) = 'issued', 'the card changed from Available to Issued');
select tests.ok((select count(*) from public.card_assignments where visit_id = tests.id('v1') and returned_at is null) = 1, 'the card is linked to the visit');
select tests.ok((select issued_by from public.card_assignments where visit_id = tests.id('v1')) = tests.id('desk'), 'who issued the card is recorded');
select tests.ok((select count(*) from public.notifications) = 3, 'HR/Admin and the registering employee are notified');
select tests.ok(
  (select array_agg(recipient_id order by recipient_id) from public.notifications)
  = (select array_agg(i order by i) from (values (tests.id('hr')), (tests.id('hr2')), (tests.id('emp1'))) t(i)),
  'the notified people are both HR/Admins and the employee who registered the visitor');

select tests.login('emp1');
select tests.ok(tests.count('select 1 from public.notifications') = 1, 'the employee sees their own check-in notification');
select tests.logout();
select tests.login('emp2');
select tests.ok(tests.count('select 1 from public.notifications') = 0, 'another employee sees none');
select tests.logout();
select tests.login('desk');
select tests.ok(tests.count('select 1 from public.notifications') = 0, 'the receptionist does not receive HR notifications');
select tests.ok(tests.count('select 1 from public.card_assignments where returned_at is null') = 1, 'the receptionist sees which cards are out');
select tests.logout();
select tests.login('hr');
select tests.ok(tests.count('select 1 from public.notifications') = 1, 'HR/Admin sees their own notification');
select tests.ok(tests.count('select 1 from public.card_assignments') = 1, 'HR/Admin sees the card history');
select tests.logout();
select tests.login('emp1');
select tests.ok(tests.count('select 1 from public.card_assignments') = 0, 'an employee cannot see card history');
select tests.logout();

-- Cards and visits cannot be reused or re-checked-in.
select tests.login('desk');
select tests.throws($q$select public.check_in_visit(tests.id('v2'), array[tests.id('c1')])$q$, 'card_unavailable', 'an Issued card cannot go to another visitor');
select tests.throws($q$select public.check_in_visit(tests.id('v1'), array[tests.id('c2')])$q$, 'invalid_visit_state', 'a checked-in visitor cannot be checked in again');
select tests.throws($q$insert into public.card_assignments (card_id, visit_id, issued_by) values (tests.id('c2'), tests.id('v1'), auth.uid())$q$, 'permission denied', 'the receptionist cannot write card history directly');
select tests.logout();
select tests.ok((select status::text from public.visits where id = tests.id('v2')) = 'expected', 'the refused visit stays Expected');
select tests.ok((select status::text from public.visitor_cards where id = tests.id('c2')) = 'available', 'the second card stays Available');

-- Check-out: "No" changes nothing.
select tests.login('desk');
select tests.throws($q$select public.check_out_visit(tests.id('v1'), null)$q$, 'confirmation_required', 'check-out needs an answer to the card question');
select tests.throws($q$select public.check_out_visit(tests.id('v2'), true)$q$, 'invalid_visit_state', 'only a checked-in visitor can be checked out');
select tests.ok((public.check_out_visit(tests.id('v1'), false) ->> 'completed') = 'false', 'answering No leaves the check-out incomplete');
select tests.logout();
select tests.ok((select status::text from public.visits where id = tests.id('v1')) = 'checked_in', 'the visitor stays Checked In');
select tests.ok((select checked_out_at from public.visits where id = tests.id('v1')) is null, 'no check-out time is recorded');
select tests.ok((select status::text from public.visitor_cards where id = tests.id('c1')) = 'issued', 'the card stays Issued');
select tests.ok((select count(*) from public.card_assignments where visit_id = tests.id('v1') and returned_at is null) = 1, 'the card stays linked to the visitor');

-- Check-out: "Yes" completes it.
select tests.login('desk');
select tests.ok((public.check_out_visit(tests.id('v1'), true) ->> 'completed') = 'true', 'answering Yes completes the check-out');
select tests.throws($q$select public.check_out_visit(tests.id('v1'), true)$q$, 'invalid_visit_state', 'a visitor cannot be checked out twice');
select tests.logout();
select tests.ok((select status::text from public.visits where id = tests.id('v1')) = 'checked_out', 'the visit is Checked Out');
select tests.ok((select checked_out_at from public.visits where id = tests.id('v1')) is not null, 'the check-out time is recorded');
select tests.ok((select status::text from public.visitor_cards where id = tests.id('c1')) = 'available', 'the card changed from Issued to Available');
select tests.ok((select returned_at is not null and returned_by = tests.id('desk') from public.card_assignments where visit_id = tests.id('v1')), 'the return time and who received the card are recorded');

-- The card can be reused, and the history keeps both visits.
select tests.login('desk');
select public.check_in_visit(tests.id('v2'), array[tests.id('c1')]);
select tests.logout();
select tests.ok((select count(*) from public.card_assignments where card_id = tests.id('c1')) = 2, 'the history keeps every assignment of a card');
select tests.ok((select count(*) from public.card_assignments where card_id = tests.id('c1') and returned_at is null) = 1, 'only the current assignment is open');

-- A group takes several cards and returns them together.
select tests.login('desk');
select public.check_in_visit(tests.id('v5'), array[tests.id('c2'), tests.id('c3')], 3);
select tests.logout();
select tests.ok((select actual_guest_count from public.visits where id = tests.id('v5')) = 3, 'the counted number of guests is recorded');
select tests.ok((select count(*) from public.visitor_cards where status = 'issued') = 3, 'a group can be issued several cards');
select tests.login('desk');
select public.check_out_visit(tests.id('v5'), true);
select tests.logout();
select tests.ok((select count(*) from public.visitor_cards where status = 'issued') = 1, 'all of a group''s cards are freed together');

-- History is permanent.
select tests.throws($q$delete from public.card_assignments$q$, 'card_history_is_permanent', 'card history cannot be deleted');
select tests.throws($q$update public.card_assignments set returned_at = null where visit_id = tests.id('v1')$q$, 'card_history_is_permanent', 'a recorded return cannot be undone');
select tests.throws($q$update public.card_assignments set visit_id = tests.id('v5') where visit_id = tests.id('v1')$q$, 'card_history_is_permanent', 'history cannot be reassigned to another visit');
select tests.login('hr');
select tests.throws($q$delete from public.visitor_cards where id = tests.id('c1')$q$, 'violates foreign key', 'a card with history cannot be deleted');
select tests.logout();

-- The receptionist's lists: today's check-outs are visible, older ones are not.
select tests.login('desk');
select tests.ok(tests.count($q$select 1 from public.visits where id = tests.id('v1')$q$) = 1, 'a visit checked out today is on the receptionist''s list');
select tests.logout();
update public.visits set checked_in_at = now() - interval '3 days', checked_out_at = now() - interval '2 days' where id = tests.id('v1');
select tests.login('desk');
select tests.ok(tests.count($q$select 1 from public.visits where id = tests.id('v1')$q$) = 0, 'an older completed visit leaves the receptionist''s list');
select tests.logout();
select tests.login('hr');
select tests.ok(tests.count($q$select 1 from public.visits where id = tests.id('v1')$q$) = 1, 'HR/Admin still sees it in the history');
select tests.logout();

-- A card is Issued exactly when it has an open assignment.
select tests.ok(
  (select count(*) from public.visitor_cards c
    where (c.status = 'issued') <> exists (select 1 from public.card_assignments a where a.card_id = c.id and a.returned_at is null)) = 0,
  'every card''s status agrees with its history');

rollback;
