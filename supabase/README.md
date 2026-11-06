# NagorikPass — Supabase database

The schema, row-level security and atomic check-in and check-out functions, as Supabase migrations.
Requirements come from `docs/NagorikPass_PRD.pdf`. Open questions and the assumptions made while they are
open are listed in `docs/IMPLEMENTATION_TRACKER.md`.

## Migrations

Applied in filename order. Never edit one that has been applied to a real project; add a new file.

| File | Holds |
|---|---|
| `20261104090000_core_schema.sql` | Tables, enums, constraints, the card-history triggers, `employee_directory` view |
| `20261104090100_visit_functions.sql` | `register_visit`, `check_in_visit`, `check_out_visit` |
| `20261104090200_rls_and_grants.sql` | Revokes Supabase's default privileges, then grants columns and writes policies per role |
| `20261104130000_employee_management.sql` | Employee ID, designation, the `can_register_visitors` permission, bulk import, invitation support (see `docs/EMPLOYEE_MANAGEMENT_DESIGN.md`). **Not applied to the hosted project until approved** |

Apply them to a Supabase project with the Supabase CLI (`supabase db push`) or by running the files in order in
the SQL editor. They rely on `auth.users` and `auth.uid()`, which Supabase provides.

## How access works

- **Roles** are `admin`, `receptionist` and `employee`, stored in `profiles.role`. Users cannot edit it.
- **Employee privacy:** only HR/Admin (and an employee, for their own row) can read `employees`. Everyone
  else reads `employee_directory`, which has only `id`, `full_name` and `team`.
- **Visits** are created only by `register_visit` and changed only by `check_in_visit` and
  `check_out_visit`. Nobody can write `status`, `checked_in_at` or `checked_out_at` directly, not even HR/Admin.
- **Cards:** only HR/Admin can add or remove them, and nobody can write a card's `status`. A trigger sets it
  from the assignment history, so a card is `issued` exactly when it has an open assignment. One open
  assignment per card is also a unique index.
- **Delivery/Courier:** a table constraint, a trigger and both functions each refuse to check one in or give
  them a card.
- Errors have stable names (`delivery_not_permitted`, `card_unavailable`, `invalid_visit_state`, ...).

## Tests

```sh
supabase/tests/run.sh
```

Needs only `psql` and a local PostgreSQL server you can create databases on. It creates a scratch database
named `nagorikpass_rls_test` (dropped and recreated each run; it refuses any name that does not end in
`_rls_test`), applies the migrations, runs the SQL tests as each role, then runs a two-session race for one
card, and drops the database when everything passes.

`tests/shim.sql` stands in for Supabase's `auth` schema, `auth.uid()` and the `anon`, `authenticated` and
`service_role` roles, because plain PostgreSQL does not have them. It is test-only and must never be applied to
a Supabase project. The roles are created at the server level if missing and are left in place.

**What this does and does not prove.** It proves the schema, constraints, row-level security policies and
functions on real PostgreSQL, acting as each role. It does **not** exercise Supabase Auth, PostgREST, Edge
Functions or a hosted project: that needs the Supabase CLI with Docker, or a hosted test project.

## Edge Functions

`supabase/functions/invite-user` and `set-login-status`. The decisions live in `_shared/*.ts` and are unit-tested
(`npm run test:functions`, `npm run typecheck:functions`). The `index.ts` files only connect them to Supabase.
They cannot be run locally (that needs Docker), so they are tested on the hosted project after a deploy that you
approve. They read as the signed-in HR/Admin, so row-level security applies, and use the service role only for the
two things that need it. The service-role key is supplied by Supabase at run time and is never in the repository.

## All the checks

```sh
npm run test:db              # schema, policies, functions, as each role, plus races (needs psql and local PostgreSQL)
npm run test:functions       # Edge Function logic
npm run typecheck:functions  # Edge Function code against the real supabase-js types
npm run test:import-parity   # the browser's import preview and the database's import give identical answers
```

## Temporary test data

See `docs/TEST_DATA_GUIDE.md`. `npm run test:seed` tests the seed and cleanup on a local scratch database. Only `--execute --confirm=...` writes to the hosted project.
