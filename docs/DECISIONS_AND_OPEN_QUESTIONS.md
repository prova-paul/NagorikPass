# NagorikPass — Decisions and Open Questions

Use this log to record decisions that are not explicitly settled by the PRD. Add date, decision owner, rationale, and impact when each item is resolved.

## Open questions
1. **Visitor Approval module:** What does it approve, given employee-initiated and unscheduled visitor flows do not require additional approval?
2. **Visitor vs Visit:** Can one visitor return multiple times? The proposed schema separates a person (`visitors`) from visit occurrences (`visits`).
3. **VIP/group model:** Does each attendee need an individual visitor record and visitor card, or can a group be represented by one record?
4. **Employee accounts:** Who creates/invites employee accounts? Can employees self-register?
5. **Receptionist accounts:** What is the provisioning, suspension, and password-reset process?
6. **Employee privacy:** Which employee fields exist, and exactly which fields can HR/Admin, Receptionist, and Employee read?
7. **Scheduled times:** Are arrival/departure times optional or required for expected visitors?
8. **Excel templates:** What are the exact columns and sample files for card import and interview import?
9. **Import behavior:** How should duplicates and invalid rows be handled?
10. **Notifications:** WhatsApp or Telegram? Which provider, approved templates, retries, and fallback?
11. **Mobile:** Responsive web, PWA, or separate native mobile app?
12. **Reports:** Which filters, date ranges, columns, and PDF format are required?
13. **Retention:** How long should visitor information, card history, imports, and notification logs be retained?
14. **Timezone:** Which timezone should be used for storage/display? Confirm organizational operating timezone.
15. **Visitor status vocabulary:** Confirm all allowed statuses and transitions, including cancellation/rejection if applicable.

## Decision log template
### DEC-XXX — [Decision title]
- Date:
- Status: Proposed / Approved / Rejected
- Decision:
- Rationale:
- Affected documents:
- Approved by:

---

## PRD migration audit — 2026-11-04

Raised while comparing the updated PRD (`NagorikPass_PRD.pdf`) with `Project_Guide.md` v1 and the existing code. Full context: `REQUIREMENT_CHANGELOG.md`. All are **Proposed**; none is approved.

### Already answered by the existing code (confirm or change)
| Open question above | What the code does today |
|---|---|
| 2. Visitor vs Visit | `visitors` (a person, matched on name and phone) and `visits` (each occurrence) are already separate. |
| 4–5. Account provisioning | HR/Admin creates logins (receptionist and employee) and gets a one-time temporary password; users must change it at first sign-in; HR/Admin can reset or deactivate. No self-registration. |
| 6. Employee privacy | Employee fields: code, name, department, designation, official email, phone. Official email and phone never reach receptionists or other employees. The PRD narrows receptionist access further to name and team. |
| 7. Scheduled times | Date and expected time are required for pre-registered and employee visits; walk-ins use the current time. Departure is optional, with a default length from settings. |
| 14. Timezone | `APP_TIMEZONE`, default `Asia/Dhaka`, decides what "today" means. |
| 15. Status vocabulary | Ten statuses exist for the superseded approval flow; see D3 and D9. |

### DEC-001 — Backend platform
- Status: Proposed
- Decision needed: migrate to Supabase (A), keep Express and PostgreSQL and amend the PRD (B), or implement on Express first as portable SQL, then migrate (C).
- Recommendation: A, staged like C.
- Why it matters: PRD §8 and `CLAUDE.md` name Supabase Auth and RLS; the code has neither. Option A rewrites the Express routes, services and about 125 backend test cases. The Supabase CLI and Docker are not installed here, so RLS can't be tested locally until that changes.

### DEC-002 — Canonical requirements document
- Status: Proposed
- Decision needed: is the PDF canonical? `docs/PRD.md` omits the Rejected tile, changes "adds employee-initiated visitors" to "monitor", and reads the mobile requirement as responsive web.
- Recommendation: the PDF; sync `docs/PRD.md` to it.

### DEC-003 — Purpose of Visitor Approval, Pending Approval and Rejected
- Status: Proposed (supersedes open question 1)
- Decision needed: what, if anything, is still approved or rejected now that employee-registered and unscheduled visitors need no approval?
- Impact: decides whether the existing approval code is removed, kept for a defined case, or repurposed. It also decides the visit status vocabulary.

### DEC-004 — Number of hosts
- Status: Proposed
- Decision needed: one Invited By employee (PRD wording) or several (`visit_hosts` allows several today).

### DEC-005 — VIP and group model
- Status: Proposed (answers open question 3)
- Decision needed: one record with a guest count, or one record and one card per attendee.
- Recommendation: per attendee wherever each person receives a card.

### DEC-006 — Optional fields and Excel rules
- Status: Proposed (answers open questions 8–9)
- Decision needed: are visitor email and company optional (the PRD makes only name, phone and purpose mandatory)? Card and candidate import columns, file types and size, duplicate and bad-row handling, all-or-nothing or partial, and whether an error report is needed. Sample files requested.
- Recommendation: email and company optional; partial import with a downloadable error report.

### DEC-007 — Meaning of "team"
- Status: Proposed
- Recommendation: the existing `department`.

### DEC-008 — Notification provider and mobile
- Status: Proposed (answers open questions 10–11)
- Recommendation: email through the existing transport now, one chat provider after you choose it, responsive web for the receptionist.

### DEC-009 — Keep working extras the PRD doesn't mention
- Status: Proposed
- Items: cancelling a visit, check-in only on the day of the visit, the identity-verified confirmation, receptionist visitor history, DOCX and CSV report exports, audit log, countdowns and delay figures.
- Recommendation: keep all.

### DEC-010 — `vms-guard` Skill and the test hook
- Status: **Closed.** The user removed the `.claude/` folder (Skill and hook) on 2026-11-04. Nothing to decide.

---

## Resolved by user instruction — 2026-11-04

- **DEC-001 (backend platform):** resolved by the instruction to follow the PDF's stack. Supabase (PostgreSQL, Auth, database policies). The Express backend is to be replaced.
- **DEC-002 (canonical document):** resolved. `docs/NagorikPass_PRD.pdf` is the single source of truth. `docs/PRD.md` and `CLAUDE.md` §2 name `docs/PRD.md` as the source of truth; where they differ from the PDF, the PDF wins.
- **DEC-009 (keep extras):** reopened as Q17 in `PDF_REQUIREMENTS_CHECKLIST.md`. Existing behaviour is preserved only when it does not conflict with the PDF.
- **Questions DEC-003 to DEC-008:** superseded by Q1–Q17 in `PDF_REQUIREMENTS_CHECKLIST.md`, which lists every PDF ambiguity without choosing an answer.

---

## Resolved by user instruction — 2026-11-04 (account creation)

- **Q8 (how accounts are created):** resolved. HR/Admin creates Employee and Receptionist accounts. People receive
  invitation emails and set their own passwords. Public self-registration stays disabled. Invitations use Supabase
  Edge Functions; the service-role key never reaches frontend code.
- **New requirement:** every employee has a `can_register_visitors` permission, changeable by HR/Admin and enforced
  in the database. Employee management and bulk employee import are added. See `docs/EMPLOYEE_MANAGEMENT_DESIGN.md`
  for the proposal and the open questions A1 to A8.

---

## Employee management decisions — 2026-11-04

Confirmed by the user, in answer to A1 to A8 in `docs/EMPLOYEE_MANAGEMENT_DESIGN.md`.

| # | Decision |
|---|---|
| A1 | `can_register_visitors` is **ON** by default for new employees |
| A2 | Employee ID, Full Name and Email are mandatory for every employee, in the import and in the database |
| A3 | No SMTP provider yet. Develop and test without one; bulk invitations need one before production use |
| A4 | After an import, "Send invitations now" is shown, **unchecked by default** |
| A5 | An employee's email cannot be edited once a login exists |
| A6 | Partial import is supported, with row-level errors and a downloadable error report |
| A7 | CSV parsing uses `papaparse` |
| A8 | No history of permission changes for now |

---

## Frontend moves to Next.js — 2026-11-04

### DEC-011 — Next.js instead of Vite
- Status: **Approved by the product owner.** The PRD (PDF §8 and the Markdown PRD) says "React, TypeScript, Vite", and
  `CLAUDE.md` repeats it. Neither document has been edited. This entry records the change; they need updating if they
  are to match.
- Decision: the web frontend is Next.js (16.4.5, App Router) with React and TypeScript.
- Sessions: **server-side cookies** with `@supabase/ssr` (chosen over a browser-only session). A proxy refreshes the
  session and turns away visitors with none; the server checks role and profile where the data is read; row-level
  security remains the final check. Needs a Node host, such as Vercel.
- Migration: **in place** in `frontend/`. UI components, design tokens, the import logic and existing tests were kept.
  `react-router` and Vite were removed. Code written for the old Express API stays on disk, outside the build, until it
  is rewritten.
- Consequences: environment variables are now `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (they were `VITE_*`); the development address is `http://localhost:3000` (it was 5173), so the Supabase Auth Site URL
  and the Edge Function default `APP_URL` use 3000.
