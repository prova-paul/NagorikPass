# 10. Development Roadmap

Part of the [Development PRD](DEVELOPMENT_PRD.md). **Implementation needs separate authorization.** Status of every phase: Not Started. Progress is tracked in [`PROJECT_STATUS.md`](../../PROJECT_STATUS.md).

Test IDs refer to [08-testing-strategy.md](08-testing-strategy.md).

## Phase 0: Existing code decision

| Item | Detail |
|---|---|
| Objective | Compare the existing app, schema and `backend/` with this design, and decide what to keep (DEC-Q21) |
| Tasks | Compare modules; check which migrations are applied to hosted Supabase (read-only); list reusable code; recommend migrate or rebuild; write a migration plan |
| Dependencies | Approved documentation |
| Deliverables | Comparison report, decision, migration plan |
| Acceptance | Owner approves the decision and plan |
| Testing | None |

## Phase 1: Foundation, schema and authentication

| Item | Detail |
|---|---|
| Objective | Database, RLS, roles and sign-in |
| Tasks | Apply the approved schema; storage bucket; server and browser Supabase clients; proxy; login page; `signIn`, `signOut`, `setPassword`; `signInWithGoogle`, `GET /auth/callback`; role routing; denial messages; first HR/Admin procedure; layouts per role |
| Subtasks for Google | Configure a development and staging OAuth client; prove account linking; server-side company-domain check and refusal of personal accounts (OQ-11, OQ-12) |
| Dependencies | Phase 0; Google Cloud and Supabase access; the company domain value from the owner |
| Deliverables | Working sign-in for all roles by both methods |
| Acceptance | Unknown, personal and inactive Google accounts get no access; each role lands on its home |
| Testing | TC-AUTH-01 to TC-AUTH-16, TC-RLS-03 to TC-RLS-07, TC-DB-01, TC-UI-06 |

## Phase 2: People

| Item | Detail |
|---|---|
| Objective | Teams, employees, receptionists, invitations |
| Tasks | Team and employee screens; company-email validation; invitation and profile creation; deactivation that keeps visits and notifies HR/Admin of affected upcoming visits; receptionist management; audit rows |
| Dependencies | Phase 1; production invitation email service (OQ-13, pending) |
| Deliverables | HR/Admin can manage all people |
| Acceptance | An invited person signs in with password or Google and gets only their role |
| Testing | TC-EMP-01 to TC-EMP-07, TC-AUD-01 |

## Phase 3: Visitors and registration

| Item | Detail |
|---|---|
| Objective | Registration for every role |
| Tasks | Registration forms; Bangladeshi phone validation and normalization; one active visit per phone; Visitor ID assignment by HR/Admin; host search of active employees; Expected Visitors with date filter; employee view, edit and cancel; courier log; no-show function |
| Dependencies | Phase 2 |
| Deliverables | All pre-arrival flows |
| Acceptance | Workflows A, B and C up to check-in; courier log |
| Testing | TC-VIS-01 to TC-VIS-11, TC-VIS-13, TC-VIS-16 to TC-VIS-23, TC-RLS-01, TC-RLS-02 |

## Phase 4: Cards, check-in and check-out

| Item | Detail |
|---|---|
| Objective | Full standard flow |
| Tasks | Manual card entry; card number correction; monitoring and history; check-in with card selection; check-out popup; lost-card resolution; retirement |
| Dependencies | Phase 3 |
| Deliverables | Complete visit lifecycle |
| Acceptance | All PRD check-in and check-out steps pass; simultaneous check-ins can't share a card |
| Testing | TC-CARD-01, TC-CARD-03 to TC-CARD-16, TC-VIS-12, TC-VIS-14 |

## Phase 5: Excel imports

| Item | Detail |
|---|---|
| Objective | Candidate and card uploads |
| Tasks | Templates; upload validation; private storage; ExcelJS parsing; per-row import; results screen |
| Dependencies | Phases 3 and 4 |
| Deliverables | Both imports |
| Acceptance | Valid rows import and rejected rows are listed |
| Testing | TC-IMP-01 to TC-IMP-06, TC-CARD-02 |

## Phase 6: Notifications, Realtime, jobs

| Item | Detail |
|---|---|
| Objective | Live updates and alerts |
| Tasks | HR/Admin delivery recording; Telegram adapter for HR/Admin, built when the owner schedules it (OQ-4); retry; failure display with manual fallback; Realtime subscriptions; cron routes |
| Dependencies | Phase 4; OQ-14 (pending) for the retry schedule |
| Deliverables | HR/Admin alerts once Telegram is built, live screens, automatic no-shows |
| Acceptance | Check-in alerts reach HR/Admin only; failure never blocks check-in |
| Testing | TC-NOT-01 to TC-NOT-05, TC-NOT-08, TC-RT-01, TC-RT-02, TC-VIS-15 |

## Phase 7: Dashboard, reports, settings

| Item | Detail |
|---|---|
| Objective | Oversight screens |
| Tasks | Dashboard KPIs, graphs, timeline; history; reception home; report filters; PDF with PDFKit; Excel export; settings; apply [design tokens](11-ui-design-system.md) across screens |
| Dependencies | Phases 4 to 6. Dashboard figures cover today (OQ-2); brand tokens are fixed in [11](11-ui-design-system.md) (OQ-15). |
| Deliverables | All HR/Admin screens |
| Acceptance | Counts match the data; PDF generates on Vercel |
| Testing | TC-DASH-01 to TC-DASH-04, TC-RPT-01 to TC-RPT-04, TC-SET-01, TC-SET-02, TC-UI-01 |

## Phase 8: PWA, full testing, deployment

| Item | Detail |
|---|---|
| Objective | Ready for production |
| Tasks | Manifest and service worker; responsive pass; full regression; staging deployment; Google verification; backup test; production release |
| Dependencies | All previous phases; owner approval to release |
| Deliverables | Live system and verified runbook |
| Acceptance | [Release verification](09-deployment-guide.md#release-steps) passes |
| Testing | TC-UI-02 to TC-UI-05, the full catalogue |
