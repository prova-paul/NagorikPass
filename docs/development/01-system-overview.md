# 01. System Overview

Part of the [Development PRD](DEVELOPMENT_PRD.md). Business source: [Requirement PRD](../source/REQUIREMENT_PRD.md).

## Purpose

NagorikPass replaces manual visitor logs with one system that records who visits, who invited them, when they arrived and left, and which visitor card they held.

## Glossary

| Term | Meaning |
|---|---|
| Directory employee | A person in `employees`, who can be named as a host |
| Authenticated user | A Supabase Auth account in `auth.users` |
| Identity | One way of proving who a user is, such as email and password, or Google. One user can have several. |
| Authorized account | An authenticated user with an active `user_profiles` row and a role |
| Role | HR/Admin, Receptionist or Employee |
| Permission | A specific allowed action, granted through a role |
| Visitor | A person identified by phone number, with no login |
| Visit | One occasion a visitor is expected or attends |
| Invited By | The employee a visitor is there to see. PRD "host employee" and "Invited By" are one field (DEC-Q7). |
| Visitor ID | A visitor's permanent identifier, assigned by hand by HR/Admin once (OQ-1). Not a card number. |
| Visitor card | A reusable physical card with a unique card number. Issued at check-in and Available again after a confirmed return, ready for the next visitor. |
| Active visit | A visit that is `expected` or `checked_in`. One phone number can have only one at a time (OQ-10). |
| Check-out | Completed only when the Receptionist confirms the card came back |

## Actors

| Actor | Authenticates? | Responsibilities | Source |
|---|---|---|---|
| HR/Admin | Yes | Manages employees, receptionists, visitor records, cards, imports, reports, settings; resolves lost cards | PRD §3, DEC-Q4 |
| Receptionist | Yes | Handles arrivals, registers unscheduled visitors, checks in and out, issues and receives cards | PRD §3 |
| Employee | Yes | Registers and coordinates their own visitors | PRD §3, §5B |
| Visitor | No | Provides details, receives and returns the card | PRD §4 |
| Delivery/Courier | No | Logged only, never admitted | PRD §5, DEC-Q8 |
| Project owner | Setup only | Creates the first HR/Admin | DEC-Q9 |
| Google | External | Verifies identity for Continue with Google, for company Workspace accounts only. Grants nothing in NagorikPass. | DEC-G1, OQ-11 |
| Telegram | External | Delivers notifications to HR/Admin only. Implemented later by the owner. | DEC-Q12, OQ-3, OQ-4 |

A directory employee and an authenticated user are different things. A Receptionist or HR/Admin account needs no directory entry, while an Employee account always links to one. Every employee gets a login (DEC-Q9).

## Modules

| Module | Purpose | Users | Inputs and outputs | Depends on | Workflows | Entities |
|---|---|---|---|---|---|---|
| Authentication and access | Sign-in, role routing, sign-out | All | Password or Google identity, then a session | Supabase Auth, Google | All | `user_profiles` |
| Dashboard | Counts, graphs, timeline, live activity | HR/Admin | Visits, then live view | Visits, Realtime | All | `visits`, `card_assignments` |
| Visitor Management | Expected visitors, VIP visits, imports, Visitor IDs | HR/Admin | Forms and Excel, then expected visits | Directory | A, E, F | `visitors`, `visits`, `import_batches` |
| Visitor History | Search past visits | HR/Admin | Filters, then records | Visits, Cards | All | `visits`, `card_assignments` |
| Visitor Cards | Register, correct numbers, monitor, retire, resolve loss | HR/Admin | Form and Excel, then card pool | None | Check-in and check-out | `visitor_cards`, `card_assignments` |
| Employee Management | Directory and teams; deactivation keeps visits and notifies HR/Admin of affected upcoming visits | HR/Admin | Forms, then directory and invitation | Teams, Auth | B, C | `employees`, `teams` |
| Receptionist Management | Accounts and access | HR/Admin | Forms, then accounts | Auth | None | `user_profiles` |
| Reports | Arrival and departure data, PDF and Excel | HR/Admin | Filters, then files | History | None | `visits` |
| Settings | Organization, time zone, notification configuration | HR/Admin | Values, then configuration | None | Notifications | `app_settings` |
| Reception Home | Daily counts and list | Receptionist | Visits, then view | Visits | All | `visits` |
| Expected Visitors | Find, verify, check in | Receptionist | Search, then check-in | Cards | A, B, E, F | `visits`, `visitor_cards` |
| Add New Visitor | Unscheduled registration, host search, courier log | Receptionist | Form, then visit | Directory | C, D, Delivery | `visitors`, `visits` |
| Check-in and Check-out | Card issue and return | Receptionist | Card and Yes/No, then state change | Cards, Notifications | All | `visits`, `card_assignments` |
| Employee App | Add, view, edit, cancel own visitors | Employee | Form, then expected visit | Auth | B | `visits` |
| Notifications | Alert at check-in, with manual fallback | HR/Admin only (OQ-3) | Check-in, then message | Telegram | All | `notification_deliveries` |
| Interview Candidate Import | Excel into Expected Visitors | HR/Admin | File, then visits and rejected list | ExcelJS, Storage | E | `import_batches`, `visits` |

## Module dependencies

Auth and roles come first, then Directory, Visitors and visits, Cards, and Check-in and Check-out. Notifications, Realtime, Dashboard, History and Reports depend on those. Imports depend on visits and cards.

## Non-functional summary

| Area | Position | Source |
|---|---|---|
| Live updates | HR/Admin dashboard and reception lists update automatically | PRD §5, §8 |
| Mobile | Receptionist is a responsive PWA; offline use isn't included | PRD §8 |
| Language and time | English; Asia/Dhaka | DEC-Q20 |
| Phone numbers | Bangladeshi only, stored as `+880…` | OQ-5 |
| Sign-in accounts | Company email and company Google Workspace accounts only | OQ-11, OQ-12 |
| Scope | One organization, one site | DEC-Q20 |
| Retention | Indefinite | DEC-Q20 |
| Performance and availability | No fixed targets | DEC-Q20 |

Decisions and open questions: [Development PRD §14](DEVELOPMENT_PRD.md#14-open-questions-and-decisions).
