# NagorikPass — PRD Implementation Report

Date: 2026-11-04. I committed, pushed, applied and deployed nothing. The migrations were later found applied on the hosted project.

## Architecture

Next.js App Router (server components and server actions), TypeScript, Tailwind CSS, `@supabase/ssr` cookie sessions, Supabase PostgreSQL, Auth, row-level security and two Edge Functions. No separate backend. Four layers of access control: the proxy (is there a session), `requireRole` in every page, a role check first in every server action, and row-level security with database functions as the final word. The Express `backend/` and the legacy folders in `frontend/src` (`screens`, `api`, `store`, `mocks`, `components/visits`, `layouts`) are outside the build and now fully replaced. They can be deleted when you choose.

## Database changes (applied to the hosted project; found applied 2026-11-04)

| Migration | Adds | Preview |
|---|---|---|
| `20261104150000_phase2_user_management` | Batch permission on the employee import; narrower `profiles` writes; an Admin cannot be switched off through the API | `MIGRATION_PREVIEW_PHASE2.md` |
| `20261104170000_phase3_candidate_import` | `import_candidates`, `visit_overview`, `employee_names` | `MIGRATION_PREVIEW_PHASE3.md` |
| `20261104190000_app_settings` | `app_settings`: one row, read by active roles, changed by HR/Admin | `MIGRATION_PREVIEW_PHASE3.md` |

## Security verification

Tested at the database and server layers, not by hiding buttons. 351 SQL checks act as each role; 41 direct API attempts go around the screens.

| Rule | Evidence |
|---|---|
| Employees and receptionists cannot reach HR/Admin features | Redirected in browser; server actions refuse with nothing reaching the database (unit); RLS refuses (SQL, API) |
| Receptionists see only employee name and team | `employees` returns no rows; directory and overview columns asserted; email not selectable |
| Inactive employees, or permission off, cannot register | Refused by `register_visit`, including when HR switched it off while the form was open (browser) |
| Delivery cannot check in or get a card | Constraint, trigger, function; no control on screen |
| Card status stays consistent; one card, one active visitor | Trigger; unique index; a real two-request race: exactly one wins |
| "No" cannot complete a check-out | Function enforces it; visit and card state read back |
| Roles cannot be changed; logins cannot be created through the API | Column grants; API probe |
| Forged tokens refused | API probe (stand-in verifier; real JWT checks are Supabase's) |
| No privileged key in browser code | Policy test scans the source; config refuses secret keys |
| Public sign-up | No code path. **The hosted setting was ON at the last check: you must turn it off** |

Direct server-action calls are tested at unit level with a controlled session, not by forging requests against the running server.

## Test results (final run)

| Check | Result |
|---|---|
| `npm run typecheck` | Clean |
| `npm run lint` | Clean |
| `npm test` | **797 pass**, 42 files |
| `npm run build` | Passes, 0 warnings |
| `npm run test:db` | **351 pass**, including two race tests |
| `npm run test:functions` | 25 pass |
| `npm run test:import-parity` | 600 rows identical |
| `npm run test:e2e-api` | **41 pass** |
| `npm audit` | 0 vulnerabilities (minimatch override from the earlier fix) |
| Browser: HR/Admin, Receptionist, Employee, staff and invitations, extras | All pass in Chromium, no browser errors |
| Browser sweep: 19 screens at 3 widths | No page overflow; only the print table scrolls sideways on small screens |
| Downloaded PDF | Opened with an independent parser: title, filters and correct rows. Not printed on paper |
| Real `.xlsx` | Read in the browser and in a fixture test; time correct |

## Known limitations

- **The app has not run against hosted Supabase beyond your Admin sign-in, seen in the dev log.** The REST and Auth layers in local testing are my own stand-in. It refuses query syntax it does not know, but it can differ from real PostgREST and Supabase Auth. First real run after applying the migrations should be treated as a test.
- Invitations are tested with the Edge Functions' real rule code, not on Supabase, and no email was ever sent. The default and token-link email formats are both handled, only tested through the stand-in.
- Notifications are in-app only. "Automatic" dashboard updates are a 20-second refresh, not instant.
- The downloaded PDF is Latin-only; Bangla works through Print view. At most 2000 rows per report.
- The commit `e7b6f5e` contains your real project URL and publishable key in `.env.example`. The working file now has placeholders. A publishable key is meant to be public, but it stays in history unless you rewrite it, which I have not done.
- No automated accessibility tool, screen reader or real phone was used.
