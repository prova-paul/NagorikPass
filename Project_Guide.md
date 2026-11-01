# NagorikPass — Project Guide

## 1. Project Overview

**Project name:** NagorikPass  
**Tagline:** Smart Visitor Management. Seamless Workplace Access.

NagorikPass is a browser-based Visitor Management System that helps HR/Admin, Receptionists, and Employees manage visitor requests, approvals, check-ins, check-outs, and visit history.

## 2. Design Reference

The primary UI reference is VisitX.

Use screenshots in `design_references/visitx/`.

Follow this visual direction:
- Dark navy sidebar
- Purple primary accent
- Light grey/lavender dashboard background
- White cards and tables
- Modern typography
- Rounded cards and controls
- Clean dashboard charts and calendar
- Professional visitor-management layout

Initial palette:
- Primary purple: `#7560E8`
- Sidebar navy: `#171A3B`
- Main background: `#F5F6FA`
- Card background: `#FFFFFF`
- Main text: `#252641`
- Secondary text: muted grey
- Success: green
- Warning: orange
- Danger: red

Do not use NagorikEats's warm cream color scheme.

## 3. User Roles and Permissions

There are exactly three application login roles:

1. **HR/Admin**
2. **Receptionist**
3. **Employee**

Keep employee records separate from application login accounts. Employees can have login accounts to submit visitor requests and approve unexpected visitor requests addressed to them.

### HR/Admin
- Manage visitors, employees, receptionists, and settings.
- Pre-register visitors.
- Review and approve or reject visitor requests.
- Give final approval for every visitor's entry. No visitor enters without HR/Admin approval.
- View reports and visitor history.
- Export and share reports according to permissions.

### Receptionist
- View expected visitors and visitor history.
- Register unexpected visitors.
- Submit entry approval requests to HR/Admin for every arriving expected visitor, whether pre-registered by HR/Admin or requested by an employee.
- Verify visitor identity.
- Check in only visitors eligible for entry.
- Check out visitors.
- View only the employee information needed for visitor coordination.

Receptionists must never receive employee official email addresses or private employee contact information through the UI or API.

### Employee
- Submit visitor requests for HR/Admin approval.
- Review unexpected visitor requests addressed to them.
- Approve or reject those requests.
- View only their own requests and relevant visitor information.

Employees cannot perform Admin or Receptionist actions.

## 4. HR/Admin Features

- Dashboard
- Visitor Management
- Add New Visitor / Pre-register
- Expected Visitors
- Visitor History
- Employee Management
- Receptionist Management
- Reports
- Settings
- Visitor request approvals

Admin dashboard statistics:
- Total Visitors
- Expected Visitors Today
- Currently Checked-in
- Pending Approvals
- Completed Visits
- Rejected Visits

Dashboard analytics should use actual visit data, including the activity calendar, daily arrivals/departures, and visitor countdowns.

## 5. Receptionist Features

- Dashboard
- Expected Visitors
- Add Unexpected Visitor
- Pending Approvals / Entry Requests
- Checked-in Visitors
- Visitor History

Receptionist dashboard statistics:
- Expected Visitors Today
- Currently Checked-in
- Pending Approvals
- Completed Visits Today

## 6. Employee Features

- Employee Dashboard
- Submit Visitor Request
- My Visitor Requests
- Unexpected Visitor Approvals

Employees can:
- Submit visitor details, purpose, host information where applicable, and scheduled visit times.
- View the status of their own requests.
- Approve or reject unexpected visitor requests addressed to them.

Employees cannot approve their own requests.

## 7. Workflow A — HR/Admin Pre-registers a Visitor

1. HR/Admin creates a visitor record with visitor details, purpose, scheduled arrival/departure, and one or more hosts.
2. The system saves the visitor as an expected visit.
3. The visitor appears in the Receptionist's Expected Visitors list.
4. When the visitor arrives, the Receptionist finds and verifies the visitor.
5. The Receptionist submits an entry approval request to HR/Admin.
6. HR/Admin approves or rejects the entry request.
7. Only after approval can the Receptionist check in the visitor.
8. The system records the actual check-in timestamp separately from the scheduled arrival.
9. The system notifies the selected hosts that the visitor has arrived.
10. The Receptionist checks out the visitor when the visit ends.
11. The system records the actual check-out timestamp separately from the scheduled departure.

## 8. Workflow B — Employee Submits a Visitor Request

1. Employee logs in and submits a visitor request with visitor details, purpose, scheduled arrival/departure, and any required host information.
2. The request goes directly to HR/Admin.
3. HR/Admin approves or rejects the request.
4. If approved, the visit becomes an expected visit and appears in the Receptionist's Expected Visitors list. This approval allows the visit to take place; it does not approve entry.
5. When the visitor arrives, the Receptionist verifies the visitor's identity and submits an entry approval request to HR/Admin.
6. HR/Admin approves or rejects the entry request.
7. Only after entry approval can the Receptionist check in the visitor.
8. The system records actual check-in and check-out timestamps separately from scheduled times.

## 9. Workflow C — Unexpected Visitor Arrives at Reception

1. Receptionist registers the unexpected visitor and selects the employee they want to meet.
2. The system creates a request with status `pending_host_approval`.
3. The selected host employee receives a notification.
4. The employee approves or rejects the request.
5. If rejected, the request ends as rejected and cannot proceed to check-in.
6. If approved, the request automatically moves to HR/Admin with status `pending_admin_approval`.
7. HR/Admin gives final approval or rejection.
8. If Admin rejects, the visitor cannot check in.
9. If Admin approves, the visitor becomes eligible for check-in.
10. Receptionist verifies the visitor's identity and checks them in.
11. The system records actual check-in and notifies the relevant host.

## 10. Approval and Check-in Rules

- No visitor may enter without HR/Admin approval of that entry. Every workflow ends with HR/Admin approval before check-in.
- A visitor cannot check in while any required approval is pending.
- A rejected request cannot check in.
- Employee approval is required before Admin approval for unexpected visitors.
- Admin approval is final for unexpected visitor entry.
- Admin pre-registered visitors require Receptionist-submitted entry approval and Admin approval at arrival, every time.
- Employee-submitted requests require Admin approval before appearing as expected visitors, and Receptionist-submitted entry approval and Admin approval again at arrival.
- Only authorized Receptionists can perform check-in and check-out.
- Enforce these rules in backend APIs, not only in the frontend.
- Record each approval decision, actor, timestamp, and reason where provided.

## 11. Visitor and Approval Statuses

Use clear statuses appropriate to each workflow.

### Visit statuses
- `pending_employee_request`
- `pending_host_approval`
- `pending_admin_approval`
- `expected`
- `awaiting_entry_approval`
- `approved`
- `rejected`
- `checked_in`
- `checked_out`
- `cancelled`

### Approval statuses
- `pending`
- `approved`
- `rejected`
- `expired`

Keep approval records and visit status transitions auditable. Do not use one generic `pending_approval` status when the system needs to distinguish host approval, Admin approval, and entry approval.

## 12. Meeting With Feature

Support selecting one or multiple employees where the workflow permits.

Display to Receptionists:
- Employee ID
- Employee name
- Department
- Designation

Never expose employee official email or private contact information in receptionist-facing UI or API responses.

Store selected hosts in a separate `visit_hosts` relationship.

## 13. Time and Visit Analytics

Store scheduled and actual timestamps separately:
- `scheduled_arrival_at`
- `scheduled_departure_at`
- `actual_check_in_at`
- `actual_check_out_at`

Calculate arrival delay as actual check-in minus scheduled arrival.

Calculate departure delay as actual check-out minus scheduled departure.

Show countdowns for upcoming arrivals and scheduled departures. Update countdowns dynamically and handle pending, cancelled, completed, and overdue visits correctly.

Dashboard calendar and charts must be derived from visit records, not hardcoded UI values.

## 14. Report Export and Sharing

Admin reports may support:
- PDF export
- Editable DOCX export
- CSV export
- Native device/browser sharing
- Copying a report link

Exports must respect selected date ranges and filters.

Do not create public report links by default. Persistent sharing links must use secure, expiring, revocable tokens and enforce authorization.

Receptionist reports must not contain employee emails or private employee information.

## 15. Suggested Technology Stack

Frontend:
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router

Backend:
- Node.js
- Express.js

Database:
- PostgreSQL

Email:
- SMTP or transactional email service

Authentication:
- Secure session-based or token-based authentication
- Role-based authorization

Never hardcode real credentials or secrets.

## 16. Development Rules

- Inspect the existing architecture before editing.
- Build one feature at a time.
- Reuse common components and design tokens.
- Keep frontend, backend, and database logic organized.
- Use responsive layouts.
- Use realistic mock data during frontend development.
- Do not claim mock data is connected to a real backend.
- Validate all form inputs.
- Protect all routes and API endpoints by role.
- Enforce approval order and check-in restrictions on the backend.
- Record visitor activity and approval decisions in an audit log.
- Never expose employee private information to Receptionists.
- Ask before deleting or overwriting existing files.
- Preserve existing functionality unless a change is explicitly required.

## 17. Development Order

1. Inspect screenshots and prepare the design system.
2. Build login and shared dashboard layouts.
3. Build HR/Admin pages.
4. Build Receptionist pages.
5. Build Employee pages and request workflows.
6. Add realistic mock data and frontend interactions.
7. Build backend APIs, database, and authentication.
8. Implement role-based authorization and approval state transitions.
9. Implement email notifications and secure approval links.
10. Test permissions, workflows, exports, and responsive layouts.
