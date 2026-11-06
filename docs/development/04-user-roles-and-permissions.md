# 04. User Roles and Permissions

Part of the [Development PRD](DEVELOPMENT_PRD.md).

## Concepts

| Concept | Stored in | Meaning |
|---|---|---|
| Authenticated user | `auth.users` | Someone with a login. Proves identity only. |
| Identity | Supabase Auth | Password or Google. One user can have both. |
| Authorized account | `user_profiles` | A user with an active profile and a role |
| Directory employee | `employees` | A person who can be a host |
| Role | `user_profiles.role` | `hr_admin`, `receptionist` or `employee`; one per person |
| Permission | Code, and enforced by policies and functions | A specific action |

Three fixed roles with one role per person need no permission tables (DEC-T10). The user-to-role link is the `role` column. The role-to-permission link is the matrix below, applied in server code and in the database.

## Permission matrix

| Permission | HR/Admin | Receptionist | Employee |
|---|---|---|---|
| `visit.create` | Yes | Yes, unscheduled, today | Own |
| `visit.log_delivery` | No | Yes | No |
| `visit.read` | All | Expected, checked in and today's | Own |
| `visit.update` (before check-in) | Yes | Yes | Own |
| `visit.cancel` (before check-in) | Yes | No | Own |
| `visit.delete` | No | No | No |
| `visit.approve`, `visit.reject` | Removed (DEC-Q1) | Removed (DEC-Q1) | Removed (DEC-Q1) |
| `visit.check_in`, `visit.check_out` | No | Yes | No |
| `card.read` | Yes | Yes | No |
| `card.manage` (register, import, edit number, retire) | Yes | No | No |
| `card.resolve_loss` | Yes | No | No |
| `visitor.assign_code` (Visitor ID) | Yes | No | No |
| `import.run` | Yes | No | No |
| `report.view`, `report.export`, `history.view`, `dashboard.view` | Yes | No | No |
| `reception_home.view` | No | Yes | No |
| `employee.manage`, `team.manage` | Yes | No | No |
| `employee.directory_read` | Full record | Name and team only | No |
| `receptionist.manage` | Yes | No | No |
| `settings.manage` | Yes | No | No |
| `audit.read` | Yes | No | No |
| `notification.receive` | Yes | No | No (OQ-3) |
| `notification.retry` | Yes | Yes | No |
| `account.self` (sign in, Google, sign out) | Yes | Yes | Yes |

## Account authorization

### How someone gets a role

1. HR/Admin creates a directory entry or receptionist account (`createEmployee` or `inviteUser`), using a company email address. Personal email addresses are refused (OQ-12).
2. The server creates the Auth user through an email invitation, and creates the `user_profiles` row with the assigned role. This is the only way a profile is created. The first HR/Admin is created once by the project owner during setup.
3. The person can then sign in with their password or with Google.

### Google-authenticated users

Google proves who someone is. It never decides what they can do.

- **Company domain only (OQ-11):** the server accepts a Google sign-in only when the verified email is in the company Google Workspace domain (`COMPANY_EMAIL_DOMAIN`, a placeholder until the owner provides it). Personal Google accounts are refused. Passing this check grants nothing by itself.

- **Role source:** a Google user's role comes only from their existing `user_profiles` row, created in advance by HR/Admin.
- **No automatic access:** no profile, role or employee record is ever created from a Google email address or domain. No database trigger may create a profile from a new `auth.users` row.
- **Matching:** Supabase links the Google identity to the existing account when the verified Google email equals the invited email. The `user_id` stays the same, so the profile still applies. Phase 1 must verify this for accepted and not-yet-accepted invitations (TC-AUTH-10).
- **Mismatch:** a Google account with a different email has no authorized account and is denied. Linking a personal email to an employee account isn't supported (OQ-12).

### Outcomes after authentication

| Situation | Result | Message |
|---|---|---|
| Active profile with a role | Redirect to role home | None |
| Google account outside the company domain | Session ended, denied | "Use your company Google account to sign in." |
| Google account unknown, public sign-up disabled | Supabase refuses; no account created | "This Google account doesn't have access to NagorikPass. Contact HR/Admin." |
| Authenticated, but no profile | Session ended, denied | Same as above |
| Profile inactive | Session ended, denied | "Your account has been deactivated. Contact HR/Admin." |
| User cancels at Google | Returned to login, no session | "Google sign-in was cancelled." |
| Google or callback failure | Returned to login, no session | "Google sign-in failed. Please try again." |

These checks apply on every request, not only at sign-in. Deactivating someone removes access at once, because `auth_role()` returns nothing for an inactive profile.

## Access boundaries

- **Role source:** always read from `user_profiles`, never from the browser or from token claims supplied by the client.
- **Employees:** "own" means `registered_by` is them, or `invited_by_employee_id` is their directory entry (DEC-Q10). They have no directory access and no access to `visitors`.
- **Phone matching:** registration matches a phone number inside a function that returns nothing about the existing visitor, so an employee can't discover who a number belongs to (DEC-Q6).
- **Receptionists:** have no direct `employees` access. `search_hosts` returns only name and team (PRD §7).
- **Inactive users:** blocked in server code and by `auth_role()`.
- **Deactivated hosts (OQ-8):** their visits stay, but they can't be chosen as Invited By for new visits.
- **Team or department limits:** none, because the PRD requires none.

## How RBAC and RLS work together

```text
Request → server loads profile and checks permission (fast, clear error)
        → database RLS or function checks role again (cannot be bypassed from the app)
```

RLS works on rows, so column-level needs use functions, as with `search_hosts`. Functions run as `security definer`, so each one checks the role itself using `require_role`. The exact policies are in [03-database-design.md](03-database-design.md).

The service-role key bypasses RLS. It is limited to the server-only cases listed in [07-security-guidelines.md](07-security-guidelines.md#secrets).
