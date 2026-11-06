# NagorikPass Project Status

**Last updated:** 2026-11-05

Statuses: Not Started, In Progress, Blocked, Under Review, Approved, Completed.

## Overview

NagorikPass is a Visitor Management System. Requirements: [`docs/source/REQUIREMENT_PRD.md`](docs/source/REQUIREMENT_PRD.md). Specification: [`docs/development/DEVELOPMENT_PRD.md`](docs/development/DEVELOPMENT_PRD.md).

## Current stage

Stage 2, documentation. Written and awaiting owner review. **Implementation is not authorized.** The code already in the repository predates this specification and isn't counted as progress here (see Phase 0).

## Documentation

| Document | Status |
|---|---|
| Requirement PRD | Completed (unchanged, checksum verified) |
| Development PRD and documents 01 to 11 | Under Review |
| `CLAUDE.md`, `.claude/commands/` | Under Review |

## Approvals

| Item | Status | Notes |
|---|---|---|
| Documentation structure | Approved | J1, with `11-ui-design-system.md` added by J7 |
| Architecture | Approved | J2. Google Sign-In added afterwards by DEC-G1. |
| Database design | Approved | J5. Refinements listed under Recent decisions. |
| Permission design | Approved | J6 |
| Google Sign-In | Approved as a requirement | Company Workspace domain only, company emails only (OQ-11, OQ-12 decided); domain value needed |

## Open business decisions

The owner decided OQ-1 to OQ-12 and OQ-15 on 2026-11-05. Two questions remain.

| ID | Topic | Status | Blocks |
|---|---|---|---|
| OQ-1 | Visitor ID: assigned by hand by HR/Admin, once; separate from reusable card numbers | Decided | None |
| OQ-2 | Dashboard covers today only; couriers excluded | Decided | None |
| OQ-3 | Only HR/Admin is notified; hosts and employees aren't (differs from PRD §5B) | Decided | None |
| OQ-4 | No employee Telegram linking; owner implements Telegram later | Decided | None |
| OQ-5 | Bangladeshi visitor phone numbers only, stored as +880 | Decided | None |
| OQ-6 | Employee phone optional, email required | Decided | None |
| OQ-7 | HR/Admin can correct card numbers; history kept | Decided | None |
| OQ-8 | Deactivation keeps visits and notifies HR/Admin; host can't be picked for new visits | Decided | None |
| OQ-9 | Manual calls aren't recorded | Decided | None |
| OQ-10 | One active visit per phone number | Decided | None |
| OQ-11 | Google Sign-In limited to the company Workspace domain | Decided | Phase 1 needs the domain value |
| OQ-12 | Company email addresses only | Decided | None |
| OQ-13 | Production email provider | **Pending Decision** | Phase 2 (production invitations) |
| OQ-14 | Vercel plan | **Pending Decision** | Phase 6 (retry schedule) |
| OQ-15 | Brand tokens in `11-ui-design-system.md` are official; image at `design_resources/visitx/nagorik.jpeg` | Decided | None |

**Details still needed from the owner:** the company domain; the Visitor ID format, whether check-in needs one and how a mistake is corrected; whether cancelled visits count in Total Visitors; whether Telegram is built in Phase 6 or after launch; whether landlines are accepted and employee phones must be Bangladeshi; a usable logo file. Full list in [Development PRD §14](docs/development/DEVELOPMENT_PRD.md#14-open-questions-and-decisions).

## Development phases

| Phase | Objective | Status |
|---|---|---|
| 0 | Existing code decision | Not Started |
| 1 | Schema, RLS, authentication including Google | Not Started |
| 2 | People | Not Started |
| 3 | Visitors and registration | Not Started |
| 4 | Cards, check-in and check-out | Not Started |
| 5 | Excel imports | Not Started |
| 6 | Notifications, Realtime, jobs | Not Started |
| 7 | Dashboard, reports, settings | Not Started |
| 8 | PWA, testing, deployment | Not Started |

## Tasks

**Completed:** archive of previous documentation; Requirement PRD preserved; Stage 1 analysis; owner decisions recorded; Stage 2 documents written.

**Ongoing:** owner review of Stage 2 documents.

**Pending:** OQ-13 and OQ-14; the details still needed listed above; Phase 0 authorization.

## Blockers

None for documentation. Implementation needs authorization, and each phase's open questions are listed above.

## Recent decisions (2026-11-05)

- Owner decided OQ-1 to OQ-12 and OQ-15. Documents 01 to 11, the Development PRD and this file were updated to match. OQ-13 and OQ-14 stay pending.

- Owner answered Q9 to Q21, T1 to T10 and J1 to J10 (Development PRD §14).
- Google Sign-In added for all roles, never granting access by itself (DEC-G1).
- Company logo sets the base color, and the Showcase sets the layout (J7 and owner direction).
- Refinements from the Stage 1 proposal, all following from the answers:
  - `card_assignments.ended_at` replaces `returned_at`, so a lost card never reads as returned.
  - `scheduled_date` and time columns replace timestamps (DEC-Q15).
  - `visits` also keeps phone and organization as entered.
  - Excel report export added (DEC-Q16).
    - Cron routes use `GET`, as Vercel Cron requires.

## Repository notes

- `docs/` was found deleted on 2026-11-05 during this work, cause unknown. The Requirement PRD was restored from the owner's copy and its checksum verified (`46c67060…1456`).
- Four third-party images were deleted from `design_resources/` and remain in git.
- Nothing has been committed.
