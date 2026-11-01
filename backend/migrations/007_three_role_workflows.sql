-- Three login roles and three approval workflows (Project Guide §3, §7–§11).
--
-- Employees can now sign in. An employee account always belongs to an employee record, so the
-- system knows whose requests and host approvals are theirs.
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'receptionist', 'employee'));
ALTER TABLE users ADD CONSTRAINT users_employee_has_record CHECK (role <> 'employee' OR employee_id IS NOT NULL);

-- Employees submit visitor requests, which HR/Admin approves before the visit is expected.
ALTER TABLE visits DROP CONSTRAINT visits_type_check;
ALTER TABLE visits ADD CONSTRAINT visits_type_check CHECK (type IN ('pre_registered', 'walk_in', 'employee_request'));

-- Who asked for an employee request. The employee record is kept as well as the account, so a
-- request can't be approved by any account linked to the employee who made it.
ALTER TABLE visits
  ADD COLUMN requested_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN requested_by_employee_id uuid REFERENCES employees (id);

CREATE INDEX visits_requested_by_employee_idx ON visits (requested_by_employee_id);

-- One status per waiting stage, instead of a single generic pending_approval.
--   walk_in:          pending_host_approval -> pending_admin_approval -> approved -> checked_in
--   pre_registered:   expected -> awaiting_entry_approval -> approved -> checked_in
--   employee_request: pending_employee_request -> expected -> checked_in
ALTER TABLE visits DROP CONSTRAINT visits_status_check;

UPDATE visits SET status = 'pending_host_approval' WHERE status = 'pending_approval';
-- Hosts approved these under the old rules, which had no HR/Admin step. They now wait for it.
UPDATE visits SET status = 'pending_admin_approval' WHERE status = 'approved' AND type = 'walk_in';

ALTER TABLE visits ADD CONSTRAINT visits_status_check CHECK (status IN (
  'pending_employee_request', 'pending_host_approval', 'pending_admin_approval', 'expected',
  'awaiting_entry_approval', 'approved', 'rejected', 'checked_in', 'checked_out', 'cancelled'));

-- Every approval decision at every stage, with who made it and why. Rows are only ever inserted.
-- The approvals table still holds each host's single-use email link.
CREATE TABLE approval_decisions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id          uuid NOT NULL REFERENCES visits (id) ON DELETE CASCADE,
  stage             text NOT NULL CHECK (stage IN ('host', 'admin', 'entry', 'request')),
  decision          text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  actor_user_id     uuid REFERENCES users (id) ON DELETE SET NULL,
  actor_employee_id uuid REFERENCES employees (id),
  actor_label       text NOT NULL,
  reason            text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX approval_decisions_visit_idx ON approval_decisions (visit_id, created_at);

-- Host answers given before this migration become the start of each visit's history.
INSERT INTO approval_decisions (visit_id, stage, decision, actor_employee_id, actor_label, created_at)
SELECT a.visit_id, 'host', a.status, a.employee_id, e.name, a.responded_at
  FROM approvals a JOIN employees e ON e.id = a.employee_id
 WHERE a.status IN ('approved', 'rejected') AND a.responded_at IS NOT NULL;

-- HR/Admin and requesting employees are now emailed too. Admins are addressed by account.
ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'visitor_invitation', 'approval_request', 'host_arrival', 'admin_review', 'request_decision'));
ALTER TABLE notifications ADD COLUMN user_id uuid REFERENCES users (id) ON DELETE SET NULL;
