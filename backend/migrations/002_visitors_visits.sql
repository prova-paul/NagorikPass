CREATE TABLE visitors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text,
  phone      text NOT NULL,
  company    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A returning visitor is recognised by the same name and phone number.
CREATE UNIQUE INDEX visitors_identity_key ON visitors (lower(name), phone);

CREATE SEQUENCE visit_reference_seq START 1001;

CREATE TABLE visits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference     text NOT NULL UNIQUE DEFAULT 'VIS-' || nextval('visit_reference_seq'),
  visitor_id    uuid NOT NULL REFERENCES visitors (id),
  type          text NOT NULL CHECK (type IN ('pre_registered', 'walk_in')),
  status        text NOT NULL CHECK (status IN (
                  'expected', 'pending_approval', 'approved', 'rejected',
                  'checked_in', 'checked_out', 'cancelled')),
  purpose       text NOT NULL,
  visit_date    date NOT NULL,
  expected_time time NOT NULL,
  check_in_at   timestamptz,
  check_out_at  timestamptz,
  created_by    uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visits_checked_in_has_time CHECK (status NOT IN ('checked_in', 'checked_out') OR check_in_at IS NOT NULL),
  CONSTRAINT visits_checked_out_has_time CHECK (status <> 'checked_out' OR check_out_at IS NOT NULL),
  CONSTRAINT visits_check_out_after_check_in CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)
);

CREATE INDEX visits_visit_date_idx ON visits (visit_date);
CREATE INDEX visits_status_idx ON visits (status);
CREATE INDEX visits_visitor_id_idx ON visits (visitor_id);

CREATE TABLE visit_hosts (
  visit_id    uuid NOT NULL REFERENCES visits (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees (id),
  position    smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (visit_id, employee_id)
);

CREATE INDEX visit_hosts_employee_id_idx ON visit_hosts (employee_id);
