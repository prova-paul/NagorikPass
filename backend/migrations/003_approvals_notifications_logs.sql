-- One row per host on a walk-in visit. The foreign key ties every approval to a real host of
-- that visit. Only a hash of the link token is stored.
CREATE TABLE approvals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id     uuid NOT NULL,
  employee_id  uuid NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  token_hash   text NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  responded_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visit_id, employee_id),
  FOREIGN KEY (visit_id, employee_id) REFERENCES visit_hosts (visit_id, employee_id) ON DELETE CASCADE
);

-- Delivery record. Message bodies are not stored because approval emails contain live links.
CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL CHECK (type IN ('visitor_invitation', 'approval_request', 'host_arrival')),
  visit_id    uuid NOT NULL REFERENCES visits (id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees (id),
  recipient   text NOT NULL,
  subject     text NOT NULL,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz
);

CREATE INDEX notifications_visit_id_idx ON notifications (visit_id);
CREATE INDEX notifications_status_idx ON notifications (status);

-- Audit trail. Rows are only ever inserted.
CREATE TABLE visitor_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id      uuid NOT NULL REFERENCES visits (id) ON DELETE CASCADE,
  action        text NOT NULL,
  actor_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  actor_label   text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX visitor_logs_visit_id_idx ON visitor_logs (visit_id, created_at);
