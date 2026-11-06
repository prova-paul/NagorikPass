# NagorikPass — Testing Strategy

## 1. Testing goals
Verify that the product follows the PRD, protects role-specific data, and preserves visitor/card lifecycle integrity.

## 2. Role-based access tests
Create separate test accounts for HR/Admin, Receptionist, and Employee.
- HR/Admin can access approved administrative modules.
- Receptionist cannot access private employee fields.
- Employee can register a visitor without HR approval.
- Employee cannot view another employee's private visitor data unless explicitly allowed.
- Unauthorized users cannot access protected records by calling Supabase directly.

## 3. Visitor workflow tests
- HR/Admin pre-registers visitor → appears in Expected Visitors.
- Employee registers visitor → appears in Expected Visitors and Admin records without approval.
- Receptionist registers unscheduled visitor → host search works; unresolved host follows HR/Admin confirmation process.
- Personal Guest is saved with correct visitor type.
- Interview candidate import creates expected visitor entries.
- VIP/group flow records expected and actual guest counts according to approved data model.
- Delivery/Courier cannot be checked in.

## 4. Card lifecycle tests
- Unique card number is enforced.
- Only Available card can be assigned.
- Successful check-in changes card Available → Issued.
- Card assignment history stores issue timestamp and actor.
- Check-out confirmation No leaves visit Checked In and card Issued.
- Check-out confirmation Yes changes visit to Checked Out and card to Available.
- Return history stores timestamp and actor.
- Two simultaneous check-in attempts cannot assign the same card twice.
- Failed transaction does not leave visitor/card in inconsistent states.

## 5. Form and import tests
- Required visitor name, phone, and purpose validation.
- Invalid phone input behavior after format rules are approved.
- Optional fields may be omitted.
- Excel file type, size, duplicate, malformed row, and partial-failure tests after import rules are approved.
- Import result reports accepted and rejected rows clearly.

## 6. UI tests
- Loading, empty, success, and error states.
- Desktop, tablet, and mobile layout.
- Keyboard focus and form labels.
- Status is understandable without color alone.
- Check-out confirmation wording matches PRD.
- Visual consistency with the reference image.

## 7. Release checklist
- [ ] All critical business rules covered by tests.
- [ ] RLS tests pass for each role.
- [ ] Card concurrency tests pass.
- [ ] Delivery restriction enforced outside the UI.
- [ ] No secrets in frontend bundle or repository.
- [ ] No production feature relies on mock data.
- [ ] Responsive receptionist workflow verified.
- [ ] Documentation and environment setup updated.

---

## Existing automated coverage — 2026-11-04

Baseline measured earlier in this session, with the code unchanged since:

| Suite | Result |
|---|---|
| Backend (`backend/`: vitest, supertest, real PostgreSQL test database) | typecheck, lint, build pass; 307 tests pass |
| Frontend (`frontend/`: vitest unit tests) | typecheck, lint, build pass; 26 tests pass |
| Frontend pages | no automated tests; checked by hand |

Backend tests run against a database whose name must contain "test" and empty every table they use. Never point them at the development database.

### What each backend file covers, and the PRD impact

| File | Covers | Under the updated PRD |
|---|---|---|
| `permissions.test.ts` | Every route as every role | Keep; the route list changes |
| `auth.test.ts` | Sign-in, sessions, password change | Keep (replaced if DEC-001 = Supabase) |
| `email.test.ts` | SMTP delivery and templates | Keep; templates change |
| `api.test.ts` | Privacy, employees, accounts, pre-registration, check-in, host links, lists, dashboard, reports, settings, tokens, audit log, times | Mixed. Approval-link, token and check-in sections are obsolete; the rest stays. |
| `workflows.test.ts` | The three approval workflows, self-approval, employee access, pending counts | **Mostly obsolete.** Rewrite to Workflows A to F. Employee-access and privacy cases carry over. |

About 48 of the 99 cases in the last two files concern approvals, hosts, tokens, requests or walk-ins by name. They must be rewritten to the new rules and not simply deleted, so coverage of the rules that remain is not lost.

### Tests the updated PRD adds
- Card number unique; only an Available card can be assigned; an Issued card cannot go to a second visitor.
- Check-in links the card, sets it Issued, and records the issue time and who issued it.
- Check-out with "No" leaves the visit Checked In and the card Issued; "Yes" completes both.
- Two simultaneous check-ins cannot take the same card (run in parallel against the test database).
- Delivery/Courier cannot be checked in or given a card, **including by calling the database function directly**.
- Employee-registered visitor reaches Expected Visitors with no approval; employee and HR/Admin are notified at check-in.
- Unscheduled visitor checks in with no approval; "Invited By" typed name works when the employee is not found.
- Receptionist responses contain employee name and team only: no ID, designation, email or phone, including in search.
- Mandatory fields (name, phone, purpose) and category validation; optional fields may be omitted.
- Excel import: file type, size, duplicates, bad rows, partial failure, per DEC-006.
- Card history keeps issue and return times after the card is reused.

### RLS and platform limits
The Supabase CLI and Docker are **not installed** on this machine, and the repository holds no Supabase credentials. If DEC-001 = Supabase, RLS tests per role cannot run until you approve installing them or provide a hosted test project. Constraints and database functions can be tested now against the local PostgreSQL test database.

### Responsive check
The receptionist check-in and check-out on a phone-sized screen has not been tested. It is part of the Phase 6 gate.
