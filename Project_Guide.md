# NagorikPass — Project Guide

> **Updated 2026-11-04** for the updated PRD (`docs/NagorikPass_PRD.pdf`). What changed from v1, and why, is in `docs/REQUIREMENT_CHANGELOG.md`. The v1 text is in git: `git show HEAD:Project_Guide.md`.
>
> This guide summarizes. If it conflicts with the PRD, the PRD wins: report the conflict, do not choose silently. Items marked **[Pending Dn]** wait for a decision listed in `docs/DECISIONS_AND_OPEN_QUESTIONS.md`.
>
> **Status of the code:** the application still follows v1 (HR/Admin approval gates, no visitor cards). Sections 7–12 describe the *required* behavior. `docs/REQUIREMENT_CHANGELOG.md` section 4 lists what is built and what is not.

## 1. Project Overview

**Project name:** NagorikPass  
**Tagline:** Smart Visitor Management. Seamless Workplace Access.

NagorikPass is a browser-based Visitor Management System. It replaces manual visitor logs with one place for visitor registration, expected visitors, check-in and check-out, visitor cards, notifications, dashboards, history and reports, with role-based access that protects employee information. HR/Admin, Receptionists and Employees each have their own area.

## 2. Design Reference

The primary visual reference is `design_resources/NagorikPass Visitor Management Showcase-1.png`. Inspect it before changing UI. Use it for color, layout, spacing and feel only. Never copy its sample names, dates, numbers or notifications as real data.

Direction: **royal purple, lavender and white.** Deep purple sidebar, white cards and tables on a very light lavender background, rounded controls, clear status colors, clean dashboard charts.

Colors sampled from the image (approximate):

| Use | Value |
|---|---|
| Sidebar | `#2a1874` to `#301b79` |
| Primary buttons | `#441ab3` to `#4f23b7` |
| Active navigation item | `#8363d6` |
| Page background | `#faf9fd` to `#f3f2fd` |
| Cards | white |

Success is green, warning orange, danger red. Never rely on color alone: use text or an icon. Design tokens live in `frontend/src/index.css`; the restyle from the v1 navy palette is planned in Phase 2.

The image also shows things the PRD does **not** ask for: Google sign-in, a Print Card button, a card-punching machine illustration (the PRD says that integration is out of scope), and a notification bell. Do not build these without approval.

The v1 reference to NagorikEats's warm cream palette still applies: do not use it.

## 3. User Roles and Permissions

There are exactly three login roles. Employee records stay separate from login accounts; employees may have an account.

### HR/Admin
- Manage employees, receptionists and visitor records.
- Register expected visitors in advance.
- Monitor the dashboard, visitor history and reports.
- Receive a notification when a visitor checks in.
- Monitor visitors that employees register (they appear without approval).
- Register visitor cards, manually or by bulk Excel upload; monitor card status and assignment history.
- Upload interview candidate lists by Excel; register VIP visits and groups.

### Receptionist
- View expected visitors; register unscheduled visitors.
- Search for the employee a visitor wants to meet.
- Check visitors in and out; manage visitor information on web and mobile.
- Assign an Available visitor card at check-in; confirm its return at check-out.
- **Must not check in delivery personnel.**
- Sees employee **name and team only**. Never receives an employee's official email, phone or other private information through the UI or API.

### Employee
- Register their own visitors directly, **without HR/Admin approval**.
- Provide visitor information before the visit and coordinate their invited visitors.
- See only their own visitors.
- Is notified when a visitor they registered checks in.

Employees cannot perform HR/Admin or Receptionist actions.

## 4. HR/Admin Features

Navigation: Dashboard, Visitor Management, Visitor Approval **[Pending D3]**, Visitor History, Visitor Cards, Employee Management, Receptionist Management, Reports, Settings.

Dashboard: Total Visitors, Expected Today, Checked In, Pending Approval, Completed, Rejected, activity graphs, and a visitor timeline. The dashboard also shows each checked-in visitor's assigned card. All figures come from real visit data, never hardcoded values. (The Rejected tile is in the PDF but not in `docs/PRD.md`; see REQUIREMENT_CHANGELOG S1.)

Visitor Management: manage visitors; add expected visitors in a modal (name, phone and purpose required); register VIP visits with an expected number of guests; upload interview candidates by Excel.

Visitor History: search past visits with check-in and check-out details, the card issued and returned, and the visitor type.

Visitor Cards: register cards manually or by Excel; see status and assignment history.

Employee Management: manage employees. Receptionist Management: manage receptionist accounts and access. Reports: arrival and departure data and a PDF report table. Settings: application configuration.

## 5. Receptionist Features

Navigation: Home, Expected Visitors, Add New Visitor (plus a Checked-in list, which check-out needs).

Home: Total Visitors Today, Currently Checked In, Checked Out, and today's visitor list.

Expected Visitors: find and verify pre-registered visitors, check them in and record timestamps.

Add New Visitor: required name, phone and purpose; additional number of guests and company; search for and associate the host employee. If the host is not found, contact HR/Admin and enter the confirmed employee in **Invited By**. No additional approval.

## 6. Employee Features

- Dashboard.
- **Add New Visitor:** enter the visitor's information and visit details; the visitor goes straight to Expected Visitors and the HR/Admin records.
- **My Visitors:** upcoming and past visitors, with status.

## 7. Standard Check-In and Check-Out (every workflow)

### Check-in
1. The Receptionist registers the visitor or finds them in the system.
2. The Receptionist verifies the visitor's identity.
3. The Receptionist selects an **Available** card from the visitor list and clicks Check-in.
4. The system links the card to the visit, records the check-in time and changes the card from Available to **Issued**.
5. The assigned card and visitor details appear on the HR/Admin dashboard, and HR/Admin is notified.

### Check-out
1. The visitor returns the card to the Receptionist, who clicks Check-out.
2. The system asks: **"Did you get the visitor card back?"**
3. **Yes:** record the check-out time, set the visit to Checked Out, change the card from Issued to Available, update the HR/Admin dashboard.
4. **No:** check-out stays incomplete. The visitor remains Checked In, the card remains Issued and linked, and the card must be recovered first.
5. Every assignment and return is kept in the card history with issue and return date and time.

## 8. Visitor Workflows

All workflows end with the standard check-in and check-out above.

- **A — HR/Admin pre-registers:** HR/Admin registers the visitor; they appear in Expected Visitors; the Receptionist verifies and checks them in; HR/Admin is notified.
- **B — Employee-initiated:** the employee adds the visitor; they appear in Expected Visitors and the HR/Admin dashboard and records; no approval; on check-in **both the employee and HR/Admin** are notified.
- **C — Unscheduled:** the Receptionist registers the visitor and searches for the employee; if not found, contacts HR/Admin and records the confirmed employee in Invited By; checks the visitor in; HR/Admin is notified. No further employee approval.
- **D — Personal guest:** the Receptionist registers the guest, records whom they meet (Invited By), checks them in and issues a card. Saved with type Personal Guest.
- **E — Interview candidate:** HR uploads an Excel sheet; candidates appear in Expected Visitors; the Receptionist checks them in and issues a card. **[Pending D6]** for the Excel format.
- **F — VIP and groups:** HR/Admin registers the VIP visit with the expected number of guests; the Receptionist verifies the actual number; the system records name, guest count, invited-by employee and organization; cards are issued per the standard procedure. **[Pending D5]**
- **Delivery personnel:** not permitted to enter. Never checked in, never given a card.

## 9. Business Rules

- Mandatory: visitor **name, phone, purpose**. A visitor **category** must be recorded. Additional: number of guests, invited by, company.
- Employee-registered visitors need **no** HR/Admin approval. Unscheduled visitors need **no** further employee approval once registered with a host or Invited By.
- Delivery/Courier visitors cannot be checked in or issued a card. Enforce this in the database or server logic, not only in the UI.
- Every card has a unique Card Number. Only an Available card can be assigned. An Issued card cannot go to another active visitor.
- Check-out completes only after the Receptionist confirms the card was returned.
- Preserve card issue and return history with timestamps.
- Enforce authorization on the server or in database policies, not only by hiding controls.
- Record check-ins, check-outs, card events and sensitive account changes in the audit log. Never log passwords or tokens.

**Superseded from v1:** no check-in approval step, no host approval, no HR final approval, no entry approval, no approval of employee requests. Existing code for these remains until **D3** says what happens to the Visitor Approval module and Pending Approval and Rejected counts.

## 10. Statuses

Keep **visit status** and **card status** separate.

- **Card:** `available`, `issued`.
- **Visit, required by the PRD:** expected, checked in, checked out. The dashboard also counts Pending Approval and Rejected, so the full vocabulary and transitions are unresolved **[Pending D3, D9]**.
- **Visit, in the current code** (v1): `pending_employee_request`, `pending_host_approval`, `pending_admin_approval`, `expected`, `awaiting_entry_approval`, `approved`, `rejected`, `checked_in`, `checked_out`, `cancelled`. The first three approval statuses and `awaiting_entry_approval` belong to the superseded flow.
- Approval records, where they remain, use `pending`, `approved`, `rejected`, `expired`.

## 11. Invited By

Replaces v1's "Meeting With". A visit names the employee being visited:

- Search by permitted fields and select one employee; or
- If not found, the Receptionist contacts HR/Admin and types the confirmed employee's name.

The Receptionist-facing search and every receptionist response return **name and team only** (v1 also returned employee ID and designation). Store the relation in the database; whether more than one host is allowed is **[Pending D4]**. "Team" is assumed to be the existing `department` **[Pending D7]**.

## 12. Visitor Cards

- HR/Admin registers cards one at a time or by Excel (for example, 50 numbers). Registered cards appear for the Receptionist.
- Each card has exactly one current status, Available or Issued.
- History per assignment: card number, visitor, issued at, returned at, assigned or returned status, who issued and who received it.
- HR/Admin monitors: visitor name, visitor ID, card number, check-in time, card status, check-out status, history.
- Integration with a physical card-punching machine is **not** required.

## 13. Time and Visit Analytics

Store scheduled and actual timestamps separately: the scheduled arrival and departure, and the actual check-in and check-out. Arrival delay is actual check-in minus scheduled arrival. Departure delay is actual check-out minus scheduled departure. Show countdowns for upcoming arrivals and departures and update them dynamically. Handle pending, cancelled, completed and overdue visits correctly. Whether scheduled times are mandatory is **[Pending D6]**. Dashboard calendar and charts come from visit records, never hardcoded values.

## 14. Notifications

- When a visitor checks in, notify HR/Admin automatically with visitor name, phone, invited employee and check-in details. For an employee-registered visitor, also notify that employee.
- WhatsApp or Telegram if integration is available **[Pending D8]**. Until then, email through the existing transport, and the Receptionist may call HR/Admin if delivery fails.
- A failed notification must never block check-in. Record it and show the result.
- Keep provider secrets on the server, never in the browser.

## 15. Report Export and Sharing

Reports provide arrival and departure data and a PDF report table. The code also exports DOCX and CSV; these are kept but are not PRD requirements. Exports respect the selected date range and filters.

Do not create public report links by default. A persistent sharing link must use a secure, expiring, revocable token and enforce authorization. Receptionist reports must not contain employee emails or private information.

## 16. Technology

Frontend: React, TypeScript and **Next.js** (App Router), Tailwind CSS. The PRD (§8) names Vite; the product owner chose Next.js on 2026-11-04 (decision DEC-011). Receptionist on web and mobile (responsive web today **[Pending D8]**).

Backend, database and authentication:

| | PRD (P§8) | Code today |
|---|---|---|
| Platform | Supabase | Node.js, Express, TypeScript |
| Database | Supabase PostgreSQL | PostgreSQL |
| Authentication | Supabase Auth | Custom sessions, password hashing, login rate limit |
| Authorization | Role-based access and database policies (RLS) | Role guards in Express |

**Do not add or replace a backend, database or authentication provider without approval. [Pending D1]**

Email: SMTP or transactional service (existing). Excel import: needs a spreadsheet-reading dependency, which needs approval. Never hardcode real credentials or secrets.

## 17. Development Rules

- Read `CLAUDE.md` and the relevant `docs/` file before changing anything.
- Inspect the existing architecture and code before editing. Preserve working behavior unless the PRD requires a change.
- Build one feature at a time; wait at the approval gates in `docs/IMPLEMENTATION_PLAN.md`.
- Reuse shared components and design tokens. Keep frontend, backend and database logic organized.
- Use responsive layouts. Handle loading, empty, error and success states.
- Validate all form input on the client, and enforce important rules on the server or database.
- Protect every route and endpoint by role. Never expose private employee information to Receptionists.
- Use realistic mock data only in development, and never claim it is connected to a backend.
- Never edit an applied migration; add a new numbered one. Back up before migrating data you care about.
- Never run the backend tests against the development database; they empty every table.
- Ask before deleting or overwriting existing files.
- Report test results as they are. Do not claim something works unless it was tested.

## 18. Development Order

See `docs/IMPLEMENTATION_PLAN.md`. In short: approve decisions D1–D9, design the data changes, restyle and re-navigate, build cards with the new check-in and check-out, build direct employee registration and the unscheduled flow, add Excel imports and VIP groups, add notifications and reports, then retire the superseded approval code, update the tests and check security and responsive layouts.

## 19. Implementation Status

Not repeated here. `docs/REQUIREMENT_CHANGELOG.md` section 4 audits every feature as keep, modify, partial, missing or obsolete.
