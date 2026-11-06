-- TEST ONLY. The people and cards the browser run starts with. Visits are all created through the app itself.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'hr@e2e.test'),
  ('00000000-0000-4000-8000-000000000002', 'desk@e2e.test'),
  ('00000000-0000-4000-8000-000000000003', 'nusrat@e2e.test'),
  ('00000000-0000-4000-8000-000000000004', 'imran@e2e.test');

insert into public.employees (id, employee_code, full_name, official_email, phone, team, designation, can_register_visitors) values
  ('00000000-0000-4000-9000-000000000001', '0101', 'Nusrat Jahan', 'nusrat@e2e.test', '01710000101', 'Finance', 'Accountant', true),
  ('00000000-0000-4000-9000-000000000002', '0102', 'Imran Hossain', 'imran@e2e.test', '01710000102', 'Engineering', 'Engineer', false),
  ('00000000-0000-4000-9000-000000000003', '0103', 'Tanvir Rahman', 'tanvir@e2e.test', '01710000103', 'Sales', 'Manager', true);

insert into public.profiles (id, role, full_name, email, employee_id, activated_at) values
  ('00000000-0000-4000-8000-000000000001', 'admin', 'Paula Admin', 'hr@e2e.test', null, now()),
  ('00000000-0000-4000-8000-000000000002', 'receptionist', 'Anika Desk', 'desk@e2e.test', null, now()),
  ('00000000-0000-4000-8000-000000000003', 'employee', 'Nusrat Jahan', 'nusrat@e2e.test', '00000000-0000-4000-9000-000000000001', now()),
  ('00000000-0000-4000-8000-000000000004', 'employee', 'Imran Hossain', 'imran@e2e.test', '00000000-0000-4000-9000-000000000002', now());

insert into public.visitor_cards (card_number) values ('001'), ('002'), ('003'), ('004'), ('005'), ('006'), ('007'), ('008'), ('009'), ('010');
