# NagorikPass — PRD Compliance Matrix

Audit of 2026-11-04 against `docs/NagorikPass_PRD.pdf` (read in full, 9 pages), checked against the code and by running it.

## How to read this

- **VERIFIED (local)**: the behaviour was observed on this machine, at the layer that enforces it.
- **Local means**: real PostgreSQL with every migration, real row-level security, triggers and functions, and a real Chromium driving a production build of the app. The HTTP layer (REST and Auth) is a test stand-in, `supabase/tests/e2e/stack.mjs`, because Docker is not available and downloading PostgREST was not permitted here. So **no row here is verified on hosted Supabase**.
- Evidence: *Browser run* = `supabase/tests/e2e/browser/`; *SQL tests* = `supabase/tests/*.test.sql`; *API probe* = `supabase/tests/e2e/api-security.mjs`; *Unit/component tests* = `frontend/src/**/*.test.*`. All passed in their final run (see `PRD_IMPLEMENTATION_REPORT.md`).

## Totals

| Status | Requirements |
|---|---|
| VERIFIED (local) | 127 |
| IMPLEMENTED, NOT VERIFIED | 3 |
| PARTIAL | 2 |
| NOT IMPLEMENTED | 0 |
| BLOCKED | 6 |
| **Total** | **138** |

**Verified locally: 127 of 138 (92%). Behaviour verified on the hosted project: 0 of 138.** The hosted database structure is verified (20 of 20 checks); running the app against it waits for the test data in `TEST_DATA_GUIDE.md`.

## Requirements

| ID | PRD | Requirement | Implementation | Verification | Status | Note |
|---|---|---|---|---|---|---|
| G-1 | §1 | Centralized platform replaces manual logs; records, expected list, status, notifications, dashboards, history, reports | whole app | Browser run | VERIFIED (local) |  |
| G-2 | §1 | Real-time visit status | components/ui/AutoRefresh.tsx (20 s refresh) | Unit/component tests, Browser run | VERIFIED (local) | Refresh every 20 s, not instant push |
| G-3 | §1,2 | Information protected by role-based access control | RLS migrations, lib/dal.ts, lib/adminAction.ts | SQL tests, API probe, Browser run | VERIFIED (local) |  |
| RO-H1 | §3 | HR/Admin manages employees, receptionists and visitor records | src/app/admin/employees, receptionists, visitors | Browser run | VERIFIED (local) |  |
| RO-H2 | §3 | HR/Admin registers expected visitors in advance | src/app/admin/visitors, VisitFormModal | Browser run, SQL tests | VERIFIED (local) |  |
| RO-H3 | §3 | HR/Admin monitors dashboards, history, reports | src/app/admin, history, reports | Browser run | VERIFIED (local) |  |
| RO-H4 | §3 | HR/Admin receives notifications when visitors check in | check_in_visit; AdminPanels Notifications | Browser run, SQL tests | VERIFIED (local) | In-app. See N-3 |
| RO-H5 | §3 | HR/Admin adds employee-initiated visitors to the expected list | register_visit (automatic, workflow B) | Browser run, SQL tests | VERIFIED (local) | PRD conflict (Q2): workflow B says the system does it with no HR action. Workflow B followed |
| RO-H6 | §3 | HR/Admin registers cards and monitors status and assignment history | src/app/admin/cards | Browser run | VERIFIED (local) |  |
| RO-H7 | §3 | HR/Admin uploads interview candidates and registers VIP visits and groups | src/app/admin/visitors/import, RegisterVipButton | Browser run | VERIFIED (local) |  |
| RO-R1 | §3 | Receptionist views expected visitors and registers unscheduled visitors | src/app/reception/expected, new | Browser run | VERIFIED (local) |  |
| RO-R2 | §3 | Receptionist searches for the employee visitors want to meet | HostPicker, searchHostsAction | Browser run | VERIFIED (local) |  |
| RO-R3 | §3 | Receptionist checks visitors in and out | VisitRowActions, check_in_visit, check_out_visit | Browser run, SQL tests, API probe | VERIFIED (local) |  |
| RO-R4 | §3 | Receptionist manages visitor information through web and mobile | register only; no edit after registering | Browser run | PARTIAL | Registering and check-in work. Editing after registering is HR/Admin only: open question Q16 |
| RO-R5 | §3 | Receptionist assigns an available card at check-in and confirms return at check-out | VisitRowActions, CheckOutDialog | Browser run | VERIFIED (local) |  |
| RO-R6 | §3 | Receptionist does not check in delivery personnel | VisitRowActions, DB constraint, trigger, function | Browser run, SQL tests, API probe | VERIFIED (local) |  |
| RO-E1 | §3 | Employee coordinates invitations and provides visitor information | Add New Visitor, My Visitors | Browser run | VERIFIED (local) | The human part is a process, not a feature |
| RO-E2 | §3 | Employee takes responsibility for coordinating invited visitors | host set automatically to the employee | Browser run | VERIFIED (local) |  |
| C-1 | §4 | Eight visitor categories | visitor_category enum, lib/visitLabels.ts | SQL tests, Browser run | VERIFIED (local) |  |
| C-2 | §4 | Delivery/Courier not permitted to enter; never checked in | see RO-R6 | Browser run, SQL tests, API probe | VERIFIED (local) |  |
| C-3 | §4 | Record holds mandatory and additional fields, category, host, scheduled arrival/departure, actual times, card | visits, visit_overview | Browser run, SQL tests | VERIFIED (local) |  |
| F-1 | §4.1 | Visitor name mandatory | lib/visitForm.ts, register_visit | Browser run, Unit/component tests, SQL tests | VERIFIED (local) |  |
| F-2 | §4.1 | Phone number mandatory | lib/visitForm.ts, register_visit | Browser run, Unit/component tests, SQL tests | VERIFIED (local) |  |
| F-3 | §4.1 | Purpose of visit mandatory | lib/visitForm.ts, register_visit | Browser run, Unit/component tests, SQL tests | VERIFIED (local) |  |
| F-4 | §4.1 | Number of guests captured | VisitFormFields, visits | Browser run, SQL tests | VERIFIED (local) |  |
| F-5 | §4.1 | Invited by (employee name) captured | VisitFormFields, visits | Browser run, SQL tests | VERIFIED (local) |  |
| F-6 | §4.1 | Company or organization captured | VisitFormFields, visits | Browser run, SQL tests | VERIFIED (local) |  |
| CI-1 | §5 | Receptionist registers or finds the visitor | Expected Visitors search, Add New Visitor | Browser run | VERIFIED (local) |  |
| CI-2 | §5 | Selects an available card from the dropdown in the visitor list | VisitRowActions | Browser run | VERIFIED (local) | Gap fixed: it was in a dialog |
| CI-3 | §5 | Clicks Check-in; system links card to the visitor | check_in_visit | Browser run, API probe | VERIFIED (local) |  |
| CI-4 | §5 | Records check-in time; card Available to Issued | check_in_visit, sync_card_status | Browser run, SQL tests | VERIFIED (local) |  |
| CI-5 | §5 | Card and visitor details appear on HR/Admin dashboard; HR/Admin notified | CurrentlyIn, Notifications | Browser run | VERIFIED (local) |  |
| CI-6 | §5 | A card cannot go to two active visitors at once | unique index, row locks | SQL tests (race), API probe (race) | VERIFIED (local) |  |
| CO-1 | §5 | Visitor returns the card | process | Browser run | VERIFIED (local) | Human step |
| CO-2 | §5 | Check-out shows exactly "Did you get the visitor card back?" | CheckOutDialog | Browser run, Unit/component tests | VERIFIED (local) |  |
| CO-3 | §5 | Yes: records time, status Checked Out, card Available, dashboard updates | check_out_visit | Browser run, SQL tests, API probe | VERIFIED (local) |  |
| CO-4 | §5 | No: incomplete; stays Checked In; card stays assigned | check_out_visit | Browser run, SQL tests, API probe | VERIFIED (local) |  |
| CO-5 | §5 | Every assignment and return kept with times | card_assignments (no delete) | Browser run, SQL tests, API probe | VERIFIED (local) |  |
| WA-1 | §5 | A: HR/Admin registers the visitor | see workflow | Browser run | VERIFIED (local) |  |
| WA-2 | §5 | A: Visitor appears in Expected Visitors | see workflow | Browser run | VERIFIED (local) |  |
| WA-3 | §5 | A: Receptionist verifies and checks in | see workflow | Browser run | VERIFIED (local) |  |
| WA-4 | §5 | A: Check-in recorded, HR/Admin notified | see workflow | Browser run | VERIFIED (local) |  |
| WA-5 | §5 | A: Receptionist checks out | see workflow | Browser run | VERIFIED (local) |  |
| WB-1 | §5 | B: Employee logs in, selects Add New Visitor | see workflow | Browser run | VERIFIED (local) |  |
| WB-2 | §5 | B: Enters name, phone and visit details | see workflow | Browser run | VERIFIED (local) |  |
| WB-3 | §5 | B: Added to Expected Visitors | see workflow | Browser run | VERIFIED (local) |  |
| WB-4 | §5 | B: Appears on HR/Admin dashboard and records | see workflow | Browser run | VERIFIED (local) |  |
| WB-5 | §5 | B: No HR/Admin approval | see workflow | Browser run, SQL tests | VERIFIED (local) |  |
| WB-6 | §5 | B: Receptionist finds and checks in | see workflow | Browser run | VERIFIED (local) |  |
| WB-7 | §5 | B: Check-in time and status recorded | see workflow | Browser run | VERIFIED (local) |  |
| WB-8 | §5 | B: Notifies registering employee and HR/Admin | see workflow | Browser run, SQL tests | VERIFIED (local) |  |
| WB-9 | §5 | B: Receptionist checks out | see workflow | SQL tests | VERIFIED (local) |  |
| WC-1 | §5 | C: Receptionist registers the visitor | see workflow | Browser run | VERIFIED (local) |  |
| WC-2 | §5 | C: Searches for the employee | see workflow | Browser run | VERIFIED (local) |  |
| WC-3 | §5 | C: If not found, records confirmed employee in Invited By | see workflow | Browser run, SQL tests | VERIFIED (local) |  |
| WC-4 | §5 | C: Checks in | see workflow | Browser run | VERIFIED (local) |  |
| WC-5 | §5 | C: Visit recorded, HR/Admin notified | see workflow | Browser run | VERIFIED (local) |  |
| WC-6 | §5 | C: Checks out | see workflow | Browser run | VERIFIED (local) |  |
| WC-7 | §5 | C: No additional employee approval | see workflow | Browser run, SQL tests | VERIFIED (local) |  |
| WD-1 | §5 | D: Receptionist registers the guest | see workflow | Browser run | VERIFIED (local) |  |
| WD-2 | §5 | D: Records whom the guest meets | see workflow | Browser run | VERIFIED (local) |  |
| WD-3 | §5 | D: Checks in and issues a card | see workflow | Browser run | VERIFIED (local) |  |
| WD-4 | §5 | D: Saved in history as Personal Guest | see workflow | Browser run | VERIFIED (local) |  |
| WE-1 | §5 | E: HR uploads Excel of candidates | see workflow | Browser run (CSV saved; real .xlsx previewed) | VERIFIED (local) |  |
| WE-2 | §5 | E: Imported into Expected Visitors | see workflow | Browser run, SQL tests | VERIFIED (local) |  |
| WE-3 | §5 | E: Receptionist finds and checks in | see workflow | Browser run | VERIFIED (local) |  |
| WE-4 | §5 | E: Card and standard check-out | see workflow | Browser run | VERIFIED (local) |  |
| WF-1 | §5 | F: HR/Admin registers VIP with expected guests | see workflow | Browser run | VERIFIED (local) |  |
| WF-2 | §5 | F: Receptionist verifies actual number | see workflow | Browser run | VERIFIED (local) |  |
| WF-3 | §5 | F: Records name, guests, invited-by, organization | see workflow | Browser run | VERIFIED (local) |  |
| WF-4 | §5 | F: Checks in and issues cards | see workflow | Browser run | VERIFIED (local) |  |
| WG-1 | §5 | Delivery: no check-in, no card | see workflow | Browser run, SQL tests, API probe | VERIFIED (local) |  |
| A-1 | §6.1 | Sidebar: the nine items, in order | components/layout/navigation.ts | Browser run, Unit/component tests | VERIFIED (local) |  |
| A-2 | §6.1 | Dashboard: Total Visitors | getAdminDashboard | Browser run, Unit/component tests | VERIFIED (local) |  |
| A-3 | §6.1 | Dashboard: Expected Today | getAdminDashboard | Browser run, Unit/component tests | VERIFIED (local) | Definition in DEC-P3-7 |
| A-4 | §6.1 | Dashboard: Checked In | getAdminDashboard | Browser run, Unit/component tests | VERIFIED (local) |  |
| A-6 | §6.1 | Dashboard: Completed | getAdminDashboard | Browser run, Unit/component tests | VERIFIED (local) |  |
| A-5 | §6.1 | Dashboard: Pending Approval | admin page shows "—" | Browser run | BLOCKED | No workflow creates approvals. Decision Q1 |
| A-7 | §6.1 | Dashboard: Rejected | admin page shows "—" | Browser run | BLOCKED | Decision Q1 |
| A-8 | §6.1 | Dashboard: activity graphs | ActivityChart | Browser run, Unit/component tests | VERIFIED (local) |  |
| A-9 | §6.1 | Dashboard: visitor timeline | Timeline | Browser run, Unit/component tests | VERIFIED (local) |  |
| A-10 | §6.1 | Visitor Management: manage visitors | list, search, filters, detail, edit | Browser run | VERIFIED (local) |  |
| A-11 | §6.1 | Add expected visitors via modal; name, phone, purpose required | VisitFormModal | Browser run | VERIFIED (local) |  |
| A-12 | §6.1 | Register VIP visits with expected guests | RegisterVipButton | Browser run | VERIFIED (local) |  |
| A-13 | §6.1 | Upload interview candidates via Excel | CandidateImportWizard | Browser run | VERIFIED (local) |  |
| A-14 | §6.1 | Visitor Approval: manage approval records | src/app/admin/approvals (explains; real counts) | Browser run | BLOCKED | No approval records exist. Decision Q1. Not invented |
| A-15 | §6.1 | Visitor History: search past visits, times, card, type | src/app/admin/history | Browser run | VERIFIED (local) |  |
| A-16 | §6.1 | Visitor Cards: register and monitor | src/app/admin/cards | Browser run | VERIFIED (local) |  |
| A-17 | §6.1 | Employee Management; receptionists see only name and team | src/app/admin/employees, employee_directory | Browser run, SQL tests, API probe | VERIFIED (local) |  |
| A-18 | §6.1 | Receptionist Management: accounts and access | src/app/admin/receptionists | Browser run | VERIFIED (local) | Through the local stand-in of the Edge Functions, using their real rule code |
| A-19 | §6.1 | Reports: arrival/departure data and PDF table | src/app/admin/reports, lib/reportPdf.ts | Browser run, Unit/component tests; PDF parsed independently | VERIFIED (local) | Bangla: use Print view; downloaded PDF prints "?" |
| A-20 | §6.1 | Settings: manage application configuration | src/app/admin/settings, app_settings | Browser run, SQL tests | PARTIAL | Built with the settings the app uses. What it must contain is undefined: Q13 |
| P-1 | §6.2 | Web and mobile; Home, Expected Visitors, Add New Visitor | navigation, responsive pages | Browser run at 390, 768, 1440 px | VERIFIED (local) | Responsive web, as CLAUDE.md states. No native app |
| P-2 | §6.2 | Home: Total Visitors Today, Currently Checked In, Checked Out, list | getReceptionHome | Browser run | VERIFIED (local) |  |
| P-3 | §6.2 | Expected: find, verify, check in, record times | src/app/reception/expected | Browser run | VERIFIED (local) |  |
| P-4 | §6.2 | Add New Visitor: mandatory fields; guests and company | WalkInForm | Browser run | VERIFIED (local) |  |
| P-5 | §6.2 | Search and associate host; else confirmed name; no further approval | HostPicker, validateWalkInForm | Browser run, Unit/component tests | VERIFIED (local) | Gap fixed: host was optional |
| P-6 | §6.2 | Dropdown in list, assign, Check-in; Check-out with popup | VisitRowActions | Browser run | VERIFIED (local) |  |
| P-7 | §6.2 | Delivery restriction | see RO-R6 | Browser run, SQL tests, API probe | VERIFIED (local) |  |
| N-1 | §6.3 | Automatically notify HR/Admin on check-in | check_in_visit writes notifications | Browser run, SQL tests | VERIFIED (local) | In-app |
| N-2 | §6.3 | Includes name, phone, invited employee, check-in details | AdminPanels Notifications | Browser run | VERIFIED (local) |  |
| N-3 | §6.3 | WhatsApp or Telegram when integration is available | none |  -  | BLOCKED | No integration or provider exists. Decision Q10. Conditional in the PRD |
| N-4 | §6.3 | Otherwise the Receptionist notifies or calls manually | CheckInOutcome (text, copy, call link), Settings contact | Browser run | VERIFIED (local) |  |
| K-1 | §6.4 | Bulk register by Excel | CardImportWizard | Browser run (CSV saved), Unit/component tests | VERIFIED (local) | Same reader as candidates; real .xlsx proven there |
| K-2 | §6.4 | Add individual cards manually | AddCardButton | Browser run | VERIFIED (local) |  |
| K-3 | §6.4 | Unique Card Number/ID | unique index | Browser run, SQL tests | VERIFIED (local) |  |
| K-4 | §6.4 | Registered cards available to the Receptionist at once | listAvailableCards | Browser run | VERIFIED (local) |  |
| K-5 | §6.4 | View all cards and statuses | src/app/admin/cards | Browser run | VERIFIED (local) |  |
| K-6 | §6.4 | Monitoring: visitor name, Visitor ID, card, check-in time, card status, check-out status, history | src/app/admin/cards | Browser run | VERIFIED (local) | Gap fixed: check-in time and check-out status |
| K-7 | §6.4 | Each card has one status: Available or Issued | card_status, trigger | SQL tests, API probe | VERIFIED (local) |  |
| K-8 | §6.4 | History: card, visitor, issued, returned, status | listCardHistory | Browser run | VERIFIED (local) |  |
| K-9 | §6.4 | Dashboard shows details and card automatically; reflects check-out | AutoRefresh, CurrentlyIn | Browser run, Unit/component tests | VERIFIED (local) | Up to 20 s delay |
| K-10 | §6.4 | No integration with the card machine required | none needed | Review | VERIFIED (local) |  |
| I-1 | §6.5 | HR uploads Excel of candidates | CandidateImportWizard, import_candidates | Browser run, SQL tests, real .xlsx | VERIFIED (local) | Columns confirmed by you (DEC-P3-1) |
| I-2 | §6.5 | Imported into Expected Visitors |  import_candidates | Browser run, SQL tests | VERIFIED (local) |  |
| I-3 | §6.5 | Receptionist finds and checks in | Expected Visitors | Browser run | VERIFIED (local) |  |
| H-1 | §6.6 | Visitor ID, name, phone | visit_overview, history page, visit page | Browser run, Unit/component tests | VERIFIED (local) |  |
| H-2 | §6.6 | Purpose | visit_overview, history page, visit page | Browser run, Unit/component tests | VERIFIED (local) |  |
| H-3 | §6.6 | Number of guests | visit_overview, history page, visit page | Browser run, Unit/component tests | VERIFIED (local) |  |
| H-4 | §6.6 | Invited-by employee | visit_overview, history page, visit page | Browser run, Unit/component tests | VERIFIED (local) | Gap fixed: name was lost when the host was deactivated |
| H-5 | §6.6 | Company or organization | visit_overview, history page, visit page | Browser run, Unit/component tests | VERIFIED (local) |  |
| H-6 | §6.6 | Check-in and check-out times | visit_overview, history page, visit page | Browser run, Unit/component tests | VERIFIED (local) |  |
| H-7 | §6.6 | Card number with issued and returned times | visit_overview, history page, visit page | Browser run, Unit/component tests | VERIFIED (local) |  |
| H-8 | §6.6 | Visitor type | visit_overview, history page, visit page | Browser run, Unit/component tests | VERIFIED (local) |  |
| S-1 | §7 | Employees register without HR/Admin approval | register_visit | Browser run, SQL tests | VERIFIED (local) |  |
| S-2 | §7 | Unscheduled visitors need no more employee approval | register_visit, check_in_visit | Browser run, SQL tests | VERIFIED (local) |  |
| S-3 | §7 | Access restricted by role | proxy, requireRole, action checks, RLS | Browser run, API probe, SQL tests, Unit/component tests | VERIFIED (local) |  |
| S-4 | §7 | Receptionists see only employee names and teams | employee_directory, employee_names, visit_overview | SQL tests, API probe, Browser run | VERIFIED (local) |  |
| S-5 | §7 | Delivery not allowed; not checked in | see RO-R6 | Browser run, SQL tests, API probe | VERIFIED (local) |  |
| S-6 | §7 | Checked out only after the card return is confirmed | check_out_visit | Browser run, SQL tests, API probe | VERIFIED (local) |  |
| S-7 | §7 | Cards managed only by HR/Admin; unique number | RLS, grants | SQL tests, API probe | VERIFIED (local) |  |
| T-1 | §8 | Web frontend: React, TypeScript (Vite replaced by Next.js, approved) | frontend | Build | VERIFIED (local) | Approved deviation, DEC-011 |
| T-2 | §8 | Supabase PostgreSQL, Auth | migrations, @supabase/ssr | SQL tests; hosted sign-in seen in the dev log | IMPLEMENTED, NOT VERIFIED | Local stand-in of Auth. Your real Admin sign-in was seen working; the rest has not run on Supabase |
| T-3 | §8 | Authorization by roles and database policies | RLS | SQL tests, API probe | VERIFIED (local) |  |
| T-4 | §8 | Notification integration | in-app only | Browser run | BLOCKED | See N-3 |
| X-1 | §- | Invitation email and setting a password (agreed account rule) | src/app/auth/confirm, accept, set-password; Edge Functions | Browser run with stand-in; no email sent | IMPLEMENTED, NOT VERIFIED | Gap fixed. Real email, Supabase link format and Edge Functions on Supabase not run |
| X-2 | §- | Public self-registration disabled on the hosted project | dashboard setting; no sign-up code; config.toml | check:supabase | BLOCKED | Hosted setting was ON at the last check. You must change it |
| X-3 | §- | Phase 2 and 3 behaviour on the hosted project | All 7 migrations are applied (found 2026-11-04) | verify_remote.sql 20/20 on hosted; no behaviour run yet | IMPLEMENTED, NOT VERIFIED | Structure verified on hosted. Behaviour needs the test data: see TEST_DATA_GUIDE.md |

## UI Design System Compliance

Checked against `docs/UI_DESIGN_SYSTEM.md` (read in full) and the reference image.

**Screens inspected in a real browser, each at 1440, 768 and 390 px (57 page and width combinations):** HR/Admin Dashboard, Visitor Management, candidate upload, Visitor Approval, Visitor History, Visitor Cards, card upload, Employee Management, employee import, Receptionist Management, Reports, Print view, Settings; Receptionist Home, Expected Visitors, Add New Visitor; Employee Dashboard, My Visitors, Add New Visitor. Also viewed at one width each: Login, visit details, employee details, set password, check-in and check-out dialogs, validation errors. I looked at a sample of the screenshots, and measured the rest by script: page overflow, tables that scroll sideways, text contrast from computed styles, small targets, unlabelled controls, browser errors.

**Requirements checked.** Colours are enforced by `lib/designTokens.test.ts`, which reads the shipped CSS.

| Design system | Result |
|---|---|
| Primary `#2C1971`, hover `#45239B`, secondary `#7A67AF`, lavender `#DFDDF7`, background `#F3F2FD`, surface `#FFFFFF`, text `#171329`, success, warning, danger, info | Exact tokens, tested |
| Sidebar deep purple, white icons and labels, obvious active item | Done |
| Primary deep purple; secondary white with purple border and text | Done (fixed) |
| Status: Expected warning; Issued and Checked In purple; Available and Checked Out success; never colour alone | Done (fixed), badges carry text and a dot |
| No new palette | Done. The one foreign colour, a teal chart series, was removed. No hard-coded colours in app or component files |
| Visible labels, inline errors, purple focus | Done |
| Exact check-out wording | Done, tested |
| Loading, empty, error, success states | Done, tested per page |

**Colour inconsistencies fixed:** secondary buttons were grey with dark text; Expected was purple and Checked In green, opposite to the design system; Issued was orange; danger button used a non-token red; teal chart series; sidebar labels lavender instead of white.

**Contrast found and fixed (smallest change, official colours kept):**

| Combination | Measured | Change |
|---|---|---|
| Field edge `#CFCBEA` on white | 1.5:1 (needs 3:1) | New token `control-border` `#8C83BB`, still lavender. Soft lavender stays for card borders |
| Switch when off | 1.5:1 | Same token |
| Keyboard focus ring (primary) on the purple sidebar | Invisible | White ring in the sidebar |
| Active item fill `#6B4FC7` against the sidebar | 2.4:1 | Added a white bar and bold text, so the state does not rest on the fill |

**Official colours that fail for small text, kept as documented exceptions:** `#77738C` is 4.1:1 on the background, so muted text uses `#5E5D7A` and `#77738C` is used for placeholders on white. `#16A36A`, `#F59E0B` and `#2563EB` as small text fail or are marginal, so badges use darker shades of the same hue on a pale tint. The final sweep found no real text below 4.5:1. Its single hit (the date in the header) is a false positive: the script cannot read Tailwind's translucent `oklab()` background, and the text is dark on white.

**Responsive issues found and fixed:** words split mid-word in tables at phone and tablet width; Check out clipped at 768 px on Receptionist Home; sideways scrolling on History, Cards, Employees and Reports at 390 px; three small tiles leaving a gap on tablets. Final sweep: no page overflow; only the Print view's table scrolls sideways on small screens, on screen only, by design. No browser errors.

**Accessibility fixed:** unnamed file inputs; link targets under 24 px.

**Remaining visual limitations:** no automated tool such as axe was run; no real phone or screen reader; the filters wrap to a second line on some widths; on narrower screens some history columns move to the visit's own page; the header has no search or bell from the reference image, and login has no illustration or Google button, because the PRD does not ask for them.
