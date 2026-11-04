# Migration preview — hosted project NagorikPass

**Status: APPLIED on 2026-11-04, after your explicit approval ("approved: push the migrations").**
The text below is the preview you reviewed. It is kept unchanged as the record of what was approved.

**Result.** `npx supabase db push --remote --skip-vault --yes` applied the three migrations with no errors. The
read-only check `supabase/verify_remote.sql` then gave **16 PASS, 0 FAIL** on the hosted project. The hosted
database now has 7 tables, 18 policies, 10 functions in `public` (our 9 plus the platform's `rls_auto_enable`),
0 users and 0 profiles, and the migration history lists `20261104090000`, `20261104090100` and `20261104090200`.
Nothing else was pushed or deployed. The behaviour tests (151 checks) ran on local PostgreSQL, not on the hosted
project, because they create test users and data and this is a production project.

| | |
|---|---|
| Project | NagorikPass, ref `lbrhdgxooxwanvxuxdzn`, `https://lbrhdgxooxwanvxuxdzn.supabase.co` |
| Region / engine | `ap-northeast-1` (Tokyo), PostgreSQL 17.11, status `ACTIVE_HEALTHY` |
| CLI | 3.0.0, logged in, folder already linked to this project |
| Dry run | `npx supabase db push --remote --dry-run --skip-vault` |

## Dry-run result

```
Would push these migrations:
 • 20261104090000_core_schema.sql
 • 20261104090100_visit_functions.sql
 • 20261104090200_rls_and_grants.sql
```

The hosted project has no migration history, so all three would be applied, in this order.

## Hosted database today (read-only inspection)

| Check | Result |
|---|---|
| Tables, views, enums in `public` | 0, 0, 0 |
| Users in `auth.users` | 0 |
| `anon`, `authenticated`, `service_role`, `authenticator` roles | present |
| `auth.uid()` | present |
| Functions in `public` | 1, `rls_auto_enable`, a platform function behind the project's automatic-RLS event trigger |
| Default privileges for new tables made by `postgres` | `anon` and `authenticated` get only truncate, references, trigger and maintain |

Because the project is empty, there is nothing the migrations can overwrite.

## What the three migrations would create

| Migration | Creates |
|---|---|
| `…090000_core_schema` | 6 enums, 7 tables, 1 view (`employee_directory`), 1 sequence, 6 functions (helpers and triggers), 8 triggers, 12 indexes (4 unique) |
| `…090100_visit_functions` | 3 functions: `register_visit`, `check_in_visit`, `check_out_visit` |
| `…090200_rls_and_grants` | Row-level security on all 7 tables, 18 policies, and the grants. It revokes privileges only on **our own** tables, sequences and functions, by name. The platform's `rls_auto_enable` is not touched |

Tables: `profiles`, `employees`, `visitors`, `visits`, `visitor_cards`, `card_assignments`, `notifications`.

## Destructive and irreversible operations

Method: I parsed the three SQL files, set aside the function bodies (those run later, when the app calls them) and
listed every statement that executes at push time: **84 statements**.

| Statement type at push time | Count |
|---|---|
| `create table` / `type` / `function` / `view` / `sequence` | 7 / 6 / 9 / 1 / 1 |
| `create trigger` / `policy` / `index` (4 of them unique) | 8 / 18 / 12 |
| `alter table ... enable row level security` (all on our own 7 tables) | 7 |
| `grant` | 12 |
| `revoke` | 3 |
| **`drop`, `delete`, `truncate`, `update`, `insert`** | **0** |

**Data.** None is changed or deleted, because there is none: the hosted project has 0 tables, 0 views, 0 sequences,
0 users and no migration history (read-only checks).

**Platform objects.** The migrations do not alter the definition, data or permissions of any Supabase-owned object.
Four touch points are worth knowing:

1. **A foreign key to `auth.users`.** `profiles.id` references it. PostgreSQL attaches internal constraint triggers
   to `auth.users` for that. No column, row or permission on `auth.users` changes. It is the standard Supabase
   pattern, and dropping our `profiles` table removes it.
2. **`ON DELETE CASCADE` on that key.** Deleting a login deletes its profile. It is **refused** if that login
   registered or checked in visits (tested): deactivate such a login instead of deleting it.
3. **The migration history table.** The CLI records applied migrations in `supabase_migrations.schema_migrations`,
   creating it.
4. **Supabase's own event triggers react to our DDL.** `ensure_rls` turns row-level security on for each new table
   (we also turn it on ourselves), and `pgrst_ddl_watch` makes the Data API reload so our tables and functions get
   endpoints under our grants. That is intended. Signed-out users get none (checked below).

**The three `revoke` statements.** Two say "all tables" and "all sequences in schema public". On this project that
means only our own, because `public` has no other tables or sequences (checked read-only). The third revokes our
nine functions by name. The platform's `rls_auto_enable` is not touched (tested).

**What is hard to reverse.**

- Migrations only move forward. Applying them is recorded in the migration history.
- A PostgreSQL enum can gain values but not easily lose them.
- Once real data exists, card history and used cards are protected on purpose: history cannot be deleted, and a card
  with history cannot be removed.
- Today nothing depends on these objects, so undoing the push is easy: with no data, I can clear our objects and
  re-apply, after asking you.

## What I changed because of the pre-flight

The first version of the RLS migration ran a blanket `revoke ... on all functions in schema public`. On this project
that would have altered the platform function. It now revokes our nine functions by name. I also pinned
`search_path` on the two functions that lacked it (Supabase's Security Advisor flags that). Tests grew from 143 to
151 checks, and a new check fails if the blanket revoke comes back.

## What I did on the hosted project so far

- **Read-only queries** (`db query --remote --read-only`): the database refuses writes inside them. They read the catalog only.
- **Dry run**: lists migrations, applies nothing.
- The CLI printed "Initialising login role". It creates a short-lived login role of its own to connect without your
  database password. That is the CLI's connection mechanism, not a schema or data change.
- Nothing was written to any table, and no migration, function or setting was pushed.

## How well this is tested

| | Result |
|---|---|
| Database behaviour tests, acting as each role, on local PostgreSQL 18 with a stand-in for Supabase | **151 checks pass**, including two simultaneous check-ins for one card |
| Read-only structural check, `supabase/verify_remote.sql` | **16 checks pass** locally |
| The same structural check on the hosted project now | Fails with `relation "public.visits" does not exist`, as it should before the migrations |
| The migrations on the **hosted** project | **Not tested.** The first push is the first real run |
| Supabase Auth, PostgREST, Edge Functions | Not tested yet; they need the project keys |

Expected in the dashboard's Security Advisor after the push: a note that `employee_directory` is a view that runs
with its owner's rights. That is deliberate: it is how receptionists and employees see names and teams without being
able to read the private employee columns.

## If you approve

Say **"approved: push the migrations"**. Then I run:

```sh
npx supabase db push --remote --skip-vault
```

and immediately afterwards the read-only check, which must show 16 PASS and 0 FAIL:

```sh
npx supabase db query --remote --read-only -f supabase/verify_remote.sql
```

Then you create the first HR/Admin login (`docs/SUPABASE_SETUP.md`, Step 7), and I connect the frontend.

**Reversing it.** Migrations only move forward. The project is empty, so if the check shows a problem I would fix it
with a new migration, or, since there is no data, clear the project's `public` objects and re-apply. I would ask you
before doing either.

## Still needed from you

- **Publishable key**: put it in `frontend/.env.local` as `VITE_SUPABASE_PUBLISHABLE_KEY` (the URL line is in
  `frontend/.env.example`). **Checked on 2026-11-04: that file does not exist yet.** It is git-ignored (`*.local`)
  and not tracked. It does not block the push; it blocks connecting the frontend. When it exists I will check only
  its shape (right variables, right project URL, publishable rather than secret key) and never print the key.
- **Your approval** to push.
- Answers to **Q8** (how accounts are created) and the Excel templates (E1 to E8), which do not block the push.
