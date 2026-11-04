# NagorikPass — PDF Requirements Checklist, Gap Analysis and Plan

**Authority:** `docs/NagorikPass_PRD.pdf` only. Nothing here comes from the old `Project_Guide.md`, from `docs/PRD.md`, or from what the code happens to do. Where the PDF is silent or contradicts itself, the item is listed under **Questions** and is not decided.
**Date:** 2026-11-04
**Status:** Checklist and plan for approval. No application code, migration or dependency has changed.

Supersedes, for requirements, `docs/REQUIREMENT_CHANGELOG.md` (which compared against the old guide). Its code audit facts still hold.

**Settled by your instruction today:** the PDF is the single source of truth, and its stack is the stack: React, TypeScript, Vite on the front; **Supabase** (PostgreSQL, Auth, database policies) behind it. That resolves the earlier Express-versus-Supabase question in favour of Supabase.

**Today column:** **Met** works as the PDF says. **Partial** some of it exists. **Missing** not built. **Conflict** exists but does the opposite of the PDF. **Process** is a human duty, not a system feature.

---

## 1. Requirement checklist

### A. Roles — PDF §3

| ID | Requirement (PDF wording, shortened) | Today | Action |
|---|---|---|---|
| A1 | HR/Admin manages employees, receptionists and visitor records | **Met** (employee, receptionist and visitor pages) | Keep, port to Supabase |
| A2 | HR/Admin registers expected visitors in advance | **Met** (extra mandatory fields, see B2) | Modify |
| A3 | HR/Admin monitors dashboards, visitor history and reports | **Partial** (no visitor timeline, no card data) | Modify |
| A4 | HR/Admin receives a notification when a visitor checks in | **Conflict** (hosts are emailed, HR/Admin is not) | Modify |
| A5 | HR/Admin "adds employee-initiated visitors to the expected visitor list" | **Conflict** (employee requests wait for HR approval) | **Ask Q2** |
| A6 | HR/Admin registers visitor cards (bulk Excel or manual) and monitors card status and assignment history | **Missing** | Build |
| A7 | HR/Admin uploads interview candidate lists via Excel | **Missing** | Build |
| A8 | HR/Admin registers VIP visits and groups | **Missing** | Build |
| A9 | Receptionist views expected visitors | **Met** | Keep |
| A10 | Receptionist registers unscheduled visitors | **Conflict** (registration starts an approval chain) | Modify |
| A11 | Receptionist searches for the employee a visitor wants to meet | **Partial** (returns ID and designation too, host is mandatory) | Modify |
| A12 | Receptionist checks visitors in and out | **Partial** (no cards) | Modify |
| A13 | Receptionist manages visitor information through web and mobile applications | **Partial** (web only; receptionists cannot edit visitor details) | **Ask Q14, Q16** |
| A14 | Receptionist assigns an available card at check-in and confirms its return at check-out | **Missing** | Build |
| A15 | Receptionist does not check in delivery personnel | **Missing** | Build |
| A16 | Employee coordinates visitor invitations with HR/Admin | **Process** | None |
| A17 | Employee provides visitor information to HR/Admin before the visit | **Partial** (via a request that HR must approve) | Modify with B-workflow |
| A18 | Employee takes responsibility for coordinating invited visitors | **Process** (the "Invited By" link carries it) | None |

### B. Visitor data — PDF §4, §4.1

| ID | Requirement | Today | Action |
|---|---|---|---|
| B1 | Eight categories: Business Meeting, Job Interview, VIP Visit, Vendor/Supplier, Maintenance/Technician, Personal Guest, Delivery/Courier, Other | **Missing** | Build |
| B2 | Mandatory on registration: visitor name, phone number, purpose of visit | **Partial** (company also mandatory; email mandatory when pre-registering; a host mandatory) | Modify |
| B3 | Additional: number of guests; invited by (employee name); company or organization | **Partial** (company yes; guests and invited-by missing) | Modify |
| B4 | Record holds category, host employee, scheduled arrival and departure, actual check-in and check-out, card issued | **Partial** (no category, no card) | Modify |

### C. Standard check-in and check-out — PDF §5

| ID | Requirement | Today | Action |
|---|---|---|---|
| C1 | Receptionist registers the visitor or finds them in the system | **Met** | Keep |
| C2 | Receptionist selects an available card from a dropdown in the visitor list | **Missing** | Build |
| C3 | Clicking Check-in links the card to the visitor's record | **Missing** | Build |
| C4 | System records check-in time and changes the card Available to Issued | **Partial** (time only) | Modify |
| C5 | Card number and visitor details appear on the HR/Admin dashboard, and HR/Admin is notified | **Missing** | Build |
| C6 | Visitor returns the card; Receptionist clicks Check-out | **Partial** | Modify |
| C7 | Popup asks exactly: "Did you get the visitor card back?" | **Missing** | Build |
| C8 | Yes: record check-out time, status Checked Out, card Issued to Available, update HR/Admin dashboard | **Partial** (status and time only) | Modify |
| C9 | No: check-out stays incomplete, visitor stays in the Checked-In list, card stays assigned until recovered | **Missing** | Build |
| C10 | Every assignment and return kept in card history with issued and returned date and time | **Missing** | Build |

### D. Workflows — PDF §5

| ID | Requirement | Today | Action |
|---|---|---|---|
| **A: HR/Admin pre-registers** | | | |
| D-A1 | HR/Admin registers the visitor with required information | **Met** | Modify (B2) |
| D-A2 | Visitor appears in the Receptionist's Expected Visitors | **Met** | Keep |
| D-A3 | On arrival the Receptionist verifies identity and checks in | **Conflict** (an HR entry approval is required first) | Modify |
| D-A4 | System records check-in and notifies HR/Admin | **Conflict** | Modify |
| D-A5 | Receptionist checks out when the visit ends | **Partial** | Modify (C6–C9) |
| **B: Employee-initiated** | | | |
| D-B1 | Employee logs in and selects Add New Visitor | **Conflict** (page is "Submit Visitor Request") | Modify |
| D-B2 | Employee enters visitor information including full name and phone, and visit details | **Partial** | Modify |
| D-B3 | System adds the visitor to the Receptionist's Expected Visitors | **Conflict** (waits for HR approval) | Modify |
| D-B4 | Visitor also appears in the HR/Admin dashboard and visitor records | **Partial** (only as a pending request) | Modify |
| D-B5 | No HR/Admin approval is required | **Conflict** | Remove approval step |
| D-B6 | Receptionist finds the visitor, verifies identity, checks in | **Partial** | Modify |
| D-B7 | System records check-in time and updates status | **Met** | Keep |
| D-B8 | System notifies both the registering employee and HR/Admin | **Missing** | Build |
| D-B9 | Receptionist checks out when the visit ends | **Partial** | Modify |
| **C: Unscheduled** | | | |
| D-C1 | Receptionist collects information and registers the visitor | **Partial** | Modify |
| D-C2 | Receptionist searches for the employee the visitor wants to meet | **Partial** | Modify (A11) |
| D-C3 | If not found: contact HR/Admin, record the confirmed employee in Invited By | **Missing** | Build (Q5, Q6) |
| D-C4 | Receptionist checks the visitor in | **Conflict** (host approval, then HR approval first) | Modify |
| D-C5 | System records the visit and notifies HR/Admin | **Conflict** | Modify |
| D-C6 | Receptionist checks out when the visit ends | **Partial** | Modify |
| D-C7 | Once the entry exists, no additional employee approval for check-in | **Conflict** | Remove approval step |
| **D: Personal guest** | | | |
| D-D1 | Receptionist registers the guest; system records whom they meet (Invited By) | **Missing** | Build |
| D-D2 | Receptionist checks in the guest and issues a card | **Missing** | Build |
| D-D3 | Visit saved in history with type Personal Guest | **Missing** | Build |
| **E: Interview candidate** | | | |
| D-E1 | HR uploads an Excel sheet of candidates | **Missing** | Build (Q9) |
| D-E2 | System imports them into Expected Visitors | **Missing** | Build |
| D-E3 | Receptionist finds the candidate on arrival and checks in | **Missing** | Build |
| D-E4 | Receptionist issues a card and checks out by the standard procedure | **Missing** | Build |
| **F: VIP and groups** | | | |
| D-F1 | HR/Admin registers the VIP visit and the expected number of guests | **Missing** | Build (Q3) |
| D-F2 | Receptionist verifies the actual number who arrive | **Missing** | Build |
| D-F3 | System records visitor name, number of guests, invited-by employee, organization | **Missing** | Build |
| D-F4 | Receptionist checks in and issues cards by the standard procedure | **Missing** | Build (Q3) |
| **Delivery** | | | |
| D-X1 | Delivery personnel are not allowed to enter; never checked in; no card | **Missing** | Build, enforced in the database (Q4) |

### E. HR/Admin web application — PDF §6.1

| ID | Requirement | Today | Action |
|---|---|---|---|
| E1 | Sidebar is exactly: Dashboard, Visitor Management, Visitor Approval, Visitor History, Visitor Cards, Employee Management, Receptionist Management, Reports, Settings | **Partial** (has extra "Add New Visitor" and "Expected Visitors"; no Visitor Cards) | Modify |
| E2 | Dashboard shows Total Visitors, Expected Today, Checked In, Pending Approval, Completed, Rejected | **Met** (figures to be re-derived once approvals change, Q1) | Keep |
| E3 | Dashboard shows activity graphs | **Met** | Keep |
| E4 | Dashboard shows a visitor timeline | **Missing** | Build |
| E5 | Visitor Management: manage visitors | **Met** | Keep |
| E6 | Add expected visitors via a **modal** with name, phone and purpose required | **Partial** (a full page; extra required fields) | Modify |
| E7 | Register VIP visits with an expected number of guests | **Missing** | Build |
| E8 | Upload interview candidates via Excel | **Missing** | Build |
| E9 | Visitor Approval: "manage approval records" | **Conflict** (built around the removed approvals) | **Ask Q1** |
| E10 | Visitor History: search past visits, check-in and check-out details, card issued and returned, visitor type | **Partial** (no card, no type) | Modify |
| E11 | Visitor Cards: register by bulk Excel or manually; monitor status and history | **Missing** | Build |
| E12 | Employee Management: manage employees; receptionists see only name and team | **Partial** | Modify |
| E13 | Receptionist Management: manage receptionist accounts and access | **Met** | Keep (Q8) |
| E14 | Reports: arrival and departure data, and a PDF report table | **Met** (PDF report exists; contents re-checked after the data changes) | Keep, verify (Q15) |
| E15 | Settings: manage application configuration | **Partial** (settings exist; most are approval or email options) | **Ask Q13** |

### F. Receptionist application — PDF §6.2

| ID | Requirement | Today | Action |
|---|---|---|---|
| F1 | Available on web and mobile | **Partial** (responsive web only, untested on a phone) | **Ask Q12** |
| F2 | Navigation is exactly: Home, Expected Visitors, Add New Visitor | **Conflict** (six items today) | Modify |
| F3 | Home: Total Visitors Today, Currently Checked In, Checked Out, today's visitor list | **Partial** (different tiles) | Modify |
| F4 | Expected Visitors: find and verify pre-registered visitors; check in and record timestamps | **Partial** | Modify |
| F5 | Add New Visitor: required name, phone, purpose; additional guests, company; search and associate host; if not found enter Invited By; no approval | **Conflict** | Modify |
| F6 | Check-in with a card dropdown; check-out with the confirmation popup | **Missing** | Build |
| F7 | Delivery personnel must not be checked in | **Missing** | Build |

### G. Notifications — PDF §6.3

| ID | Requirement | Today | Action |
|---|---|---|---|
| G1 | System automatically notifies HR/Admin when a visitor checks in | **Missing** (hosts are emailed instead) | Build |
| G2 | Notification includes visitor name, phone number, invited employee, check-in details | **Missing** | Build |
| G3 | WhatsApp or Telegram when a visitor checks in and receives a card, "if integration is available" | **Missing** | **Ask Q10** |
| G4 | If automatic notification is unavailable, the Receptionist can notify or call HR/Admin manually | **Process** | **Ask Q10** (is any screen needed?) |
| G5 | Employee-initiated visitor check-in also notifies the registering employee (Workflow B) | **Missing** | Build |

### H. Visitor card management — PDF §6.4

| ID | Requirement | Today | Action |
|---|---|---|---|
| H1 | Register cards in bulk by Excel (for example 50 numbers) | **Missing** | Build (Q9) |
| H2 | Add individual card numbers manually | **Missing** | Build |
| H3 | Each card has a unique Card Number/ID | **Missing** | Build, in the database |
| H4 | Registered cards become available in the Receptionist dashboard | **Missing** | Build |
| H5 | HR/Admin views all registered cards and statuses | **Missing** | Build |
| H6 | At check-in the Receptionist selects an available card and assigns it | **Missing** | Build |
| H7 | Card status Available to Issued on check-in; Issued to Available on "Yes" at check-out; "No" leaves it assigned | **Missing** | Build, atomic in the database |
| H8 | Each card has exactly one current status: Available or Issued | **Missing** | Build |
| H9 | Card monitoring shows visitor name, visitor ID, card number, check-in time, card status, check-out status, assignment and return history | **Missing** | Build |
| H10 | History keeps card number, visitor name, issued date and time, returned date and time, assigned and returned status | **Missing** | Build |
| H11 | HR/Admin dashboard updates when a card is assigned and when it is returned | **Missing** | Build |
| H12 | Cards are registered and assigned through the portal; no physical card-machine integration | n/a | Do not build an integration |

### I. Interview candidate import — PDF §6.5

| ID | Requirement | Today | Action |
|---|---|---|---|
| I1 | HR uploads an Excel sheet of candidate details | **Missing** | Build (Q9) |
| I2 | Candidates are imported automatically into Expected Visitors | **Missing** | Build |
| I3 | Receptionist can find the candidate and check them in on arrival | **Missing** | Build |

### J. Visitor history — PDF §6.6

For every visit the system stores:

| ID | Field | Today | Action |
|---|---|---|---|
| J1 | Visitor ID, name, phone | **Met** | Keep |
| J2 | Purpose of visit | **Met** | Keep |
| J3 | Number of guests | **Missing** | Build |
| J4 | Invited-by employee | **Missing** | Build |
| J5 | Company or organization | **Met** | Keep |
| J6 | Check-in and check-out times | **Met** | Keep |
| J7 | Card number, with issued and returned date and time | **Missing** | Build |
| J8 | Visitor type | **Missing** | Build |

### K. Approval and security rules — PDF §7

| ID | Requirement | Today | Action |
|---|---|---|---|
| K1 | Employees register their own visitors without HR/Admin approval | **Conflict** | Modify |
| K2 | Unscheduled visitors need no additional employee approval after registration | **Conflict** | Modify |
| K3 | User access is restricted by role | **Met** (in Express; moves to Supabase policies) | Port |
| K4 | Receptionists see only employee names and teams, not private information | **Partial** (also sees ID and designation) | Modify |
| K5 | Delivery personnel cannot be checked in by the Receptionist | **Missing** | Build |
| K6 | A visitor is checked out only after the Receptionist confirms the card was returned | **Missing** | Build |
| K7 | Cards are registered and managed only by HR/Admin, each with a unique number | **Missing** | Build |

### L. Technology — PDF §8

| ID | Requirement | Today | Action |
|---|---|---|---|
| L1 | Web frontend: React, TypeScript, Vite | **Changed by decision DEC-011:** React and TypeScript kept; Vite replaced by **Next.js** at the product owner's request | Done in the frontend conversion |
| L2 | Backend platform: Supabase | **Conflict** (Express) | Migrate |
| L3 | Database: Supabase PostgreSQL | **Partial** (PostgreSQL, not Supabase) | Migrate |
| L4 | Authentication: Supabase Auth | **Conflict** (custom sessions) | Migrate |
| L5 | Authorization: role-based access control and database policies | **Partial** (roles yes, database policies none) | Build RLS |
| L6 | Notifications: notification integration | **Partial** (email only) | **Ask Q10** |
| L7 | Admin/HR and Employee: web application | **Met** | Keep |
| L8 | Receptionist: web and mobile application | **Partial** | **Ask Q12** |

**Count (computed from the tables above):** 130 rows: Met 19, Partial 32, Missing 57, Conflict 18, Process 3, not applicable 1. "Met" means the existing behaviour matches the PDF today; none of these has been re-tested against Supabase, and a row only counts as done after it has been tested in its phase.

---

## 2. Gap analysis

### Frontend
- **Rebuild navigation** for all three roles to the PDF's lists (E1, F2, and the employee area).
- **New pages:** Visitor Cards; Excel upload dialogs; VIP registration; visitor timeline widget; the employee's Add New Visitor and My Visitors.
- **Modify:** add-visitor form (modal, category, guests, Invited By, optional company and email); receptionist list (card dropdown, return popup); history columns; dashboard tiles for the receptionist.
- **Remove:** `ApprovalResponsePage`, `HostApprovalsPage`, `MyHostDecision`, the receptionist and admin approvals pages (subject to Q1), the "request" wording.
- Visual styling follows the reference image per `CLAUDE.md`. The PDF has no visual requirement, so this is not a PDF item. Say so if you want it excluded.

### Backend and platform (L2–L5)
- Supabase replaces Express for data, authentication and authorization. Express routes, services, custom sessions and the 125 backend test cases are **replaced**, not edited.
- Check-in and check-out become **database functions** that run in one transaction.
- Email, PDF report and Excel parsing cannot run in the browser. They move to **Supabase Edge Functions**.

### Database
- Existing `visitors` and `visits` split is reused. New: category, guests, Invited By on visits; `visitor_cards`; `visitor_card_assignments`; import records.
- `approvals`, `approval_decisions`, approval statuses, and approval settings are removed or repurposed once Q1 is answered.
- **Row-level policies** for every table, with separate tests per role.

### Authentication and authorization
- Supabase Auth plus a profile table holding the role. Policies, not Express guards, decide access. Employee private columns (official email, phone) stay unreadable to receptionists and other employees, including through search.

### Notifications
- Check-in alert to HR/Admin (and the registering employee for Workflow B). Channel pending Q10.

### Tests
- Obsolete: most of `workflows.test.ts` and the approval-link, token and check-in parts of `api.test.ts`. Replaced by tests written from this checklist.
- Everything is re-tested against Supabase. **RLS cannot be tested on this machine today** (Q11).

### Existing behaviour that is not in the PDF

| Behaviour | Conflicts with the PDF? | Proposed disposition |
|---|---|---|
| Host approval by emailed link; HR final approval; entry approval; approval of employee requests; related settings and emails | **Yes** | **Remove** |
| Express backend and custom sessions | **Yes** (L2, L4) | **Remove** after migration |
| Hosts receive arrival emails | **Yes** (G1, G5 name HR/Admin and the employee) | **Replace** |
| Several hosts per visit | Unclear (PDF says one Invited By) | **Ask Q6** |
| Cancelling a visit | No | Keep unless you say otherwise (**Q17**) |
| Check-in allowed only on the day of the visit | No, but it restricts check-in | **Ask Q17** |
| Invitation email to the visitor | No | **Ask Q17** |
| DOCX and CSV report exports, audit log, countdowns and delay figures, activity calendar, receptionist visitor history page, "identity verified" tick | No | **Ask Q17** (each must be rebuilt on Supabase) |

---

## 3. Questions that need your decision

Marked **Blocks Phase 1** when the database design cannot be written without an answer. I have not assumed any answer. The short note after each is only a suggestion to speed up your reply.

### Blocks Phase 1 (data model and policies)

- **Q1. What are Visitor Approval, Pending Approval and Rejected for?** The PDF lists a *Visitor Approval* page ("manage approval records"), and *Pending Approval* and *Rejected* tiles, but §7 says employee-registered and unscheduled visitors need no approval, and no workflow creates one. What creates an approval record, who decides, and what are all the allowed visit statuses? *(PDF names only Expected, Checked In, Checked Out as states.)*
- **Q2. Does HR/Admin add employee-initiated visitors, or does the system?** §3 says HR/Admin "adds employee-initiated visitors to the expected visitor list". Workflow B steps 3 and 5 say the system adds them with no HR action. Which is it?
- **Q3. VIP and group model.** One record with a guest count, or one record per attendee? If a group has N people, are N cards issued, and is one Check-in click enough? Same question for any visitor whose number of guests is above 1.
- **Q4. Delivery/Courier.** May a delivery person be registered at all (so the visit is recorded) and simply never checked in, or must the system refuse to register one? Is a refused attempt recorded?
- **Q5. Invited By.** Is it a free-text name, a pick from the employee list, or both? When a visitor is registered by an employee, is Invited By set to that employee automatically? When HR/Admin registers one, who is Invited By?
- **Q6. One host or several?** The existing system allows several. The PDF mentions one "host employee" and one "Invited By".
- **Q7. Employee record fields and "team".** Which fields does an employee record hold? What is "team" (the existing `department`, or a separate field)? Which fields are "private information" hidden from receptionists?
- **Q8. How are accounts created?** For employees and receptionists: HR/Admin creates the account (with an invitation email, or a password you set), or can people register themselves? Can HR/Admin deactivate or reset?
- **Q9. Excel files.** Exact columns for the card file and the candidate file (sample files would settle it), accepted types (`.xlsx`, `.xls`), maximum size and rows, how duplicate card numbers or candidates are handled, what happens to bad rows, and whether a file is all-or-nothing.
- **Q10. (Also for Phase 7) Notification channel.** §6.3 requires an automatic notification but makes WhatsApp or Telegram conditional on "integration if available". Which channel(s) must work now (in-app, email, WhatsApp, Telegram)? Is a WhatsApp or Telegram integration available, and which provider? Does the manual fallback need a screen, or is it a phone call?

### Blocks starting work (platform and process)

- **Q11. Where does Supabase run?** The Supabase CLI and Docker are not installed here, and there are no Supabase credentials. Choose: (a) I install the Supabase CLI and Docker locally; (b) you create a hosted Supabase project (a free or test one) and give me a way to use it without putting secrets in the repository. Without one of these, I cannot run or test policies.
- **Q11b. Dependencies.** May I add `@supabase/supabase-js`, the Supabase CLI, an Excel reader (`exceljs` or SheetJS), and a PDF library for Edge Functions?
- **Q11c. Existing data.** Is the current development database (demo seed data) disposable, or must it be migrated?

### Can wait until the phase that needs it

- **Q12. Mobile.** "Web **and mobile application**" for the Receptionist: responsive website, installable web app (PWA), or a separate native app?
- **Q13. Settings.** What configuration should the Settings page manage?
- **Q14. Scheduled arrival and departure.** Mandatory or optional when registering an expected visitor?
- **Q15. Reports.** Which filters and columns? The existing report (date range, status, type; a PDF table of visits with scheduled and actual times) may already be enough.
- **Q16. Receptionist editing.** "Manages visitor information": may a receptionist edit a visitor's details after registering them (today only HR/Admin can)?
- **Q17. Keep or drop the extras** in the last table of Section 2: cancel visit, same-day-only check-in, visitor invitation email, DOCX and CSV exports, audit log, countdowns and delay figures, activity calendar, receptionist visitor history, "identity verified" tick. Anything you keep must be rebuilt on Supabase.

---

## 4. Proposed implementation plan

Each phase ends with a check against the checklist IDs above, then your approval. Documentation and tests are updated inside each phase, not at the end.

| Phase | Work | Checklist IDs | Needs |
|---|---|---|---|
| **0 Decisions and environment** | Answer Q1–Q11 | all | You; Q11 environment |
| **1 Data and policies** | Supabase schema: profiles, employees, visitors, visits (category, guests, Invited By), cards, assignments, import records; constraints; **atomic `check_in_visit` and `check_out_visit`**; delivery block; policies for every table; seed data; per-role policy tests | B, C, H, K | Q1–Q9, Q11 |
| **2 Authentication and shell** | Supabase Auth, role from profile, protected routes, the three navigations exactly as the PDF lists, token restyle | E1, F2, K3, L1–L5, L7 | Phase 1 |
| **3 Registration** | HR add-visitor modal; employee Add New Visitor and My Visitors; receptionist Add New Visitor with host search (name and team only) and Invited By; categories and guests | A2, A10, A11, B, D-B1–B5, D-C1–C3, D-C7, F5, K1, K2, K4 | Q5, Q6, Q14 |
| **4 Front desk** | Receptionist Home, Expected Visitors, card dropdown, check-in, the exact return popup, Checked-In list, delivery block | C, D-A, D-C, D-D, F3, F4, F6, F7, K5, K6 | Phase 3 |
| **5 Cards** | Visitor Cards page: manual add, Excel upload, status, history; HR dashboard card data | A6, E11, H | Q9 |
| **6 Imports and VIP** | Candidate Excel import; VIP and group registration and arrival counts | A7, A8, D-E, D-F, E7, E8, I | Q3, Q9 |
| **7 Notifications and reports** | Check-in alerts to HR/Admin and the registering employee; dashboard timeline, tiles and card display; history columns; PDF report | A3, A4, C5, D-B8, E2–E4, E10, E14, G, J | Q10, Q15 |
| **8 Approvals and clean-up** | Resolve the Visitor Approval module per Q1; remove the Express backend and every superseded approval file; settings per Q13 | E9, E15, L2–L4 | Q1, Q13 |
| **9 Acceptance** | Walk every checklist row; policy tests for each role; concurrency test for card assignment; responsive checks on desktop, tablet and phone; documentation final | all | all |

### What happens to the old project
Nothing is deleted until its replacement works and you have approved the phase. Express stays in the repository, unused, until Phase 8, so you can compare behaviour.

### Reporting
After each phase: what was built, files changed, the checks that ran and their actual results, rows now Met, and what is still open. A row counts as Met only when it has been tested.
