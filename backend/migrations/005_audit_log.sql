-- Security-relevant actions that aren't tied to one visit. Visit activity stays in visitor_logs.
-- Rows are only ever inserted. Tokens and passwords are never written here.
CREATE TABLE audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action        text NOT NULL,
  actor_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  actor_label   text NOT NULL,
  target        text,
  ip_address    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_created_at_idx ON audit_log (created_at DESC);
CREATE INDEX audit_log_action_idx ON audit_log (action);
