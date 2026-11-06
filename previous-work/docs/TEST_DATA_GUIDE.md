# NagorikPass — Temporary Test Data Guide

Run ID: **`NAGORIKPASS-TEST-SEED-001`**. This data is for testing the real app on the hosted project. It is removed before real company data goes in. Written 2026-11-04.

**Status: prepared and tested on a local database. Nothing has been written to the hosted project.**

## 1. The Supabase project

NagorikPass, ref `lbrhdgxooxwanvxuxdzn`, `https://lbrhdgxooxwanvxuxdzn.supabase.co`, PostgreSQL 17.

## 2. What the read-only inspection found (2026-11-04)

| Item | Found |
|---|---|
| `auth.users` | 1, on your domain, confirmed, not banned |
| `profiles` | 1, HR/Admin, active, no employee link. `activated_at` is empty (see section 14) |
| employees, visitors, visits, visitor cards, card assignments, notifications | **0 in every table** |
| `app_settings` | 1 row, all fields empty |
| Real company data | **None** |
| Edge Functions deployed | None |
| Public sign-up | **Still ON** (`npm run check:supabase`) |
| CLI hosted writes | Refused without `--yes`: "ask the user". The scripts pass it only after `--execute --confirm=...` |

## 3. Migration status

**All 7 migrations are applied**, including the three earlier listed as pending. I did not apply them. `db push --dry-run` reports up to date, and `verify_remote.sql` passes 20 of 20 on the hosted project.

## 4. Migration review

| Migration | Changes | Destructive? | Existing data |
|---|---|---|---|
| `...150000_phase2_user_management` | Replaces `import_employees` with a version taking a batch permission; removes API insert, update and delete on `profiles`, keeping update of `full_name` and `active`; trigger stops an Admin being switched off through the API | Drops one function and recreates it, same body plus one parameter. Removes privileges | Admin row untouched |
| `...170000_phase3_candidate_import` | Adds `import_candidates`, `employee_names`, `visit_overview` | No | None |
| `...190000_app_settings` | Adds `app_settings` with one empty row, RLS on | No | None |

No duplicate policies (20 found, 20 expected). All new views are closed to `anon`. `visit_overview` uses `security_invoker`, so RLS applies as the caller; PostgreSQL 17 supports this.

## 5. Test logins

| Role | Email | Purpose |
|---|---|---|
| HR/Admin | Your existing account, unchanged | |
| Receptionist | `receptionist1@example.test`, `receptionist2@example.test` | Front desk |
| Employee | `employee1@example.test` | Permission on, active |
| Employee | `employee2@example.test` | Permission off |

**How they are made:** `supabase/create_test_users.ts` calls the Auth Admin API. This is the supported route, and never SQL on `auth.users`. No email is sent: these addresses are fictional, so the invitation flow could not reach them. You set one password for all four. It is read from your terminal, never printed or stored.

**The service-role key** is needed only for that script and for deleting the logins. It stays in your terminal for one command, is never given to me or saved, and never reaches the frontend. Each login carries `app_metadata.seed_run`, which only the service role can set. The role still comes from `profiles`.

*Unverified:* Supabase may reject the `.test` domain. If so, the script stops with the reason and changes nothing further.

## 6. The data

**How it is written.** Registration, check-in and candidate import go through the real database functions, acting as the real role, so the rules apply. History cannot, because those functions always use the current time: it follows the same steps with triggers and constraints on. The seed also confirms that the real function refuses to check in the delivery visit, and undoes everything if it does not.

**Tracking.** A private schema, `test_seed`, records every row by table and ID. It is not reachable through the API, needs no migration, adds no columns to business tables, and is removed by cleanup. Every fictional value is in a reserved range: employee IDs `TEST-E01`..., cards `TEST-C001`..., phones `01900000xxx`, emails `@example.test`, and companies named "Example ...".

### Exact counts (with one HR/Admin)

| Table | Added | Detail |
|---|---|---|
| employees | **15** | 9 active with permission on, 3 active with it off, 3 inactive. 7 teams, 8 job titles |
| profiles | **4** | The logins above |
| visitors | **30** | 20 + 10 candidates |
| visits | **40** | 20 + 10 repeat visits for history + 10 candidates |
| visitor cards | **20** | 8 Issued, 12 Available |
| card assignments | **23** | 8 open, 15 returned |
| notifications | **22** | 20 to HR/Admin, 2 to `employee1` |
| settings | fills empty fields | Organization name and fictional HR contact |

Visit status: **20 Expected** (10 + 10 candidates), **5 Checked In**, **15 Checked Out**.

Scenarios: 3 VIP visits; 2 groups, one with 4 expected and 3 actual; all 8 visitor types; a Delivery/Courier visit, recorded and never checked in; a typed host confirmed by HR; history spread over the last 13 days; a deactivated host who stays named on history.

### What the dashboards should show on the day it is seeded

| Screen | Figures |
|---|---|
| HR/Admin | Total Visitors 30, Expected Today 10, Checked In 5, Completed 15, Pending Approval —, Rejected — |
| Receptionist | Total Visitors Today 7, Currently Checked In 5, Checked Out 2 |
| Visitor Cards | Registered 20, Available 12, Issued 8 |

Compare with the database: `npx supabase db query --remote --read-only -f supabase/test_data/verify_seed.sql`. These change as you test, and Expected Today falls to fewer on later days.

### Where your brief and the schema differ

These are not forced into the schema:
- **Candidates** have no table, email or position. A candidate is a Job Interview visit, and the position goes in the purpose. Excel columns `Email` and `Position` are shown as "Ignored columns".
- **Pending Approval and Rejected** are not statuses, so no such records exist (open question Q1).
- **Delivery** cannot be Checked In, so it appears only as Expected.
- **Visitor address** has no column.
- **An inactive login for testing:** you listed four logins, none inactive. Test it by having HR/Admin deactivate `employee1`, then reactivate. Until the Edge Function is deployed, the app warns that the extra sign-in block was not applied, but the database denies access.
- **Current check-ins** are stamped at the moment of seeding, because the real function uses the current time.

## 7. Commands: seeding

Each one that writes needs your authorization.

```sh
# From the repository root. Read-only: shows what would happen.
node supabase/seed_test_data.ts

# 1. Test logins. Paste each value when asked; nothing is shown or saved.
read -s SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
read -s TEST_USER_PASSWORD && export TEST_USER_PASSWORD
node supabase/create_test_users.ts --execute --confirm=NAGORIKPASS-TEST-SEED-001
unset SUPABASE_SERVICE_ROLE_KEY TEST_USER_PASSWORD

# 2. The data. One transaction. Running it again changes nothing.
node supabase/seed_test_data.ts --execute --confirm=NAGORIKPASS-TEST-SEED-001

# 3. Check.
npx supabase db query --remote --read-only -f supabase/test_data/verify_seed.sql
```

The seed stops, changing nothing, if: this checkout is linked to another project; the migrations are missing; there is no active HR/Admin; a login lacks the marker or already has a profile; or a reserved ID, email, card or phone is already in use.

## 8. Commands: cleanup

```sh
node supabase/cleanup_test_data.ts       # read-only: exact counts and IDs, what blocks it, what stays
node supabase/cleanup_test_data.ts --execute --confirm=NAGORIKPASS-TEST-SEED-001
```

Testing will create rows the seed did not make: check-ins and visitors you add by hand. Cleanup will not guess about them:
- **Rows that depend on seed rows** make cleanup **refuse and remove nothing**. The preview lists each one.
- **Rows in the reserved ranges** that do not depend on seed rows stay unless adopted. Use the `01900000xxx` phone range, or `TEST-` and `example.test`, for anything you add while testing.
- Add `--adopt` to remove both groups, **only after reading the list**. If a real record appears there, fix it first.
- Other rows added after seeding are counted in the preview and never removed.

Deleting the logins is a separate step, and only touches a login on the exact list that carries the marker:

```sh
read -s SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
node supabase/cleanup_test_data.ts --execute --confirm=NAGORIKPASS-TEST-SEED-001 --delete-auth-users
unset SUPABASE_SERVICE_ROLE_KEY
```

What protects existing data:
- It never uses `TRUNCATE` or a reset.
- It refuses if the delete list names any row from before the seed, or any HR/Admin profile.
- Before committing, it proves every earlier row still exists. Any failure undoes everything.
- Settings return to their old values, unless changed since.
- Card history is normally undeletable. That guard is lifted inside the one transaction for the tracked rows, and is confirmed back on before commit.

Visitor IDs (`V-1001`...) are a sequence, so numbers used by the test data are not reused. Real visitors will start higher.

## 9. Browser testing, on the real project

Use `http://localhost:3000`, and a separate browser profile or private window per role.

**HR/Admin:** sign in and out; dashboard figures against section 6; chart and timeline; Employees: search, filters, edit, permission switch; Receptionists: list, edit; Visitors: add, VIP, edit, filters; History; Cards: add, duplicate refused, upload a file with the header `Card Number` and numbers `TEST-C021` onward; upload `supabase/test_data/interview_candidates_test.xlsx`; Reports: PDF and Print view; Settings.

Expect 6 valid and 4 problem rows from that file, `Email` and `Position` ignored, and a warning about the number-formatted phone. Upload it again after importing to see "Already expected".

**Receptionist:** Home figures; Expected Visitors: search, pick a card in the row, Check in; the "Checked in" dialog with HR contact; Courier Example Rider shows "Not permitted to enter"; Add New Visitor: host search, typed host, group; Check-out: answer **No** (stays Checked In), then **Yes**.

**Employee:** `employee1`: Add New Visitor, My Visitors, notifications. `employee2`: registration blocked. Both: `/admin` and `/reception` redirect home.

**Inviting from the app** will say the service is not deployed, which is correct until the Edge Functions are deployed.

## 10. Security checks

With the seed applied, I can run a version of `supabase/tests/e2e/api-security.mjs` against the hosted project: direct API calls as each role, with your test password supplied by you. It writes test rows, so it needs your authorization and runs before cleanup. Locally, 41 of 41 passed.

## 11. Replacing dummy data with real data

1. You provide the data. I map it to the schema and report conflicts and duplicates, changing nothing.
2. You authorize cleanup. Preview, review, execute, delete the logins, then run `verify_seed.sql` to confirm.
3. Import real employees and cards through the app's import pages.
4. Real records are never mixed with `TEST-`, `01900000xxx` or `example.test` values, and cleanup is not used again.

## 12. Operations that need your explicit authorization

Creating test logins; inserting test data; running the API security test; cleanup; deleting logins; changing Auth settings; deploying Edge Functions; sending any email; WhatsApp or Telegram. Each read-only command above does not.

## 13. Local tests of these scripts

`npm run test:seed`: applies migrations to a scratch database as a role set up like the hosted `postgres` role (not a superuser, owns the tables, can act as each role), then runs the real scripts. It covers the refusals, exact counts, idempotence, business rules, each role through RLS, existing rows unchanged byte for byte, cleanup refusal, `--adopt`, a tampered tracker, settings restored, and a late failure leaving nothing.

## 14. Risks and things not yet verified

- **Write mode on hosted has never run.** `db query --remote` without `--read-only` refuses without consent, so I could not confirm it runs as `postgres`, or accepts the whole file at once. If it cannot act as each role, the seed refuses before writing. Its transaction means a failure leaves nothing, but the first hosted run is still the real test.
- `create_test_users.ts` has not run against the real Auth API. Only its refusals were run.
- Your Admin profile shows `activated_at` empty, though you signed in today. Your last sign-in may predate that code. Sign in once more and I can re-check with a read-only query. If it stays empty, that is a bug to investigate.
- Public sign-up is ON: anyone can create a login, though with no profile it has no access. Turn it off before relying on this environment.
