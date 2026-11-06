# Migration preview — employee management (hosted project NagorikPass)

**Status: APPLIED on 2026-11-04, after your explicit approval ("approved: push the employee management migration").**
The text below is the preview you reviewed, kept as the record of what was approved.

**Result.** Immediately before the push I re-checked that the hosted `employees` table had 0 rows and that the dry
run listed only this migration. `npx supabase db push --remote --skip-vault --yes` then applied it with no errors.
`supabase/verify_remote.sql` gave **20 PASS, 0 FAIL** on the hosted project. The migration history now lists
`20261104090000`, `…090100`, `…090200` and `…130000`. The hosted `public` schema has 17 functions (the platform's
1, our 9 from Phase 1, and these 7), 18 policies (unchanged), 0 employees, and 1 profile (yours, unchanged: admin,
active). **No Edge Function was deployed.** The behaviour tests ran locally only; they create test users and data,
so they were not run against this production project.

| | |
|---|---|
| Migration | `supabase/migrations/20261104130000_employee_management.sql` |
| Dry run | `npx supabase db push --remote --dry-run --skip-vault` lists only this one migration |
| Already applied on the hosted project | `20261104090000`, `…090100`, `…090200` |

## What it does

| Area | Change |
|---|---|
| `employees` | Adds required **Employee ID** (unique ignoring case, at most 50 characters), optional **designation**, and **`can_register_visitors`** (default **ON**, your decision A1). **Email becomes required**, with a format check (A2). A trigger trims values and stores the email in lower case |
| Email lock (A5) | A trigger refuses to change an employee's email once they have a login |
| Deactivation | A trigger makes the employee's login follow `employees.active`, in the same transaction, in both directions |
| `profiles` | Adds `email`, `invited_at`, `activated_at`, all optional |
| `register_visit` | Replaced (`create or replace`) with one addition: an employee must be active and have the permission, otherwise it raises `visitor_registration_not_permitted` (privilege error `42501`) and saves nothing. The rest of the body is unchanged |
| `import_employees(rows)` | New. HR/Admin only. Re-validates every row, saves the valid ones in one transaction, returns a result per row |
| `admin_create_profile(...)` | New. **`service_role` only.** Creates the profile for a newly invited login. Accepts only `receptionist` and `employee` |
| `admin_mark_invited(user)` | New. **`service_role` only.** Records that an invitation was sent again, for an account not yet activated |
| `mark_account_active()` | New. Any signed-in user, for their own profile only, once |

`service_role` still has **no** table access. It gets `EXECUTE` on exactly those two functions.

## Destructive and irreversible operations

I parsed the migration and listed every statement that runs at push time: **20 statements**.

| Statement type | Count |
|---|---|
| `alter table` (add columns, add constraints, one `set not null`) | 3 |
| `create function` / `trigger` | 7 / 3 |
| `create index` | 1 plain, 2 unique |
| `create or replace function` (our own `register_visit`) | 1 |
| `grant execute` / `revoke` | 2 / 1 |
| **`drop`, `delete`, `truncate`, `update`, `insert`** | **0** |

- **No data is changed or deleted.** The hosted `employees` table has 0 rows, so the new required columns cannot fail
  and nothing needs a backfill. `profiles` has 1 row (yours); it only gains empty optional columns.
- **No Supabase platform object is touched.** Everything it changes is ours: `employees`, `profiles`, and our functions.
- **One existing function is replaced:** `register_visit`, ours. Its permissions are kept. The only behaviour change is
  the new permission check, and employees who have the permission register exactly as before.
- **Not safe on a table that already has employees.** The new required column has no default, so the migration would
  fail on a table that holds employees. Nothing would be half-applied, because each migration runs in a transaction.
  That is correct for the hosted project today.
- **Hard to reverse:** migrations only move forward. With no employees yet, undoing it would be a new migration.

## How well it is tested

| Check | Result |
|---|---|
| Database tests, acting as each role, on local PostgreSQL with a stand-in for Supabase | **249 checks pass** (151 before, 98 new), including two real races: two receptionists for one card, and two HR/Admins importing the same Employee ID |
| New rules broken on purpose, to prove the tests can fail | 8 of 8 caught: permission check, deactivation, email lock, who may create profiles, service-role access, duplicates inside a file, the clash handler, employees readable by everyone |
| Read-only structural check, `supabase/verify_remote.sql` | **20 structural checks pass** locally; updated to expect the new eight functions, exactly two for `service_role`, and the new columns. It runs on the hosted project after the push |
| Browser preview against the database's `import_employees` | **Identical** on 600 generated rows: 226 valid on both sides, 497 messages the same. It reports 192 differences if one rule is changed |
| Edge Function logic, 25 unit tests | Pass. 4 safeguards broken on purpose, all caught |
| Edge Function code type-checked against the real supabase-js types | Pass |
| Frontend: typecheck, lint, build, 58 tests (26 existing, 32 new) | Pass |
| A real `.xlsx` read by the real reader | Text Employee IDs keep leading zeros; numeric ones trigger the warning |
| **On the hosted project** | **Not tested.** The first push is the first real run |

## If you approve

Say **"approved: push the employee management migration"**. Then I run, in this order:

```sh
npx supabase db push --remote --skip-vault
npx supabase db query --remote --read-only -f supabase/verify_remote.sql
```

The second must show every row as PASS (20 of 20). I would then tell you the result. Edge Functions are a **separate**
approval; none is deployed by this push.

## What is not built yet

- The screens: Employee Management, Receptionist Management, the import dialogs, the invitation page.
- Sign-in with Supabase Auth, which needs `frontend/.env.local` with the publishable key.
- Deploying the two Edge Functions, setting their `APP_URL` secret, and the dashboard settings (sign-ups off,
  Site URL, invite email template). Each needs your approval or your action.
