> **Update 2026-11-04: applied.** All migrations are on the hosted project; `verify_remote.sql` passes 20 of 20. Statements below about "not applied" are historical.

# Migration preview — Phase 2 user management (NOT applied)

File: `supabase/migrations/20261104150000_phase2_user_management.sql`. Written 2026-11-04.
**Status: not applied to the hosted project.** It needs your approval first. The read-only check
`supabase db push --remote --dry-run --skip-vault` lists it as the only pending migration. It does not change, add or
remove any data: it adds one function parameter, one trigger, and removes some write privileges.

## What it does

1. **Bulk import gets a batch default for the visitor-registration permission.** `import_employees(p_rows jsonb)` is
   dropped and recreated as `import_employees(p_rows jsonb, p_can_register_visitors boolean default true)`. The body is the
   same, with the new value stored on each imported employee. A call with one argument still works and keeps the
   default of ON (A1). A null choice is refused. Only an active HR/Admin can run it (unchanged).
2. **HR/Admin can write only two columns of `profiles`.** Insert, update and delete privileges on `profiles` are revoked from
   `authenticated`, then `update (full_name, active)` is granted back. Row-level security still limits it to HR/Admin.
   Effect: nobody can change a login's role or employee link, create a profile, or delete one through the API. Logins
   are created only by the `invite-user` function (service role).
3. **An HR/Admin account cannot be switched off through the API.** A `before update of active` trigger raises
   `admin_account` for an admin profile going from active to inactive when a signed-in user makes the change. Direct
   database maintenance (no signed-in user) is not affected. This means nobody can lock everyone out.

## Effect on the hosted project

- Existing rows: unchanged. The hosted `employees` table is empty and `profiles` holds one row (your Admin account).
- Your Admin login keeps working: sign-in only reads `profiles`.
- The `import_employees(jsonb)` signature disappears. Nothing deployed calls it (the app is not deployed and the Edge
  Functions do not use it).
- Generated types: `frontend/src/types/database.ts` was edited by hand to add the new optional argument. Regenerate with
  `supabase gen types --remote` after applying.

- Until it is applied, the import page's final step reports that the database needs the latest migration. Nothing is saved
  and nothing is silently ignored.

## Tests (local PostgreSQL with the Supabase stand-in)

284 checks pass (249 before, 35 new in `supabase/tests/06_user_management.test.sql`). Two older assertions in
`01_access.test.sql` changed: an employee attempting to change their own role, or to insert a profile, is now stopped by
a privilege error ("permission denied") instead of by row-level security. The outcome is the same: it is refused.

## To apply (after you approve)

```
npx supabase db push --remote --skip-vault
npx supabase gen types --remote > frontend/src/types/database.ts   # then review the diff
```
Then run `supabase/verify_remote.sql` (read-only) and `npm run check:supabase`.
