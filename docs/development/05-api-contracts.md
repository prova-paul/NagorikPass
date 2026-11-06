# 05. API Contracts

Part of the [Development PRD](DEVELOPMENT_PRD.md). Permissions are defined in [04](04-user-roles-and-permissions.md). Functions are defined in [03](03-database-design.md).

There is no public API. All Server Actions need a valid session and an active profile unless stated otherwise, and return `ActionResult` from [02](02-technical-architecture.md#error-handling).

Common errors: `not_authorized`, `validation_failed` (with `fieldErrors`), `unexpected_error`.

## Authentication

### `signIn` (Server Action)

| Field | Value |
|---|---|
| Purpose | Email and password sign-in |
| Auth | None |
| Input | `email`, `password`, optional `next` |
| Validation | Email format; password present |
| Database | `signInWithPassword`, then reads `user_profiles` |
| Success | Redirect to `next` if safe, otherwise role home |
| Errors | `invalid_credentials`, `not_authorized`, `deactivated` |

### `signInWithGoogle` (Server Action)

| Field | Value |
|---|---|
| Purpose | Start Continue with Google |
| Auth | None |
| Input | Optional `next` |
| Validation | `next` must be a same-site relative path, otherwise dropped |
| Work | `signInWithOAuth` with provider `google`, PKCE, `redirectTo` set to `/auth/callback`, and the company domain as Google's `hd` hint (a hint only, not a control) |
| Success | Redirect to the URL Supabase returns |
| Errors | `google_unavailable` |
| Database | None |

### `GET /auth/callback` (Route Handler)

| Field | Value |
|---|---|
| Purpose | Finish Google sign-in |
| Auth | None on entry. Proven by the one-time code. |
| Query | `code`, or `error` and `error_description`; optional `next` |
| Work | Exchange the code, check the verified email is in `COMPANY_EMAIL_DOMAIN` (OQ-11), read `user_profiles`, apply the outcome below |
| Side effects | None. No account, profile or role is created. |

| Case | Result |
|---|---|
| Email outside the company domain | Sign out, 302 `/login?reason=domain_not_allowed` |
| Active profile | 302 to safe `next`, or role home |
| No profile | Sign out, 302 `/login?reason=not_authorized` |
| Inactive profile | Sign out, 302 `/login?reason=deactivated` |
| `error=access_denied` | 302 `/login?reason=google_cancelled` |
| Sign-up refused by Supabase | 302 `/login?reason=not_authorized` |
| Missing or invalid code, or other error | 302 `/login?reason=google_failed` |

Provider error text is never shown or reflected. Only the fixed `reason` values above are displayed.

### `GET /auth/confirm` (Route Handler)

Handles invitation links. Query: `token_hash` or `code`. On success, redirects to the set-password page. On failure, `/login?reason=invite_invalid`.

### `GET /auth/denied` (Route Handler)

Ends the session and redirects to `/login` with the reason. Query: `reason`, either `no_profile` or `deactivated`. Used when a signed-in session is found to have no access.

### `setPassword` (Server Action)

Input: `password`. Needs an invitation session. Updates the Auth user. Errors: `weak_password`.

### `signOut` (Server Action)

Ends the session and clears cookies, for any sign-in method. Redirects to `/login`. Permission: `account.self`.

## Visits

| Action | Permission | Input | Database | Errors | Side effects |
|---|---|---|---|---|---|
| `registerVisit` | `visit.create` | `fullName`, `phone`, `purpose`, `category`, `organization?`, `guestsExpected?`, `invitedByEmployeeId?`, `invitedByName?`, `scheduledDate?`, `arrivalTime?`, `departureTime?` | `register_visit` | `phone_invalid`, `visitor_has_active_visit`, `host_inactive`, `delivery_receptionist_only` | Realtime event |
| `updateVisit` | `visit.update` | `visitId` and the same fields | `update_visit_details` | `visit_not_found`, `visit_not_editable`, `delivery_not_allowed`, `phone_invalid`, `visitor_has_active_visit`, `host_inactive` | Realtime event |
| `cancelVisit` | `visit.cancel` | `visitId`, `note?` | `cancel_visit` | `visit_not_found`, `visit_not_cancellable` | Realtime event |
| `logDeliveryVisitor` | `visit.log_delivery` | `fullName`, `phone`, `purpose`, `organization?` | `register_visit` with `delivery_courier` | `delivery_receptionist_only` | None. No notification. |
| `searchHosts` | `employee.directory_read` | `query` | `search_hosts`; returns `employee_id`, `full_name`, `team_name` only, active employees only | None | None |
| `assignVisitorCode` | `visitor.assign_code` | `visitorId`, `visitorCode` | `assign_visitor_code` | `visitor_not_found`, `visitor_code_required`, `visitor_code_already_set`, `visitor_code_exists` | None |

**Validation:** name, phone and purpose required; category one of eight; guests zero or more. Employees can't set Invited By; it is set to them. Receptionist entries use today's date.

- **Phone (OQ-5):** Bangladeshi mobile numbers only, normalized to `+8801XXXXXXXXX`. International numbers return `phone_invalid`.
- **One active visit (OQ-10):** a phone with an `expected` or `checked_in` visit returns `visitor_has_active_visit`. The message doesn't reveal anything about the existing visit: "This phone number already has a visit in progress. Contact reception or HR/Admin."
- **Host (OQ-8):** a deactivated employee can't be chosen as Invited By for a new visit (`host_inactive`).
- **Visitor ID (OQ-1):** never entered during registration. HR/Admin sets it once with `assignVisitorCode`; it is separate from any card number.

## Check-in and check-out

| Action | Permission | Input | Database | Errors | Side effects |
|---|---|---|---|---|---|
| `checkIn` | `visit.check_in` | `visitId`, `cardId`, `guestsActual?` | `check_in_visit` | `visit_not_found`, `delivery_not_permitted`, `visit_not_expected`, `invited_by_required`, `card_not_found`, `card_not_available` | One HR/Admin delivery row written and sent once Telegram is implemented (OQ-3, OQ-4); Realtime event |
| `checkOutConfirmReturn` | `visit.check_out` | `visitId`, `cardReturned` | `check_out_visit` | `visit_not_found`, `visit_not_checked_in` | On Yes: Realtime event. On No: nothing changes, and `{ completed: false }` is returned. |
| `resolveLostCard` | `card.resolve_loss` | `visitId`, `outcome` (`lost` or `damaged`), `note` | `resolve_lost_card` | `visit_not_found`, `visit_not_checked_in`, `invalid_outcome`, `note_required` | Audit row, Realtime event |

## Cards and imports

| Action | Permission | Input | Database | Errors |
|---|---|---|---|---|
| `createCard` | `card.manage` | `cardNumber` | Insert under RLS | `card_number_exists` |
| `updateCardNumber` | `card.manage` | `cardId`, `cardNumber` | `update_card_number`; history kept, audit row (OQ-7) | `card_not_found`, `card_number_required`, `card_number_exists` |
| `retireCard` | `card.manage` | `cardId`, `note?` | `retire_card` | `card_not_retirable` |
| `importCards` | `import.run` | `.xlsx` file | Storage, `import_batches`, inserts per row | `file_invalid`, `file_too_large` |
| `importCandidates` | `import.run` | `.xlsx` file | Storage, `import_batches`, `register_visit` per row with the batch ID | `file_invalid`, `file_too_large` |

Imports return `{ batchId, total, imported, rejected: [{ row, reason }] }`. A bad row doesn't stop the others (DEC-Q13).

**Candidate columns:** Name, Phone, Purpose, Organization, Date, Time, Invited By. Name, Phone, Purpose and Date are required. Invited By links to an employee when it exactly matches one active name, otherwise it is kept as typed (Proposal).

**Card column:** Card Number.

**Duplicates:** cards by number; candidates by phone and date. A candidate row whose phone already has an active visit is also rejected, with the reason "Phone already has a visit in progress" (OQ-10).

**Candidate phones:** Bangladeshi numbers only, like every visitor phone (OQ-5).

## People

| Action | Permission | Input | Work | Errors |
|---|---|---|---|---|
| `createTeam`, `updateTeam` | `team.manage` | `name` | Under RLS | `team_exists` |
| `createEmployee` | `employee.manage` | `fullName`, `teamId`, `workEmail`, `phone?` | Directory entry, then invitation and profile with role `employee`, using the service role. Phone is optional (OQ-6). | `email_exists`, `email_domain_not_allowed`, `invite_failed` |
| `updateEmployee` | `employee.manage` | `employeeId` and fields | Under RLS | `email_exists`, `email_domain_not_allowed` |
| `setEmployeeActive` | `employee.manage` | `employeeId`, `active` | Deactivating calls `deactivate_employee`, then bans the Auth user with the service role. Visits are kept, and HR/Admin is notified of each affected upcoming visit (OQ-8). Returns `{ affectedVisits }`. Reactivating updates directory and profile. Audit row either way. | `employee_not_active` |
| `inviteUser` | `receptionist.manage` | `fullName`, `email`, `role` (`receptionist`; `hr_admin` by HR/Admin) | Invitation and profile, using the service role; audit row | `email_exists`, `email_domain_not_allowed`, `invite_failed` |
| `setUserActive` | `receptionist.manage` | `userId`, `active` | Updates profile and Auth ban; audit row | `cannot_deactivate_self` |

## Settings and notifications

| Action | Permission | Input | Database | Errors |
|---|---|---|---|---|
| `updateSettings` | `settings.manage` | `organizationName`, `timeZone`, `notificationChannel`, `hrTelegramChatId` | `app_settings` under RLS | None |
| `retryNotification` | `notification.retry` | `deliveryId` | Sends, then updates the row using the service role. HR/Admin deliveries only. | `delivery_not_found`, `send_failed` |

## Route Handlers

| Route | Auth | Permission | Input | Response | Errors |
|---|---|---|---|---|---|
| `GET /api/reports/visits.pdf` | Session | `report.export` | `from`, `to`, `category?`, `status?`, `hostId?` | PDF | 401, 403, 422 |
| `GET /api/reports/visits.xlsx` | Session | `report.export` | Same | `.xlsx` | 401, 403, 422 |
| `GET /api/cron/mark-no-shows` | `CRON_SECRET` | Service | None | `{ updated }` | 401 |
| `GET /api/cron/retry-notifications` | `CRON_SECRET` | Service | None | `{ retried, failed }` | 401 |

Vercel Cron is the only outside caller. There is no Telegram webhook, because employees don't link Telegram (OQ-4).

## Reads

Dashboard, history, lists and monitoring are Server Component reads under RLS, with no separate endpoints. Realtime covers `visits` and `visitor_cards`.
