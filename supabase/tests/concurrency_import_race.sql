-- One of two simultaneous HR/Admin sessions importing the same Employee ID.
begin;
select tests.login('hr');
select 'result:' || (public.import_employees('[{"employee_code":"RACE-1","full_name":"Racer","email":"racer@corp.test"}]'::jsonb) -> 'rows' -> 0 ->> 'status');
-- Hold the transaction open so the other session really has to wait on the unique index.
select pg_sleep(1.5);
commit;
