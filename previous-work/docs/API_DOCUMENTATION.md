# NagorikPass — API and Data Operations

## 1. Status
The PRD specifies Supabase as the backend platform but does not define REST endpoint paths or a separate API server. This document describes logical operations, not finalized HTTP routes.

## 2. Operation groups
### Authentication
- Sign in
- Sign out
- Retrieve current authenticated profile and role
- Password reset/account recovery (confirm desired flow)

### HR/Admin
- List/search visitors and visits
- Create expected visitor
- Update visitor/visit details according to lifecycle rules
- Manage employees and receptionists
- Register visitor card
- Bulk import visitor cards
- Import interview candidates
- List card status and assignment history
- Retrieve dashboard metrics
- Generate visitor reports

### Receptionist
- List expected visitors
- Search permitted employee directory fields (name/team only)
- Register unscheduled visitor
- Check in visitor with selected available card
- Check out visitor after explicit card-return confirmation
- View today's visitor list and operational status

### Employee
- Create visitor registration without HR approval
- List own registered visitors/visits
- View relevant visit status

## 3. Critical operation contracts
### `check_in_visit`
Input (logical):
- visit ID
- selected visitor card ID

Must:
- Verify authenticated user has receptionist permission.
- Verify visit can be checked in.
- Reject Delivery/Courier category.
- Verify card is Available.
- Create card assignment history row.
- Set card to Issued.
- Set visit to Checked In and record timestamp.
- Commit all changes atomically.
- Return updated visit and card summary.

### `check_out_visit`
Input (logical):
- visit ID
- `card_returned` boolean

Must:
- Verify authenticated user has receptionist permission.
- If `card_returned` is false, leave visit Checked In and card Issued; return an incomplete-checkout result.
- If true, record returned timestamp, set card Available, and set visit Checked Out atomically.
- Preserve assignment history.

## 4. Excel import operations
Two import categories are required:
- Visitor card bulk registration
- Interview candidate import

Before implementation, confirm:
- Exact column names and sample files.
- Accepted formats (PRD gives Excel; confirm `.xlsx` and `.xls` support).
- Maximum file size and row count.
- Duplicate handling.
- Invalid row behavior and downloadable error report.
- Whether imports are all-or-nothing or partially successful.

## 5. Notifications
Logical event: visitor check-in (and card issuance).
Recipients:
- HR/Admin
- Registering employee for employee-initiated visitors

WhatsApp or Telegram is conditional on integration availability. Provider, message templates, opt-in/consent, retries, delivery status, and fallback must be approved.

## 6. Error handling
Use stable, user-safe error categories, for example:
- unauthenticated
- forbidden
- validation_error
- visitor_not_found
- invalid_visit_state
- delivery_not_permitted
- card_unavailable
- card_already_assigned
- card_return_not_confirmed
- import_validation_failed
- integration_unavailable

Do not expose secrets, SQL internals, or private employee data in client-visible errors.
