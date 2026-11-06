# NagorikPass — Step-by-Step Implementation Plan

> **Existing repository:** the app already exists. Read *Adaptation for the existing repository* at the end of this file for what is done, changed or new.

## Working rule
Complete one phase at a time. Demonstrate the result, run checks, update docs, and obtain approval at the listed gates. Do not generate the whole application in one pass.

## Phase 0 — Repository and requirement audit
1. Inspect the existing repository and package files.
2. Confirm whether the app already exists or needs initialization.
3. Read `CLAUDE.md` and all docs.
4. Compare current code with PRD requirements.
5. List missing requirements, conflicts, and risks.
**Deliverable:** repository audit and gap list.
**Approval gate:** user approves scope and unresolved questions.

## Phase 1 — Architecture and data design
1. Review system architecture proposal.
2. Review entities and relationships.
3. Resolve visitor vs visit data model.
4. Resolve VIP/group modeling.
5. Resolve roles and account provisioning.
6. Define visit and card state transitions.
7. Finalize RLS policy matrix.
**Deliverables:** approved architecture and schema.
**Approval gate:** user approves before migrations.

## Phase 2 — Project foundation and design system
1. Set up React + TypeScript + Vite if not already present.
2. Configure Tailwind CSS consistently with the installed version.
3. Add Supabase client configuration using environment variables.
4. Create global color, typography, spacing, radius, and shadow tokens.
5. Build shared Button, Input, Select, Card, Badge, Modal, Table, and layout components.
6. Implement sidebar and responsive shell.
7. Compare the result against `design_resources/NagorikPass Visitor Management Showcase-1.png`.
**Deliverables:** running app shell and reusable design system.
**Approval gate:** approve visual direction before building all screens.

## Phase 3 — Authentication and authorization
1. Implement Supabase Auth sign-in/sign-out.
2. Implement protected routes.
3. Resolve role/profile loading.
4. Implement role-specific navigation.
5. Add and test RLS policies with separate accounts.
**Deliverables:** working role-based login and access.
**Approval gate:** approve role access tests.

## Phase 4 — HR/Admin foundation
1. Admin dashboard shell and metric placeholders connected to real queries only when available.
2. Employee management.
3. Receptionist management.
4. Visitor list and visitor registration.
5. Visitor history search/filter.
6. Settings scope after clarification.
**Deliverables:** Admin workflows with real database operations.

## Phase 5 — Employee portal
1. Employee dashboard/landing page.
2. Add visitor form.
3. My Visitors list.
4. Visit status display.
5. Verify employee cannot access other employees' private visitor records.
**Deliverables:** employee-initiated registration without HR approval.

## Phase 6 — Receptionist workflows
1. Receptionist home and today's visitor list.
2. Expected Visitors list.
3. Unscheduled visitor registration.
4. Host employee search limited to name and team.
5. Card selection.
6. Transaction-safe check-in.
7. Card-return confirmation dialog.
8. Transaction-safe check-out.
9. Delivery/Courier blocking.
10. Mobile responsive testing.
**Deliverables:** complete front-desk workflow.
**Approval gate:** demonstrate all six PRD workflows plus delivery restriction.

## Phase 7 — Visitor card administration
1. Manual card registration.
2. Unique card number validation.
3. Bulk card Excel import.
4. Card status list.
5. Assignment and return history.
6. Concurrency and duplicate-assignment tests.
**Deliverables:** card inventory and audit trail.

## Phase 8 — Interview candidates and VIP/group
1. Confirm import template and validation rules.
2. Implement interview candidate Excel import.
3. Show imported candidates in Expected Visitors.
4. Implement VIP/group registration after attendee/card modeling is approved.
**Deliverables:** import and group workflows.

## Phase 9 — Notifications and reports
1. Implement in-app notification behavior if approved.
2. Select WhatsApp/Telegram provider only after approval.
3. Implement secure server-side integration.
4. Implement arrival/departure reports.
5. Implement PDF report output.
**Deliverables:** notifications and reports.

## Phase 10 — Quality, security, and release readiness
1. Run unit and integration tests.
2. Test RLS for every role.
3. Test check-in/check-out race conditions.
4. Test import edge cases.
5. Test responsive screens.
6. Check accessibility and contrast.
7. Verify environment variables and secret handling.
8. Prepare deployment instructions and backup/migration plan.
**Deliverable:** release-readiness report.

## Required progress report after each phase
- Completed tasks
- Files created/modified
- Tests/checks run and actual results
- Known issues
- Decisions needed
- Next phase proposal

---

## Adaptation for the existing repository — 2026-11-04

This plan was written as if the app did not exist. It does: a working React and Express application with 307 backend and 26 frontend tests. The phases above stand as the *order of work*, with these changes. The audit behind them is `REQUIREMENT_CHANGELOG.md`.

| Phase | Status and change |
|---|---|
| 0 Audit | **Done** by `REQUIREMENT_CHANGELOG.md`. **Gate: approve decisions DEC-001 to DEC-009.** |
| 1 Architecture and data | Mostly decided by what exists: the visitor and visit split and the immutable decision history are in place. Remaining: DEC-001, DEC-003, DEC-004, DEC-005 and the migration design in `DATABASE_SCHEMA.md`. Nothing is written before approval. |
| 2 Foundation and design system | **Mostly exists** (React, Vite, Tailwind, shared components, responsive shell). Work left: restyle tokens to the reference image, rebuild the three navigations. Supabase client only if DEC-001 = A. |
| 3 Authentication and authorization | **Exists** (sessions, role guards, and a permission-matrix test that exercises every route as every role). Replace with Supabase Auth and RLS only if DEC-001 = A. |
| 4 HR/Admin foundation | **Exists** (employees, receptionists, visitors, history, reports, settings). Modify: visitor form fields, history columns, remove approval settings after DEC-003. |
| 5 Employee portal | **Exists as a request-and-approval flow.** Rework into direct registration and My Visitors. |
| 6 Receptionist workflows | **Partial.** Check-in and check-out exist without cards. Add card selection, the card-return popup, the delivery block, Invited By and name-and-team-only search. |
| 7 Visitor cards | **New.** Whole phase outstanding. |
| 8 Interview import and VIP or group | **New.** Needs DEC-005, DEC-006 and sample files. |
| 9 Notifications and reports | **Partial.** Email transport and PDF report exist. Retarget check-in alerts to HR/Admin and the registering employee. Chat provider needs DEC-008. |
| 10 Quality and release | **Extend** the existing suites. Rewrite the approval tests to the new rules. RLS tests need the Supabase CLI and Docker or a hosted test project. |

### Added phase: retire superseded approvals
After DEC-003, remove or repurpose the host, admin and entry approval code, its endpoints, emails, pages and settings, in one reviewed change with its tests. Do not delete it earlier than that.

### Skill and hook: removed
The `vms-guard` Skill and the test-running hook no longer exist (the user removed `.claude/` on 2026-11-04). No phase involves them.

### Order I propose
1. Approve decisions.
2. Phase 1 migration design, reviewed.
3. Phase 2 restyle and navigation, shown against the image.
4. Phase 7 then 6: cards first, then the new check-in and check-out, because check-in depends on cards.
5. Phase 5 and the unscheduled flow, once check-in no longer needs approval.
6. Phase 8, 9, then the approval retirement and phase 10.
