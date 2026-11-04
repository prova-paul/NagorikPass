-- One of two simultaneous sessions. The visit name arrives as -v visit=...
begin;
select tests.login('desk');
select tests.try_check_in(:'visit', 'c1');
commit;
