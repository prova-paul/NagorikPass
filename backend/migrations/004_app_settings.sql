-- Single row of organization-wide settings. The primary key check allows only one.
CREATE TABLE app_settings (
  id                         boolean PRIMARY KEY DEFAULT true CHECK (id),
  organization_name          text NOT NULL DEFAULT 'NagorikPass',
  reception_location         text NOT NULL DEFAULT 'Main Reception',
  email_sender_name          text NOT NULL DEFAULT 'NagorikPass Reception',
  approval_rule              text NOT NULL DEFAULT 'any' CHECK (approval_rule IN ('any', 'all')),
  approval_link_expiry_hours integer NOT NULL DEFAULT 4 CHECK (approval_link_expiry_hours BETWEEN 1 AND 72),
  invitation_emails          boolean NOT NULL DEFAULT true,
  arrival_emails             boolean NOT NULL DEFAULT true,
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_settings DEFAULT VALUES;
