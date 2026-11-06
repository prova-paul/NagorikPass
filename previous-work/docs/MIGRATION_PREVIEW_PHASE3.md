> **Update 2026-11-04: applied.** All migrations are on the hosted project; `verify_remote.sql` passes 20 of 20. Statements below about "not applied" are historical.

# Migration preview — Phase 3 visitor management (NOT applied)

File: `supabase/migrations/20261104170000_phase3_candidate_import.sql`. Written 2026-11-04.
**Status: not applied to the hosted project.** The read-only `supabase db push --remote --dry-run --skip-vault` lists it, after
`20261104150000_phase2_user_management.sql`, as pending. Apply them in that order, after your approval. It adds one function and one
view. No table, column, policy or existing function is changed, and no data is touched.

## What it adds

1. **`import_candidates(p_rows jsonb, p_default_purpose text default 'Job interview')`** — the interview candidate import (PRD workflow E).
   - HR/Admin only (`auth_role() = 'admin'`, else `forbidden`). Not callable by anon.
   - Checks every row again (the browser preview is a convenience, not the rule): name required, phone required and 7–20 digits after spaces
     and hyphens are removed, guests a whole number 1 or more, scheduled arrival a valid timestamp, no duplicate candidate in the file,
     and no candidate already Expected for the same interview time. Every reason is reported per row; valid rows are saved.
   - Each saved row is a Job Interview visit, `Expected`, `source = 'import'`, with the purpose from the row or the default.
   - At most 1000 rows. A blank default purpose is refused (purpose is mandatory for every visit, PRD 4.1).
2. **`employee_names` view** — id, name and team of every employee, including those no longer active, so a visit keeps its host's name for good (PRD 6.6). `employee_directory` stays the list of who can be chosen today. No caller without an active role gets anything.
3. **`visit_overview` view** (`security_invoker = true`) — one row per visit with the visitor, the host's **name and team only** (read
   from `employee_names`) and the cards. Because it runs as the caller, row-level security still decides which visits each person
   sees: HR/Admin all, a receptionist what the front desk works with, an employee only their own. No private employee column is in it
   (a SQL test asserts that). `anon` has no access.

## Effect on the hosted project

- Until it is applied, the Phase 3 list, history, dashboard, report and card pages show "could not be loaded" (they read `visit_overview`),
  and the candidate import reports that the database needs the latest migration. Nothing is lost and nothing is guessed.
- `verify_remote.sql` now expects **nine** functions callable by signed-in users (the new one is `import_candidates`), so it reports a
  failure on the hosted project until both migrations are applied. That is the intended signal.
- Generated types: `frontend/src/types/database.ts` has the new view and function added by hand. Regenerate after applying.

## Tests (local PostgreSQL with the Supabase stand-in)

351 checks pass in the final run (284 before Phase 3; the rest are in `07_phase3_workflow.test.sql` and `08_settings.test.sql`), including the whole visitor workflow as each role,
the candidate import, and the view's visibility rules.

## To apply (after you approve)

```
npx supabase db push --remote --skip-vault
npx supabase gen types --remote > frontend/src/types/database.ts   # then review the diff
```
Then run `supabase/verify_remote.sql` (read-only) and `npm run check:supabase`.

## Also pending: `20261104190000_app_settings.sql`

Adds one table, `app_settings`, with one row: organization name, HR/Admin contact name and phone. Every active role can read it (the receptionist needs the contact). Only HR/Admin can update those columns; nobody can insert or delete through the API. It changes nothing else. `verify_remote.sql` now expects 8 tables, 20 policies and 9 signed-in functions, so it reports failures until all pending migrations are applied.
