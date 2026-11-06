# 08. Testing Strategy

Part of the [Development PRD](DEVELOPMENT_PRD.md). No test here has been written yet. A feature is complete only when its tests have actually run and passed.

## Layers and tools

| Layer | Covers | Tool |
|---|---|---|
| Unit | Validators, Bangladeshi phone normalization, company-domain check, permission map, safe redirect logic | Vitest |
| Integration | Server Actions with error mapping | Vitest |
| API | Route Handlers, including auth failure cases | Vitest |
| Database constraints | Constraints and functions, including concurrency | SQL tests with Supabase CLI |
| RLS and RBAC | Every role against every table and function | SQL tests with Supabase CLI |
| End to end | Each workflow in a browser | Playwright |
| Excel | Valid, broken, malicious and duplicate files | Vitest with fixtures |
| Notifications | Telegram adapter, HR/Admin only | Vitest with a mocked provider |
| Google OAuth | Callback logic with mocked responses; a real Google login manually on staging | Vitest and a manual checklist |
| Realtime | Delivery and filtering | Playwright with two sessions |

Vitest and the Supabase CLI are already in the repository. Playwright is needed because the PRD's flows cross roles and devices. Tests never run against production data.

## Test catalogue

### Authentication

| ID | Case |
|---|---|
| TC-AUTH-01 | Email and password sign-in goes to the correct home for each role |
| TC-AUTH-02 | Google sign-in with an authorized account goes to the correct home for each role |
| TC-AUTH-03 | An unknown Google account is denied: no session, no profile, no role |
| TC-AUTH-04 | A Google sign-in for an inactive profile is denied and the session ended |
| TC-AUTH-05 | Cancelling at Google returns to login with the cancelled message |
| TC-AUTH-06 | A missing, invalid or reused code shows the failed message and gives no session |
| TC-AUTH-07 | External or malformed `next` values are ignored |
| TC-AUTH-08 | Sign-out ends the session for password and Google users |
| TC-AUTH-09 | Public sign-up is refused for email and for Google |
| TC-AUTH-10 | Google links to an invited account, accepted or not, with the same `user_id` and no duplicate user |
| TC-AUTH-11 | A Google account whose email differs from the invited email is denied, and a personal email can't be linked to an employee account |
| TC-AUTH-12 | Protected pages redirect without a session; deactivation removes access on the next request |
| TC-AUTH-13 | An Auth user with no profile receives no data, even if sign-up is accidentally on |
| TC-AUTH-14 | Provider error text is never displayed |
| TC-AUTH-15 | A personal or other-domain Google account is refused on the server, even after a successful Google login |
| TC-AUTH-16 | A company-domain Google account without an active profile is still denied |

### Employees and accounts

| ID | Case |
|---|---|
| TC-EMP-01 | Creating an employee creates the entry, the invitation and an `employee` profile |
| TC-EMP-02 | Work email required, valid, unique and in the company domain; personal addresses refused |
| TC-EMP-03 | Deactivation blocks sign-in and removes the person from host search and from new registrations (`host_inactive`) |
| TC-EMP-04 | Team create, rename, duplicate refused |
| TC-EMP-05 | Receptionist account invited with a company email, deactivated; can't deactivate self |
| TC-EMP-06 | Employee phone is optional; email is required |
| TC-EMP-07 | Deactivation keeps existing and upcoming visits, notifies HR/Admin of each upcoming visit, and returns the affected list |

### Authorization

| ID | Case |
|---|---|
| TC-RLS-01 | Receptionist search returns name and team only; `employees` isn't readable |
| TC-RLS-02 | Employee sees only own visits; can't read `visitors` |
| TC-RLS-03 | Anonymous access to all tables and functions refused |
| TC-RLS-04 | Direct writes to protected tables refused for all roles |
| TC-RLS-05 | Full role and table matrix matches [04](04-user-roles-and-permissions.md) |
| TC-RLS-06 | Inactive users get nothing |
| TC-RLS-07 | No user can change their own role or create a profile |

### Visits

| ID | Case |
|---|---|
| TC-VIS-01 | Name, phone and purpose required |
| TC-VIS-02 | Eight categories accepted; others refused |
| TC-VIS-03 | Employee registration needs no approval and appears for all relevant roles |
| TC-VIS-04 | HR/Admin pre-registers, including on an employee's behalf |
| TC-VIS-05 | Unscheduled registration and check-in need no extra approval |
| TC-VIS-06 | Host not found: typed name accepted |
| TC-VIS-07 | Check-in refused without Invited By |
| TC-VIS-08 | Same phone: one visitor, name kept per visit |
| TC-VIS-09 | Employee registration reveals nothing about a known phone number |
| TC-VIS-10 | Personal Guest recorded with its type |
| TC-VIS-11 | VIP keeps expected and actual counts |
| TC-VIS-12 | A group uses one card; a second assignment is refused |
| TC-VIS-13 | Courier log creates `not_permitted`; HR/Admin and employees can't create one |
| TC-VIS-14 | Courier check-in and card assignment refused by the database |
| TC-VIS-15 | No-show after the scheduled day, at the Asia/Dhaka boundary; couriers unaffected |
| TC-VIS-16 | Cancellation permitted by role and status |
| TC-VIS-17 | Editing only while `expected`, by permitted roles |
| TC-VIS-18 | Expected list shows today, and future dates through the filter |
| TC-VIS-19 | History contains every §6.6 field |
| TC-VIS-20 | History search and filters work |
| TC-VIS-21 | Bangladeshi numbers accepted in any common format and stored as `+880…`; international numbers refused |
| TC-VIS-22 | One phone can't have two active visits, for every role and import; a new visit is allowed after the previous one ends; simultaneous registrations can't both succeed |
| TC-VIS-23 | Visitor ID: only HR/Admin assigns it, once, unique; it stays with the visitor and is never a card number |

### Cards

| ID | Case |
|---|---|
| TC-CARD-01 | Manual card added; duplicates refused, ignoring case and spaces |
| TC-CARD-02 | Bulk upload imports valid rows and lists the rest |
| TC-CARD-03 | Dropdown offers only Available cards |
| TC-CARD-04 | Two simultaneous check-ins with one card: exactly one succeeds |
| TC-CARD-05 | Check-in records the time, links the card, sets Issued |
| TC-CARD-06 | Yes completes check-out and makes the card Available |
| TC-CARD-07 | No changes nothing |
| TC-CARD-08 | Popup text is exactly "Did you get the visitor card back?" |
| TC-CARD-09 | History keeps issued and returned times across reuse |
| TC-CARD-10 | HR/Admin closes a lost or damaged card, with a note, without showing it as returned |
| TC-CARD-11 | Receptionists can't resolve loss |
| TC-CARD-12 | Retire allowed only for Available cards; history kept |
| TC-CARD-13 | No available card blocks check-in with a clear message |
| TC-CARD-14 | Monitoring shows all §6.4 fields |
| TC-CARD-15 | New cards appear for Receptionists |
| TC-CARD-16 | HR/Admin corrects a card number: unique, history kept, audit row; other roles refused |

### Imports

| ID | Case |
|---|---|
| TC-IMP-01 | Candidates appear in Expected Visitors |
| TC-IMP-02 | Bad rows reported with row number and reason |
| TC-IMP-03 | Duplicates, phones with an active visit, and non-Bangladeshi phones rejected and reported |
| TC-IMP-04 | Wrong type, renamed file, oversized file and formula cells handled safely |
| TC-IMP-05 | Original stored in a private bucket; only HR/Admin can read it |
| TC-IMP-06 | Template columns match [05](05-api-contracts.md#cards-and-imports) |

### Notifications

| ID | Case |
|---|---|
| TC-NOT-01 | HR/Admin message at check-in with required content |
| TC-NOT-02 | Every workflow, including B, notifies HR/Admin only; no employee delivery is created (OQ-3) |
| TC-NOT-03 | Provider failure doesn't block check-in |
| TC-NOT-04 | Retry works and doesn't double-send after success |
| TC-NOT-05 | Failure is visible, with the manual fallback |
| TC-NOT-06 | Removed: employees don't link Telegram (OQ-4) |
| TC-NOT-07 | Removed: no Telegram webhook (OQ-4) |
| TC-NOT-08 | Employee deactivation creates an HR/Admin notice for each upcoming visit (OQ-8) |

### Realtime, dashboard, reports, settings, audit, UI

| ID | Case |
|---|---|
| TC-RT-01 | Dashboard updates after check-in and check-out without a reload |
| TC-RT-02 | Subscribers receive only permitted rows |
| TC-DASH-01 | KPIs shown; no Pending Approval or Rejected |
| TC-DASH-02 | Counts, graphs and timeline cover today in the organization's time zone (OQ-2) |
| TC-DASH-03 | Couriers excluded from Total Visitors |
| TC-DASH-04 | Reception Home counts and today's list |
| TC-RPT-01 | Filters: date, category, status, host |
| TC-RPT-02 | PDF generated on Vercel, with correct data |
| TC-RPT-03 | Excel generated; formula-like values escaped |
| TC-RPT-04 | Other roles refused |
| TC-SET-01 | Settings are HR/Admin only |
| TC-SET-02 | The time zone drives "today" and no-shows |
| TC-AUD-01 | Audit rows for accounts, retirement and closures; read-only |
| TC-DB-01 | Every check and unique constraint rejects bad data |
| TC-UI-01 | Each role sees its own navigation; no Visitor Approval, Print Card or unrequested items |
| TC-UI-02 | Reception flows are usable at mobile width |
| TC-UI-03 | PWA installs |
| TC-UI-04 | Loading, empty, error and success states on every screen; production build passes |
| TC-UI-05 | Contrast and keyboard use meet [11](11-ui-design-system.md) |
| TC-UI-06 | Continue with Google button appears, is keyboard usable, and shows progress and failure |

## Definition of done

A feature is done when it meets the PRD and this specification, works for the right roles, enforces database authorization, handles edge cases and all screen states, passes its tests, is responsive where required, and has updated documentation.
