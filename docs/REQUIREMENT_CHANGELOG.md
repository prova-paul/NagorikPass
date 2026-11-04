# NagorikPass — Requirement Changelog and Implementation Audit

**Status:** Draft for approval. No application code, migration, dependency or test has been changed.
**Date:** 2026-11-04
**Compares:** `Project_Guide.md` (v1, tracked at commit `6228c87`) against `docs/NagorikPass_PRD.pdf` (updated PRD, 9 pages), then audits the code at `6228c87` against the updated PRD.

Also read: `CLAUDE.md`, `docs/PRD.md` (untracked, derived from the PDF), the other `docs/*.md` files, `backend/` and `frontend/` source and migrations, `README.md`, and the design image `design_resources/NagorikPass Visitor Management Showcase-1.png`.

---

## 1. Read this first

1. **The updated PRD removes the approval model the code is built around.** v1 required HR/Admin approval before every check-in, plus host approval for walk-ins and HR approval of employee requests. The PRD says employees register visitors with no HR approval and unscheduled visitors need no further approval. The approval services, routes and email templates, five frontend pages (`ApprovalResponsePage`, `HostApprovalsPage`, `MyHostDecision`, and the receptionist and admin approvals pages) and about 48 of the 99 `api.test.ts` and `workflows.test.ts` cases (by name match) exist only for the old rules.
2. **Visitor cards, the heart of the new check-in and check-out, do not exist at all.** There is no table, API, page or test for cards, card history, delivery restriction, visitor categories, number of guests, Invited By, Excel import, VIP or group visits.
3. **The PRD and `CLAUDE.md` name Supabase** (PostgreSQL, Supabase Auth, RLS policies). The whole backend is Express with a custom session table and authorization in application code. This is the one large architectural decision, and I have not acted on it (Decision D1).
4. **Source documents disagree in four places** (Section 2), including what the *Visitor Approval* module is for now that nothing needs approval (D3).
5. **The `vms-guard` Skill and the test hook are gone.** You removed the `.claude/` folder, so neither runs and nothing needs updating. Older sections below that mention them describe what existed earlier today.

---

## 2. Source authority and document discrepancies

`CLAUDE.md` says `docs/PRD.md` is the source of truth. That file was written *from* the PDF, and it differs from it in the places below. I have not edited `docs/PRD.md`; it is marked "preserve as baseline".

| # | Topic | PDF (`NagorikPass_PRD.pdf`) | `docs/PRD.md` | Code today | How I read it |
|---|---|---|---|---|---|
| S1 | Admin dashboard tiles | §6.1 lists **Rejected** | §9.1 omits it | Has `rejectedVisits` | PDF is later and more complete. Keep Rejected. Confirm (D3 decides whether anything can still be rejected). |
| S2 | HR/Admin and employee-initiated visitors | §3: HR/Admin "**Adds** employee-initiated visitors to the expected visitor list" | "**Monitor** employee-initiated visitors" | Employee requests wait for HR approval | Workflow B and §7 say the system adds them with no approval, so HR monitors. §3 wording looks like leftover text. Confirm. |
| S3 | Receptionist mobile | §3, §8: "web **and mobile application**" | "responsive web unless a native app is later approved" | Responsive web only | Treated as responsive web for now. Confirm (D8). |
| S4 | Source file name | PDF | Says it came from `NagorikPass_PRD_Updated.docx` | n/a | Confirm the two have identical content. |
| S5 | Design palette | Image only | `UI_DESIGN_SYSTEM.md`: sidebar `#2C1971` | Navy sidebar `#11112f`, primary `#6c4ed0` | Image sampled below. The docs palette is close to the image; the code is not. |
| S6 | `Project_Guide.md` v1 vs PRD | Many rules reversed | n/a | Code follows v1 | v1 is superseded where Section 3 says so. |

`Project_Guide.md` and `project_guide.md` are the same file on this case-insensitive disk. I kept the tracked name `Project_Guide.md`.

---

## 3. Requirement comparison

References: **G§** is `Project_Guide.md` v1, **P§** is the updated PRD.

### 3.1 Unchanged

| Requirement | Old | New |
|---|---|---|
| Three roles: HR/Admin, Receptionist, Employee | G§3 | P§3 |
| HR/Admin manages employees, receptionists and visitors, and pre-registers visitors | G§3–4 | P§3, §6.1 |
| Pre-registered visitors appear in the Receptionist's Expected Visitors | G§7 | Workflow A |
| Receptionist views expected visitors, registers unscheduled visitors, checks in and out | G§5 | P§3, §6.2 |
| Access restricted by role and enforced on the server, not only in the UI | G§10, §16 | P§7, §8 |
| Receptionists must not see private employee information | G§3, §12 | P§7 (now narrower, see M5) |
| Scheduled and actual times are stored separately | G§13 | P§4 |
| Dashboard tiles: Total, Expected Today, Checked In, Pending Approval, Completed, Rejected | G§4 | P§6.1 (PDF) |
| Visitor history with search; reports with arrival/departure data and a PDF table | G§4, §14 | P§6.1, §6.6 |
| Employee records separate from login accounts | G§3 | P§8 (Supabase Auth plus employee directory) |
| Never hardcode secrets; ask before deleting | G§15–16 | `CLAUDE.md` §7 |

### 3.2 Modified

| # | Old | New |
|---|---|---|
| M1 | **No visitor enters without HR/Admin approval of that entry**, every time (G§3, §10) | Check-in needs only an eligible visitor, an **Available card**, and a non-delivery category (P§5). No approval step. |
| M2 | Employee submits a **request** → HR approves → expected → entry approval on arrival (G§8) | Employee registers the visitor **directly**. It goes straight to Expected Visitors and HR records. No approval (Workflow B, P§7). |
| M3 | Walk-in: host approves by emailed link → HR gives final approval → check-in (G§9) | Receptionist registers, searches for the employee, checks in. **No further approval** (Workflow C). Host not found → contact HR/Admin, type the confirmed name in **Invited By**. |
| M4 | Employee approves or rejects walk-ins addressed to them (G§6) | Employee registers and coordinates their visitors and is notified at check-in. No host-approval duty. |
| M5 | Receptionist sees employee ID, name, department, designation (G§12) | Receptionist sees **name and team only** (P§7, `CLAUDE.md` §6). |
| M6 | Check-in: verify identity, then approved | Also **select an Available card**; card becomes Issued; HR dashboard shows the card (P§5). |
| M7 | Check-out is one click | Popup **"Did you get the visitor card back?"** Yes completes check-out and frees the card. **No** leaves the visitor Checked In and the card Issued (P§5). |
| M8 | Emails: approval requests to hosts, review requests to HR, decision to employee, arrival to **hosts**, invitation to visitor | **HR/Admin notified on check-in** (name, phone, invited employee, check-in details); **registering employee also** for employee-initiated visitors; WhatsApp/Telegram if available, otherwise manual call (P§6.3). |
| M9 | Company mandatory; visitor email mandatory when pre-registering; at least one host mandatory | **Mandatory: name, phone, purpose.** Additional: number of guests, invited by, company. A **category** must be recorded (P§4, §4.1, `CLAUDE.md` §6). |
| M10 | "Meeting With": one or more selected employees (G§12) | **Invited By**: one employee, or a typed name when the employee is not found (Workflow C). |
| M11 | Backend "suggested": Node/Express, PostgreSQL, session or token auth (G§15) | **Stated:** Supabase platform, Supabase PostgreSQL, Supabase Auth, RLS and database policies (P§8). |
| M12 | Dark **navy** sidebar, `#7560E8` accent (G§2) | **Royal purple, lavender, white** (design image). |
| M13 | Receptionist nav: Dashboard, Expected, Add Unexpected, Pending Approvals, Checked-in, History | Home, Expected Visitors, Add New Visitor (P§6.2). A checked-in list is still implied (P§5 check-out step 4). |
| M14 | Ten visit statuses with separate approval stages (G§11) | PRD names only Expected, Checked In, Checked Out (plus Pending Approval and Rejected on the dashboard). Vocabulary unresolved (D3, D9). |
| M15 | Receptionist tiles: Expected Today, Checked-in, Pending Approvals, Completed Today | **Total Visitors Today, Currently Checked In, Checked Out**, today's list (P§6.2). |
| M16 | History shows visit, status, times | Adds **card number with issued/returned times, visitor type, guests, invited-by, company** (P§6.6). |
| M17 | Employee nav: Dashboard, Submit Request, My Requests, Approvals | Dashboard, **Add New Visitor, My Visitors** (Upcoming/Past in the image). No approvals. |

### 3.3 Newly added

| # | Requirement | PRD |
|---|---|---|
| N1 | **Visitor cards:** register manually or by bulk Excel; unique Card Number; status Available or Issued; HR monitors status and history; cards appear for the Receptionist | §6.4 |
| N2 | **Card assignment history** with issued and returned date and time, kept permanently | §5, §6.4 |
| N3 | **Visitor categories** (8) with a **delivery restriction**: never checked in, never issued a card | §4, §5 |
| N4 | **Number of guests** and **Invited By** | §4.1 |
| N5 | **Interview candidate Excel import** into Expected Visitors | Workflow E, §6.5 |
| N6 | **VIP visits and groups** with expected and actual guest counts | Workflow F |
| N7 | **Personal Guest** flow (category plus Invited By plus card) | Workflow D |
| N8 | HR/Admin dashboard shows assigned card and visitor details; **visitor timeline** | §5, §6.1 |
| N9 | **WhatsApp/Telegram** notification, conditional on availability | §6.3 |
| N10 | **Supabase** platform and **database policies** (RLS) | §8 |
| N11 | Receptionist on **mobile** | §3, §6.2, §8 |

### 3.4 Removed or superseded

| # | Old requirement | Why |
|---|---|---|
| R1 | Host approval through an emailed single-use link, and in-app host decision | P§7: no additional employee approval |
| R2 | HR/Admin final approval of walk-ins | Workflow C |
| R3 | **Entry approval** requested by reception and decided by HR/Admin | Workflow A, B |
| R4 | HR/Admin approval of employee requests | Workflow B, P§7 |
| R5 | "Employees cannot approve their own requests" | No approval exists to self-approve |
| R6 | Settings for host approval rule (`any` or `all`) and link expiry | Nothing to configure |
| R7 | "Every workflow ends with HR/Admin approval before check-in" (G§10) | Reversed by M1 |

**Not removed yet:** the PRD still lists a **Visitor Approval** page, a **Pending Approval** tile and a **Rejected** tile, but defines no flow that creates approvals. Until D3 is answered, I recommend leaving the existing approval code in place and unreachable from the new flows rather than deleting it.

---

## 4. Implementation audit

Counts come from reading the code, not guesses. Baseline from earlier in this session, with the code unchanged since: backend typecheck, lint, build and 307 tests pass; frontend typecheck, lint, build and 26 tests pass.

**Key:** **Keep** = already correct. **Modify** = works, but differs from the PRD. **Partial** = some of it exists. **Missing** = not implemented. **Obsolete** = no longer required.

### 4.1 Workflows and rules

| Feature | PRD | Status | Evidence and plan |
|---|---|---|---|
| Pre-register (HR/Admin) | Workflow A | **Modify** | `preRegister` works. Requires visitor email and company, and one or more hosts. Needs category, guests, Invited By; email, company optional (D6). |
| Employee-initiated visitor, no approval | Workflow B | **Modify** | `submitEmployeeRequest` creates `pending_employee_request` and emails HR. Must create an expected visit directly. Employee page set is named "requests". |
| Unscheduled visitor, no approval | Workflow C | **Modify** | `registerWalkIn` issues approval tokens and waits for hosts. Must become check-in-ready; add Invited By fallback. |
| Personal Guest | Workflow D | **Missing** | No categories. Falls out of N3. |
| Interview candidate import | Workflow E | **Missing** | No Excel parsing and no spreadsheet dependency. |
| VIP and group | Workflow F | **Missing** | No guest count. Model undecided (D5). |
| Check-in | §5 | **Partial** | `checkIn` is atomic and requires `identityVerified`. No card, no delivery block. Gate is `status = 'approved'`. |
| Check-out with card return | §5 | **Missing** | `checkOut` has no confirmation and no card. Popup is a plain confirm dialog. |
| Delivery restriction | §5 | **Missing** | No category. Must be enforced in the database. |
| Visitor cards and history | §6.4 | **Missing** | No tables, routes, pages or tests. |
| Host approval, admin approval, entry approval | removed | **Obsolete** | `approvals` table, `/public/approvals/:token`, `/visits/:id/decision`, `host-decision`, `request-entry`, `resend-approvals`, approval emails, `ApprovalResponsePage`, `HostApprovalsPage`, `MyHostDecision`, receptionist `PendingApprovalsPage`, admin `ApprovalsPage`. Hold until D3. |
| Cancel visit | not in PRD | **Keep** | `cancelVisit` works. PRD silent; keep unless told otherwise (D9). |
| Same-day-only check-in | not in PRD | **Keep** | Existing rule. PRD silent (D9). |
| Identity verified flag | Workflow A, B "verifies identity" | **Keep** | Matches the PRD wording. |

### 4.2 Roles, privacy and access

| Feature | Status | Evidence and plan |
|---|---|---|
| Three roles and server-side guards | **Keep** (mechanism differs) | `requireRole` on every route plus the permission matrix test. If D1 = Supabase, becomes RLS. |
| Receptionist sees no official email or phone | **Keep** | Explicit column lists; tested. |
| Receptionist sees name and team only | **Modify** | `GET /hosts` and visit `hosts` return `employeeId` and `designation` too. `HostPicker` shows both. Tests assert the exact key list. "Team" is assumed to be `department` (D7). |
| Employee sees only own visitors | **Keep** | `viewerScope` limits employees to visits they requested or host. Needs to follow "invited by" instead of "host". |
| Login accounts for employees and receptionists | **Keep** | `/users`, Receptionist Management page. |
| Authentication | **Keep** (mechanism differs) | Custom sessions, rate limit, forced password change. Replaced if D1 = Supabase. |
| Database authorization (RLS) | **Missing** | None. Authorization lives in Express. |

### 4.3 Screens

| Screen | Status | Notes |
|---|---|---|
| Login | **Keep** | Restyle only. The image shows Google sign-in, which the PRD does not ask for. |
| HR/Admin Dashboard | **Partial** | Tiles match the PDF, with charts and an activity calendar. No visitor timeline (N8). Must show assigned cards. |
| Visitor Management / Add visitor | **Modify** | New fields, category, guests, VIP, Excel upload. |
| Visitor Approval | **Hold** | See D3. |
| Visitor History | **Modify** | Add card, category, guests, invited-by columns. Search and CSV export are kept. |
| Visitor Cards | **Missing** | Entire page. |
| Employee Management | **Keep** | Matches; PRD wants Receptionists to see name and team only. |
| Receptionist Management | **Keep** | |
| Reports | **Keep** | PDF, plus DOCX and CSV that the PRD does not request. Keep, flag only. |
| Settings | **Modify** | Remove approval rule and link expiry (after D3). Email toggles change meaning. |
| Receptionist Home / Expected / Add New Visitor | **Modify** | New tiles, card dropdown, Invited By, mobile checks. |
| Checked-in list | **Keep** | PRD step 4 implies it stays. |
| Receptionist Visitor History | **Keep** | Not in the PRD nav. Confirm (D9). |
| Employee Dashboard, Add Visitor, My Visitors | **Modify** | Pages exist as "requests"; rework, drop approvals page. |
| Responsive layout | **Partial** | `DashboardLayout` has a mobile drawer and a viewport tag. Receptionist check-in on a phone has **not** been tested. |
| In-app notifications bell | **Missing** | In the image only. The PRD asks for notifications, not a bell. Not planned without approval. |

### 4.4 Platform, data and tooling

| Area | Status | Notes |
|---|---|---|
| Frontend: React, TypeScript, Vite, Tailwind | **Keep** | Matches. Extra libraries (TanStack Query, lucide) are not in the PRD but harmless. |
| Backend: Supabase | **Missing** | See D1. |
| Visitor / visit model | **Keep** | `visitors` (person) and `visits` (occurrence) already match the proposed schema in `DATABASE_SCHEMA.md`. |
| `visit_hosts` many-to-many | **Modify** | PRD has one Invited By. Keep the table, or collapse (D4). |
| Audit log and visit activity log | **Keep** | Not in the PRD; supports "traceable". |
| Email transport (SMTP, mailbox, console) | **Keep** | Reusable for HR check-in alerts. Content changes. |
| WhatsApp/Telegram | **Missing** | Provider unresolved (D8). |
| Excel parsing | **Missing** | Needs a new dependency and approval. |
| Tests | **Modify** | See 4.5. |

### 4.5 Test impact

125 backend test cases across five files (307 including table-driven cases) plus 26 frontend tests.

- **Mostly obsolete:** `workflows.test.ts` (26 cases) and the approval-link, token-security and check-in sections of `api.test.ts`. By name match, about 48 of the 99 cases in those two files concern approvals, hosts, tokens, requests or walk-ins. They must be rewritten to the new rules, not deleted.
- **Needs edits:** `permissions.test.ts` (route list changes), the exact-keys privacy test (name and team only).
- **Keep as is:** `auth.test.ts`, `email.test.ts`, report and settings sections, and the frontend unit tests for timing, calendar, chart and report filters.

---

## 5. Proposed changes (not applied)

### 5.1 Database (a forward migration, never editing an applied one)

Adds to the existing schema; sketch only.

- `visits` (per occurrence, like the existing `purpose`, because one person can return as a candidate, then a vendor): `category` (8 values), `guest_count` (default 1), `invited_by_employee_id` (nullable), `invited_by_name` (text, for "employee not found"); `type` gains `import`; expected and actual guest counts for VIP and group (D5).
- `visitors`: `company` becomes nullable (D6).
- `visitor_cards`: `card_number` unique, `status` `available` or `issued`.
- `visitor_card_assignments`: `card_id`, `visit_id`, `issued_at`, `returned_at`, `issued_by`, `returned_by`; **one open assignment per card** (partial unique index) and **one open assignment per visit**.
- Check-in and check-out as **atomic database functions** that lock the card, reject Delivery/Courier, and refuse card return = No.
- CHECK or trigger: a Delivery/Courier visit can never reach Checked In or hold a card.
- Excel import batches table (only if D6 asks for an error report).
- Approval objects stay until D3. Then drop or archive.

### 5.2 Backend

Replace the approval workflow in `visits.ts`, `approvals.ts` and `routes/visits.ts` with direct registration and card-aware check-in and check-out. Narrow the host directory to name and team. Retarget `sendArrivalNotices` to HR/Admin (and the registering employee). Add card, import and category endpoints. If D1 = Supabase, these become RLS policies, database functions and Edge Functions instead.

### 5.3 Frontend

Restyle tokens (below). Rebuild the three role navigations, add Visitor Cards, add card dropdown and return-confirmation to the receptionist list, add category, guests and Invited By to the forms, add Excel upload dialogs, and rework the employee pages.

### 5.4 Design tokens (from the image)

Sampled from the reference image:

| Role | Image | Code today | `UI_DESIGN_SYSTEM.md` |
|---|---|---|---|
| Sidebar | `#2a1874`–`#301b79` | `navy-950` `#11112f` | `#2C1971` |
| Primary button | `#441ab3`–`#4f23b7` | `primary-500` `#6c4ed0` | `#2C1971` / `#45239B` hover |
| Active nav item | `#8363d6` | `primary-500` | not specified |
| Page background | `#faf9fd`–`#f3f2fd` | `canvas` `#f3f2f9` | `#F3F2FD` |

The tokens live in `frontend/src/index.css`, so the restyle is mostly a token change plus the sidebar classes in `DashboardLayout`. Elements in the image that the PRD does **not** ask for, and that I will not build without approval: Google sign-in, **Print Card**, the card-punching illustration (the PRD says that integration is out of scope), and the notification bell.

### 5.5 New dependencies (need approval)

- An Excel reader, such as `exceljs` or SheetJS, for card and candidate import.
- `@supabase/supabase-js` only if D1 = Supabase.

### 5.6 Validation constraint

The Supabase CLI and Docker are not installed on this machine, and there are no Supabase credentials in the repository. RLS therefore **cannot be tested here** until you either approve installing them or give me a hosted test project. Plain constraints and database functions can be tested against the existing local Postgres test database.

---

## 6. Decisions I need from you

Full log with status fields: `docs/DECISIONS_AND_OPEN_QUESTIONS.md`.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | **Backend platform** | **A** Migrate to Supabase (Auth, RLS, database functions, Edge Functions). **B** Keep Express and PostgreSQL, amend the PRD. **C** Implement the PRD rules on Express first, written as portable SQL, then migrate. | **A**, staged like C: put the rules in SQL constraints and functions first, since they are needed either way. The PRD and `CLAUDE.md` both name Supabase and RLS, so B silently drops a stated requirement. Cost: A discards the Express routes, services and about 125 tests for rewriting. If Supabase is not mandatory, choose B. |
| **D2** | Which document is canonical, the PDF or `docs/PRD.md`? | PDF / sync PRD.md to the PDF | The PDF; let me sync `docs/PRD.md` (restore the Rejected tile, fix S2, S3). |
| **D3** | What does **Visitor Approval** do now? | Remove / keep for a defined case / repurpose as a visitor review list | Ask the PRD owner. Until answered: keep the code, hide it from new flows, keep the Pending and Rejected tiles at zero-capable. |
| **D4** | One host or many? | One Invited By / keep `visit_hosts` | One employee plus the typed fallback. Keep the table for now, since removing it is the riskier change. |
| **D5** | VIP and group model | One record with a guest count / one record per attendee, each with a card | Per attendee when cards are needed, because every person needs a card. Needs your call. |
| **D6** | Optional fields and Excel rules | Email and company optional? Card and candidate import columns, duplicates, bad rows, all-or-nothing? | Optional email and company. Partial import with a downloadable error report. Send me sample files. |
| **D7** | "Team" | `department` / new teams table | `department`, which already exists. |
| **D8** | Notifications and mobile | WhatsApp or Telegram, provider; PWA or native receptionist app | Email now, which exists; one chat provider later; responsive web now. |
| **D9** | Statuses and extras | Keep cancel, same-day-only check-in, receptionist history, DOCX and CSV exports | Keep all; they are working and not forbidden. |
| **D10** | The `vms-guard` Skill and test hook | Removed by you (`.claude/` no longer exists) | None. |

---

## 7. Phases and gates

Detailed in `docs/IMPLEMENTATION_PLAN.md`. Summary:

1. **Phase 0 (this document):** audit and documentation. Gate: you approve scope and D1–D9.
2. **Phase 1:** data design. Gate: you approve the migration before it is written.
3. **Phase 2:** design tokens and navigation. Gate: you approve the visual result against the image.
4. **Phase 3:** cards and the new check-in and check-out. Gate: demo of Workflows A–F and the delivery block.
5. **Phase 4:** employee direct registration, unscheduled flow, Invited By.
6. **Phase 5:** Excel imports, VIP and group.
7. **Phase 6:** notifications, reports, history columns.
8. **Phase 7:** retire the approval code per D3, update tests, security and responsive checks.

**Skill and hook:** removed by you on 2026-11-04 (the `.claude/` folder no longer exists), so no phase touches them.

---

## 8. What this deliverable changed

- Created this file.
- Updated `Project_Guide.md` (tracked, so the v1 text is recoverable with `git diff` or `git show HEAD:Project_Guide.md`).
- Added sections to `docs/DECISIONS_AND_OPEN_QUESTIONS.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/DATABASE_SCHEMA.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/UI_DESIGN_SYSTEM.md` and `docs/TESTING_STRATEGY.md`, without removing their existing text.
- Earlier today I made three small edits to the `vms-guard` Skill after the guide rewrite broke its drift check. The Skill and the test hook have since been removed by you along with `.claude/`.
- Did **not** touch `docs/PRD.md`, `docs/API_DOCUMENTATION.md`, `CLAUDE.md`, `README.md`, any application code, migration, dependency or the test hook.
