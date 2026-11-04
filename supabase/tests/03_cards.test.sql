-- Visitor card registry (PRD 6.4 and section 7): only HR/Admin, unique numbers, status not writable.
begin;
select tests.fixture();

select tests.login('hr');
select tests.ok(tests.count('select 1 from public.visitor_cards') = 3, 'HR/Admin sees all registered cards');
select tests.ok((select bool_and(status = 'available') from public.visitor_cards), 'a registered card starts Available');
insert into public.visitor_cards (card_number) values ('004');
select tests.ok(tests.count('select 1 from public.visitor_cards') = 4, 'HR/Admin can add a card manually');
select tests.ok((select created_by from public.visitor_cards where card_number = '004') = auth.uid(), 'who registered the card is recorded');
select tests.throws($q$insert into public.visitor_cards (card_number) values ('004')$q$, 'duplicate key', 'a card number must be unique');
insert into public.visitor_cards (card_number) values ('VC-A');
select tests.throws($q$insert into public.visitor_cards (card_number) values ('vc-a')$q$, 'duplicate key', 'uniqueness ignores letter case');
select tests.throws($q$insert into public.visitor_cards (card_number) values (' 005')$q$, 'violates check constraint', 'a card number cannot start or end with a space');
select tests.throws($q$insert into public.visitor_cards (card_number) values ('')$q$, 'violates check constraint', 'a card number cannot be empty');
select tests.throws($q$update public.visitor_cards set status = 'issued' where card_number = '001'$q$, 'permission denied', 'HR/Admin cannot change a card status by hand');
select tests.throws($q$insert into public.visitor_cards (card_number, status) values ('009', 'issued')$q$, 'permission denied', 'a card cannot be registered as Issued');
update public.visitor_cards set card_number = '004-renamed' where card_number = '004';
select tests.ok(tests.count($q$select 1 from public.visitor_cards where card_number = '004-renamed'$q$) = 1, 'HR/Admin can correct a card number');
delete from public.visitor_cards where card_number = '004-renamed';
select tests.ok(tests.count('select 1 from public.visitor_cards') = 4, 'HR/Admin can remove a card that was never issued');
select tests.logout();

-- Everyone else.
select tests.login('desk');
select tests.ok(tests.count($q$select 1 from public.visitor_cards where status = 'available'$q$) = 4, 'the receptionist sees the available cards');
select tests.throws($q$insert into public.visitor_cards (card_number) values ('777')$q$, 'row-level security', 'a receptionist cannot register a card');
with d as (delete from public.visitor_cards returning 1)
select tests.ok((select count(*) from d) = 0, 'a receptionist cannot delete cards');
select tests.throws($q$update public.visitor_cards set status = 'available'$q$, 'permission denied', 'a receptionist cannot change a card status');
select tests.logout();

select tests.login('emp1');
select tests.ok(tests.count('select 1 from public.visitor_cards') = 0, 'an employee cannot see cards');
select tests.throws($q$insert into public.visitor_cards (card_number) values ('888')$q$, 'row-level security', 'an employee cannot register a card');
select tests.logout();

rollback;
