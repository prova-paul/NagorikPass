# NagorikPass — Implementation Tracker

Requirements: `docs/NagorikPass_PRD.pdf`. The matching Markdown (`docs/NagorikPass_PRD_Updated.md`) has the same
text, so the two documents do not contradict each other. Row IDs refer to `docs/PDF_REQUIREMENTS_CHECKLIST.md`.

**Status words:** **Met** is built and tested end to end. **Partial** is built and tested in one layer only.
**Missing** is not built. **Blocked** waits on a decision or on the environment.

**Last updated:** 2026-11-04, end of Phase 1 (database).

## Phase 1: database and policies

Built in `supabase/migrations/` (three files) and tested by `supabase/tests/run.sh`: **143 checks pass**,
including a two-session race for one card. I also broke the migrations six ways on purpose (employees seeing
every visit, no delivery constraint, no delivery checks, writable card status, readable employees table,
"No" still checking out); each break made the suite fail.

**Verified on:** PostgreSQL 18.6 with a Supabase-compatible stand-in for `auth`. **Not verified:** Supabase
Auth, PostgREST, Edge Functions, or any hosted project.

| ID | Requirement | Status | What exists | Left |
|---|---|---|---|---|
| B1 | Eight visitor categories | **Partial** | Enum, all eight registered in a test | Forms |
| B2 | Mandatory name, phone, purpose; category | **Partial** | Enforced in `register_visit` and the table | Forms and screens |
| B3 | Guests, invited by, company | **Partial** | Columns; company optional | Forms |
| B4 | Record holds category, host, schedule, actual times, card | **Partial** | Columns and card history | Screens |
| C2–C4 | Check-in with an Available card; card Available to Issued; time recorded | **Partial** | `check_in_visit`, atomic, tested | Receptionist screen |
| C5 | Dashboard shows card; HR/Admin notified | **Blocked** | Notification rows are written for HR/Admin | Dashboard, delivery channel (Q10) |
| C7 | Exact popup text | **Missing** | | Screen |
| C8, C9 | Check-out Yes frees the card; No leaves everything unchanged | **Partial** | `check_out_visit`, tested both ways | Screen |
| C10, H10 | Card history with issue and return times | **Partial** | `card_assignments`, immutable, tested | Screen |
| D-B3, D-B5 | Employee visitor goes to Expected with no approval | **Partial** | `register_visit` makes it Expected at once | Employee screen |
| D-C7, K2 | No approval for unscheduled visitors | **Partial** | Same | Receptionist screen |
| D-C3 | Invited By typed name when employee not found | **Partial** | Column and tested | Screen |
| D-X1, K5 | Delivery never checked in, never a card | **Partial** | Constraint, trigger and function; tested at each layer | Screen |
| H1 | Bulk Excel card upload | **Blocked** | | Excel format and library (Q9, Q11b) |
| H2, H3 | Manual card entry; unique number | **Partial** | Insert and case-insensitive unique index, tested | Screen |
| H4–H5 | Cards visible to Receptionist and HR/Admin | **Partial** | Policies, tested | Screens |
| H7, H8 | Exactly one status; changes only through assignment | **Partial** | Trigger plus column grants; invariant tested | |
| K1 | Employees register without approval | **Partial** | Tested | Employee screen |
| K3 | Access restricted by role | **Partial** | Policies and grants for all seven tables, tested as each role | Auth wiring |
| K4 | Receptionist sees name and team only | **Partial** | `employee_directory`, tested; the table is unreadable | Screens |
| K6 | Check-out only after card return confirmed | **Partial** | Function, tested | Screen |
| K7 | Only HR/Admin manages cards | **Partial** | Policies, tested | Screen |
| L3, L5 | Supabase PostgreSQL; database policies | **Partial** | Migrations written for Supabase | Run on a real project |
| J3, J4, J7, J8 | History fields: guests, invited by, card, type | **Partial** | Stored | Screen and report |

Everything in the checklist not named above is unchanged from `PDF_REQUIREMENTS_CHECKLIST.md`.

### Files changed this phase
Created: `supabase/migrations/20261104090000_core_schema.sql`, `20261104090100_visit_functions.sql`,
`20261104090200_rls_and_grants.sql`; `supabase/tests/` (`run.sh`, `shim.sql`, `helpers.sql`, four `*.test.sql`
files, two concurrency scripts); `supabase/README.md`; this file. No existing file was modified. The Express
backend, the frontend and `backend/migrations/` are untouched and the current app still runs on Express.

### Environment side effects
The test shim created three PostgreSQL roles on the local server: `anon`, `authenticated`, `service_role`.
They are left in place. A scratch database `nagorikpass_rls_test` is created and dropped on each run.
`nagorikpass` (development) and `nagorikpass_test` were not touched.

## Assumptions in the schema while questions are open

These are choices I had to make to write the schema. Each can be changed in a later migration. None changes
what the PDF says.

| # | Assumption | Question |
|---|---|---|
| 1 | Visit status is `expected`, `checked_in`, `checked_out`. No Pending or Rejected state | Q1 |
| 2 | A Delivery/Courier visit can be registered and stays Expected, but can never be checked in | Q4 |
| 3 | Check-in accepts one or more cards, so a group can be given several | Q3 |
| 4 | Scheduled arrival and departure are optional | Q14 |
| 5 | Invited By is an employee, a typed name, both or neither; nothing is filled in automatically | Q5 |
| 6 | Employees have `full_name`, `team` and private `official_email`, `phone`; no employee code or designation | Q7 |
| 7 | "Team" is a free-text column named `team` | Q7 |
| 8 | A returning visitor is recognised by name and phone and keeps one Visitor ID | none in the PDF |
| 9 | Organisation time zone is Asia/Dhaka, written into `org_today()` and one policy | none in the PDF |
| 10 | The Receptionist sees Expected and Checked In visits, and visits checked out today | none in the PDF |
| 11 | Check-in writes notification records for every HR/Admin and for the employee who registered the visitor; nothing is delivered yet | Q10 |
| 12 | Visitor email, invitation emails, cancelling, audit log and DOCX/CSV exports are not carried over | Q17 |

## Next phases

| Phase | Status |
|---|---|
| 2 Supabase Auth, role from profile, navigation per the PDF, token restyle | **Blocked** on the Supabase environment |
| 3 Registration screens | Blocked on 2 |
| 4 Front desk screens | Blocked on 2 |
| 5 Cards screen | Blocked on 2; Excel upload also on Q9 |
| 6 Excel import, VIP and group | Blocked on Q3, Q9 |
| 7 Notifications, dashboard, history, reports | Blocked on 2; delivery on Q10 |
| 8 Clean-up of Express and approvals | After 2 to 7, and Q1 |
| 9 Acceptance | Last |

## The question that blocks everything after Phase 1

**Where does Supabase run?** The Supabase CLI and Docker are not installed on this Mac and there are no
Supabase credentials, so I cannot run Supabase Auth, PostgREST or Edge Functions here, and the screens cannot be
connected to a real backend or tested.

- **(a)** I install the Supabase CLI and Docker Desktop on this Mac and run a local stack, or
- **(b)** you create a hosted Supabase project and give me its URL and anon key (never the service-role key in the repository).

---

## Phase 2 preparation — 2026-11-04

Decision taken: **hosted Supabase Cloud with the Supabase CLI**. Dependencies approved: `@supabase/supabase-js`,
an Excel reader, and a PDF library only if the PRD needs one.

| Item | Status | Detail |
|---|---|---|
| `@supabase/supabase-js` | **Done** | `^2.118.0` added to `frontend/`. Not imported anywhere yet. Frontend typecheck, lint, build and 26 tests pass |
| Supabase CLI | **Present** | Version 3.0.0 at the repository root (`package.json`, `node_modules/`). Hosted project is not linked yet |
| Root `.gitignore` | **Added** | The CLI install had left an untracked root `node_modules/` (134 MB) with no ignore rule. Now ignored, with `.env*`, `supabase/.temp` |
| `supabase/config.toml` | **Created** by `supabase init` | Local defaults only. Do not run `supabase config push` |
| `frontend/.env.example` | **Added** (names changed in the Next.js conversion, see below) | Was `VITE_SUPABASE_*`; now `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Real values go in `frontend/.env.local`, which `*.local` already ignores |
| Setup guide | **Written** | `docs/SUPABASE_SETUP.md`: project creation, `login`, `link`, dry run, first admin, auth settings |
| Excel reader | **Chosen, not installed** | `read-excel-file`: 7 packages and no known vulnerabilities, against 193 packages and 9 moderate for `exceljs`, and a high-severity issue in npm `xlsx` |
| PDF library | **Not needed yet** | Decide in Phase 7 |
| Excel templates | **Blocked** | Proposed in `docs/EXCEL_IMPORT_PROPOSAL.md`; waiting for your confirmation (E1 to E8). Nothing is built |
| Hosted database | **Untouched** | No migration has been pushed. Waiting for your approval after a dry run |

Re-verified after these changes: frontend typecheck, lint, build and tests pass; `supabase/tests/run.sh`
passes all 143 checks. The Express backend and `backend/migrations/` are unchanged.

### Phase 2 status

| Task | Status |
|---|---|
| Supabase Auth sign-in and session | **Blocked** until the project exists and I have its URL and publishable key. I will not write it against a mock |
| Role from `profiles`, protected routes | **Blocked** on the same |
| Role-specific navigation per the PDF | **Blocked** on the same; pages for most items do not exist yet |
| HR/Admin creating employee and receptionist logins | **Blocked** on question Q8 (how accounts are created) |
| Connecting screens to the schema | **Blocked** on the project, then done page by page in Phases 3 to 7 |

---

## Hosted project connected — 2026-11-04

| Item | Status |
|---|---|
| Project `lbrhdgxooxwanvxuxdzn` (NagorikPass, Tokyo, PostgreSQL 17.11) | **Reachable and healthy**. The CLI is logged in and the folder is linked |
| `frontend/.env.local` | **Not created yet**; the publishable key is still to be provided by you |
| Dry run against the hosted project | **Done**: would apply exactly the three Phase 1 migrations. Nothing applied |
| Pre-flight inspection (read-only) | **Done**: project empty; found the platform function `rls_auto_enable` |
| Migrations pushed | **Yes, 2026-11-04, after your approval.** See below |

Changes to the Phase 1 migrations before any push (they have not been applied anywhere, so editing them is safe):
revokes are now by function name so the platform function is untouched; `search_path` pinned on the last two
functions. Database tests: **151 checks pass** (was 143). New: `supabase/verify_remote.sql`, a read-only structural
check with 16 checks, run in the test suite and meant for the hosted project after the push.

---

## Migrations applied to the hosted project — 2026-11-04

Approved by you, then applied with `npx supabase db push --remote --skip-vault --yes`. All three Phase 1
migrations ran without errors.

| Check | Result |
|---|---|
| Migration history on the hosted project | `20261104090000`, `20261104090100`, `20261104090200` |
| `supabase/verify_remote.sql` (read-only, structure and privileges) | **16 PASS, 0 FAIL** |
| Objects now in `public` | 7 tables, 18 policies, 10 functions (our 9 plus the platform's) |
| Users and profiles | 0 and 0 |
| Behaviour tests (151 checks) | Pass on local PostgreSQL. **Not run on the hosted project**: they create test users and data |

**What this proves and what it does not.** The schema, privileges and policies on the hosted project match what
the local tests verified. The behaviour of Supabase Auth, the Data API as a signed-in user, and each role's
real access on the hosted project are **not yet tested**; that needs the first HR/Admin login and the publishable key.

### Next
1. You create the first HR/Admin login (`docs/SUPABASE_SETUP.md`, Step 7).
2. You create `frontend/.env.local` with the publishable key.
3. Then Phase 2: Supabase Auth, role from `profiles`, protected routes, role navigation, tested for real.
4. Still open and not blocking: Q8 (how accounts are created) and the Excel templates (E1 to E8).

---

## First HR/Admin created — 2026-11-04

You created the login in the dashboard and sent the exact statement. I checked first, read-only, that the login
existed, its email was confirmed, it was the only user and `profiles` was empty. Then I ran that one `insert`.

| Check | Result |
|---|---|
| Profile row | 1 row: role `admin`, name `ProvaPaul`, active. It is the only profile |
| `supabase/verify_remote.sql` afterwards | 16 PASS, 0 FAIL |
| Does the hosted login map to the admin role through the real JWT? | **Not verified.** The CLI's read-only login cannot run our functions or switch role, so it cannot sign in as you. This is tested for real when you sign in through the app |

### Finding: `service_role` has no grants on our schema

On the hosted project, `service_role` (the key an Edge Function uses) can do nothing on our 7 tables, the
`employee_directory` view or our functions. Hosted default privileges give it only truncate, references, trigger
and maintain on new tables, and our migrations add nothing for it.

- **Effect today:** none. The browser uses `authenticated`, and the dashboard SQL editor uses `postgres`.
- **Effect later:** an Edge Function that creates employee or receptionist logins (question Q8) would be refused.
- **Plan:** add the narrowest grants that function needs in a new migration when it is designed, with your approval.
  Not done now, because a locked-down default is safer than guessing.

### Testing roles on the hosted project

I cannot sign in as you (I do not have, and should not have, your password). To test the receptionist and employee
roles for real I will need test logins for them. Suggestion for when we get there: create a receptionist and an
employee login in the dashboard, with passwords you keep, and test each in the browser, or give me throwaway
accounts and delete them afterwards. Your call.

---

## Addendum A — employee management additions (2026-11-04)

Your additional requirements, which are **not in the PDF or the Markdown PRD** (those files are unchanged). Design
and questions: `docs/EMPLOYEE_MANAGEMENT_DESIGN.md`. **Status updated at the end of this entry: the database and logic are built and tested locally; nothing is applied to the
hosted project; the screens are not built.**

| ID | Requirement | Status |
|---|---|---|
| EM-1 | Add employees individually | **Partial.** Admin insert is allowed by policy and covered by tests (including trimming, lower-cased email, uniqueness). Screen not built |
| EM-2 | Edit employees | **Partial.** Edit is allowed by policy and tested. Screen not built |
| EM-3 | Deactivate employees | **Partial.** `employees.active` carries to the login by trigger, tested both ways. Ban-at-sign-in function written, not deployed. Screen not built |
| EM-4 | View and search all employees | **Partial.** HR/Admin can search by name, Employee ID, email and team (tested). Screen not built |
| EM-5 | Manage employee access and permissions | **Partial.** Active/inactive and `can_register_visitors`, as designed; both tested. Screen not built |
| EM-6 | Bulk import (`.xlsx` and CSV) with preview, validation, duplicate detection, row errors, results | **Partial.** Parsing, preview rules, results and error report built and tested (32 tests); `import_employees` tested; browser and database agree on 600 generated rows. Import dialog not built; migration not applied |
| EM-7 | Create and invite accounts securely after validation | **Blocked** on approval of the migration and of an Edge Function deploy. `admin_create_profile`, `admin_mark_invited` and `invite-user` written and tested locally |
| EM-8 | `can_register_visitors`, enforced in the database | **Partial.** Enforced in `register_visit`, tested as each role (on, off, deactivated, cannot self-enable). Not applied to the hosted project |
| EM-9 | Clear access-denied message | **Partial.** The database raises `visitor_registration_not_permitted` (privilege error 42501). The screen message is not built |
| EM-10 | HR/Admin creates Employee and Receptionist accounts by invitation; users set passwords | **Blocked** on approval of the migration and of an Edge Function deploy; a dashboard action for you (invite email template) |
| EM-11 | Public self-registration disabled | **Blocked** on a dashboard setting you change; I will confirm it on your project |
| EM-12 | Invitations through Edge Functions, no service-role key in the frontend | **Partial.** `invite-user` and `set-login-status` written; 25 unit tests of their logic; type-checked against the real supabase-js. Not deployed. Cannot be run locally (no Docker, no Deno), so they are tested on the hosted project after you approve a deploy |
| EM-13 | Receptionists cannot read private employee information | **Partial.** New private columns stay in `employees`; tests assert receptionists cannot read them and the directory is unchanged. Hosted: not applied |
| EM-14 | Tracker and tests updated | **Partial.** 249 database checks, 25 function tests, 58 frontend tests (32 new), parity check. Updated with each step |

Question Q8 (how accounts are created) is answered by EM-10 and EM-11.

### Addendum A — progress, 2026-11-04

Your decisions A1 to A8 are recorded in `docs/DECISIONS_AND_OPEN_QUESTIONS.md`.

| Built and tested locally | Where |
|---|---|
| Migration: Employee ID, designation, `can_register_visitors` (default ON), required email, email lock, deactivation trigger, `import_employees`, `admin_create_profile`, `admin_mark_invited`, `mark_account_active`, permission check in `register_visit` | `supabase/migrations/20261104130000_employee_management.sql` |
| SQL tests, acting as each role, plus two races | `supabase/tests/05_employee_management.test.sql`, `concurrency_*` (249 checks in all) |
| Structural check for the hosted project, updated | `supabase/verify_remote.sql` (20 checks) |
| Edge Functions and their tested logic | `supabase/functions/` (`invite-user`, `set-login-status`, `_shared/`) |
| Import logic: header rules, validation, preview, results, error report | `frontend/src/lib/employeeImport.ts`, `employeeImportFile.ts` |
| Browser-versus-database parity check | `supabase/tests/import_parity.mjs` |

| Not done | Why |
|---|---|
| Hosted migration | **Waiting for your approval** (`docs/MIGRATION_PREVIEW_EMPLOYEE_MANAGEMENT.md`) |
| Deploy the two Edge Functions, set the `APP_URL` secret | Waiting for your approval; after the migration |
| Screens (Employee and Receptionist Management, import dialogs, invitation page, access-denied message) | After the migration; sign-in work needs `frontend/.env.local` |
| Sign-in with Supabase Auth, role routing | Needs the publishable key in `frontend/.env.local` |
| Dashboard settings (sign-ups off, Site URL, invite template, SMTP) | Yours to change; I will give exact steps. SMTP is only needed for bulk invitations |

New dependencies added with your approval: `papaparse`, `@types/papaparse`, `read-excel-file` (production audit: 0
vulnerabilities). The older findings in `npm audit` are the existing `eslint` to `minimatch` development-tool chain.

New commands from the repository root: `npm run test:db`, `test:functions`, `typecheck:functions`,
`test:import-parity`.

---

## Employee management migration applied — 2026-11-04

Approved by you, then applied with `npx supabase db push --remote --skip-vault --yes`.

| Check | Result |
|---|---|
| Hosted employees table before the push | 0 rows (checked immediately before) |
| Migration history | `20261104090000`, `…090100`, `…090200`, `20261104130000` |
| `supabase/verify_remote.sql` (read-only) | **20 PASS, 0 FAIL** |
| Hosted objects | 17 functions in `public` (1 platform, 9 from Phase 1, 7 new); 18 policies; 0 employees; 1 profile (yours, unchanged) |
| Behaviour tests on the hosted project | **Not run** (they create test data; this is a production project). They pass locally: 249 checks |

What this proves: the hosted schema, privileges and policies match what the local tests verified, including that
`service_role` can run exactly the two invitation functions and read or write no table. What it does not prove:
that the permission check, import and invitation work through Supabase Auth and the Data API on the hosted
project. That needs the deploy and a real sign-in.

**Addendum A statuses.** EM-8 (permission enforced in the database) and the database side of EM-1 to EM-6 and EM-13
are now applied on the hosted project and verified structurally. EM-7, EM-10 and EM-12 still need the Edge Function
deploy, which is a separate approval. EM-11 needs a dashboard setting. The screens are not built.

### Next
1. **Edge Functions deploy** (needs your approval): `invite-user`, `set-login-status`, and an `APP_URL` secret.
2. **Dashboard settings** (yours): sign-ups off, Site URL, invite email template.
3. **`frontend/.env.local`** with the publishable key, for Supabase sign-in and the screens.
4. A **test email you control** before any invitation is sent.

---

## Application foundation and authentication — 2026-11-04

The frontend is now **Next.js 16.4.5 (App Router) with Supabase Auth** (DEC-011: the product owner chose Next.js over
the PRD's Vite, with server-side cookie sessions, converted in place). Nothing on the hosted project changed in this
phase, and no email was sent. Verified afterwards, read-only: structural check **20 PASS, 0 FAIL**; migrations unchanged;
1 profile (yours, unchanged); 0 employees; **no Edge Function deployed**.

### Built

| Area | What exists |
|---|---|
| Supabase client | Server, proxy and browser clients from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The loader **refuses a secret or service-role key** and shows a "setup required" page when the two values are missing |
| Types | `src/types/database.ts`, generated from the hosted schema (`npm run types:generate`) |
| Sign-in | Login page with validation, a server action that checks the profile before letting anyone in, and clear messages for wrong credentials, rate limiting, an unreachable server, an inactive invitation and a deactivated account |
| Sessions | Cookies via `@supabase/ssr`; the proxy refreshes them on every request; verified with `getClaims` (never trusts the cookie as it is) |
| Session expiry | Proxy redirect `/login?reason=expired`; a listener in the open page sends the person to the login page when the session ends elsewhere |
| Sign-out | Ends this device's session; other tabs follow |
| Protected routes | Proxy (signed-in or not) plus `requireRole` in **every** protected layout **and** page (layouts do not re-run on every navigation), plus row-level security as the final check |
| Role routing | HR/Admin `/admin`, Receptionist `/reception`, Employee `/employee`; a wrong-area visit goes to the person's own home; a login with no profile or a deactivated one is signed out through `/auth/denied` (cannot loop) |
| No self-registration | No sign-up route, page or call; a structural test enforces it. **You must also turn it off in the dashboard** |
| Layout | Shell with sidebar, header, account menu, sign-out, skip link and a mobile drawer; one Dashboard link per role (only pages that exist) |
| Dashboards | Three role pages with **real** Supabase figures; an unreadable figure shows "—" with a warning, never 0. Employees see their real `can_register_visitors` permission and the access-denied message when it is off |
| Loading and errors | `loading.tsx` and `error.tsx` per area, root `error.tsx`, not-found, setup-required |
| Design | Royal purple, lavender and white tokens sampled from the reference image; active sidebar item changed to a translucent highlight (the brighter purple gave white text 4.4:1, under the 4.5:1 minimum) |
| Connection check | `npm run check:supabase`: uses only the publishable key, reads the public auth settings (is sign-up off?), makes one bad sign-in, and confirms a signed-out caller cannot read any table or run any function. Never signs up or writes |

### Tests and exact results

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, no findings |
| `npm run build` | exit 0, 0 warnings. Routes: `/`, `/admin`, `/auth/denied`, `/employee`, `/login`, `/reception` dynamic; `/_not-found`, `/setup-required` static; Proxy registered |
| `npm test` | **254 passed, 0 failed** in 22 files (58 before this phase: 26 existing + 32 import; **196 new**) |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Database tests, `npm run test:db` | 249 pass (unchanged) |
| Edge Function logic | 25 pass; type-check ok |
| Browser-versus-database import parity | 600 rows, identical |

New tests by area: access matrix **73** (9 kinds of person × 3 areas, layout **and** page, plus root and login redirects), login form 9,
dashboard shell and session listener 14, dashboards 9, login action 10, proxy 9, sign-out route 5, profile lookup 6, access
decisions 8, config 7, roles and safe redirects 7, messages 7, dashboard figures 6, errors 4, connection check 10, structural policy 12.

The access matrix runs the **real** Data Access Layer, layouts and pages and controls only Supabase's answers. People covered:
signed out, admin, receptionist, employee, a login with no profile, a deactivated employee, an unknown role, an expired
token, and an unverifiable token.

**Proof the tests can fail:** 8 deliberate breaks in a scratch copy (any role can open any area; a page forgets its check;
sign-in lets in a login with no profile; a secret key accepted; the proxy lets signed-out visitors through; the sign-out
route stops re-checking; an unknown error's text shown; a real open redirect). All 8 failed the suite. (My first open-redirect
break removed one of two overlapping checks and changed nothing, because the function returns only a parsed path; I replaced it
with a break that returns the raw address, and that one fails the suite.)

Also checked on a **real Next.js server** over HTTP, with placeholder settings (never your real project): signed-out requests
to `/admin`, `/reception`, `/employee` and `/` redirect to `/login`, keeping the wanted page; a dead session cookie gives
`reason=expired`; `/login` has no links and no sign-up wording; the notice text cannot be injected; security headers present;
`x-powered-by` absent; no settings, or a secret key, shows the setup page without printing the key. Seen in a browser at
1280 px and 390 px wide: the login screen, no console errors apart from dev hot-reload.

### Not tested, and why

| Not tested | Why |
|---|---|
| Sign-in against the **hosted** Supabase | `frontend/.env.local` does not exist yet, and I do not have anyone's password |
| Real behaviour for each role on the hosted project | Needs a receptionist and an employee login. I created none |
| The signed-in screens **visually** | They need a real session. Their structure and behaviour are tested in a browser-like environment |
| `npm run check:supabase` against your project | Needs the key. Tested against a local mock that I made misbehave (10 tests) |
| Cross-tab sign-out in real browsers | Tested with the listener's events, not with two real tabs |

### Left over

Legacy code written for the old Express API and react-router stays on disk, outside the build (and no longer compiles) until
each part is rewritten: `src/screens`, `src/api`, `src/store`, `src/mocks`, `src/components/visits`, `src/layouts`,
`src/auth/AuthContext.tsx`, `src/auth/RequireRole.tsx`, `src/lib/csv.ts`. The Express backend and `backend/migrations` are
untouched. `CLAUDE.md` and the two PRD documents still say "Vite"; I did not edit them.

Two mistakes of mine during testing, both caught and fixed: a placeholder address (`stub.supabase.co`) that looked unused,
replaced by the reserved `.invalid` form (it does not resolve, so nothing was sent anywhere); and a library removed before
the last file importing it was moved out of the build, caught by the type check.
