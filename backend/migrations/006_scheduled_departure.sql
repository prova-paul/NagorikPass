-- The planned visit length gives a scheduled departure. It sits beside the scheduled arrival
-- (visit_date, expected_time) and the actual times (check_in_at, check_out_at), and check-in and
-- check-out never change it. Visits from before this migration have no planned length, so they
-- stay NULL rather than getting an invented departure time.
ALTER TABLE visits
  ADD COLUMN scheduled_minutes integer CHECK (scheduled_minutes BETWEEN 1 AND 1440);

ALTER TABLE app_settings
  ADD COLUMN default_visit_minutes integer NOT NULL DEFAULT 60 CHECK (default_visit_minutes BETWEEN 5 AND 720);
