# 07. Security Guidelines

Part of the [Development PRD](DEVELOPMENT_PRD.md).

## Principles

1. Authentication proves identity. Authorization comes only from an active profile and its role.
2. The database is the final enforcement point. Hiding a control isn't security.
3. Secrets stay on the server or in the provider's own configuration.

## Supabase Auth and sessions

- Sessions use secure, HTTP-only cookies through `@supabase/ssr`.
- Server code validates users with `getUser()`, which checks with Supabase, not with cookie contents alone.
- Sign-out ends the session and clears cookies, whichever method was used.
- Public sign-up is **disabled** in every environment. Invitations still work with this setting.
- Hosted sign-up must be checked before Google is enabled. It was on at the last check.

## Google OAuth

### Authorization rules

| Rule | Enforcement |
|---|---|
| Only company Google Workspace accounts can sign in (OQ-11) | `/auth/callback` checks the verified email against `COMPANY_EMAIL_DOMAIN` and signs out anything else |
| Google grants no role or permission | Role comes only from `user_profiles` |
| No privileged or any other account is created from a Google email or domain | Profiles only come from `inviteUser` and `createEmployee`; no trigger on `auth.users` |
| An unknown Google account is refused | Public sign-up disabled |
| If an Auth user still exists without a profile | `auth_role()` returns nothing, so RLS denies all data, and the session is ended at `/auth/callback` and on later requests |
| An inactive user is refused | `/auth/callback` and `auth_role()` both check `is_active` |
| Role is checked on every request | Server checks and RLS, not only at sign-in |

Keep the second safeguard even with sign-up disabled, so a settings mistake doesn't grant access.

### Callback rules

| Rule | Reason |
|---|---|
| Use the PKCE flow | The code is useless without the verifier held in the browser's cookie |
| Redirect URLs are an exact allow list per environment; no broad wildcards in production | Stops codes being sent elsewhere |
| `next` must be a same-site relative path, and is otherwise ignored | Prevents open redirects |
| Show only fixed messages | Provider error text can't be reflected into the page |
| The callback is public but does nothing without a valid code | Required for the flow |

### Account takeover

Supabase links identities by email only when the provider has verified that email. Linking relies on this behavior, and it must be verified in Phase 1 (TC-AUTH-10). If it differs, Google must be limited to accepted invitations, and this document updated.

### Company domain (OQ-11, OQ-12)

- Google Sign-In is limited to the company Google Workspace domain. Personal Google accounts are refused.
- The check runs on the server in `/auth/callback`, against the email that Google has verified. Google's `hd` parameter is also sent, but only as a hint for the account picker. It isn't a security control.
- Passing the domain check doesn't authorize anyone. The user still needs an active `user_profiles` row with a role.
- Invitations and employee records accept only company email addresses, checked on the server by `createEmployee`, `updateEmployee` and `inviteUser`. A personal email can't be linked to an employee account.
- The domain value is configuration, `COMPANY_EMAIL_DOMAIN`. **It isn't documented yet and must come from the owner.** Until then it is a placeholder, and Google Sign-In can't be enabled.

### Departing staff

Deactivating in NagorikPass is what removes access. Removing someone's Google account alone isn't enough, because a password identity or existing session may remain. `setUserActive` deactivates the profile and bans the Auth user.

## Secrets

| Secret | Where it lives | Never |
|---|---|---|
| Google OAuth client secret | Supabase Auth provider settings; local CLI env for development | In Next.js env, frontend code or the repo |
| Google OAuth client ID | Supabase Auth provider settings | Hard-coded |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel server env | `NEXT_PUBLIC_*`, client bundles, logs |
| `TELEGRAM_BOT_TOKEN` (when Telegram is implemented) | Vercel server env | Client bundles, logs |
| `CRON_SECRET` | Vercel server env | Client bundles, logs |

**Service-role use is limited to:** invitations and profile creation, deactivating Auth users, scheduled jobs, and notification status updates. These modules import `server-only`.

Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` reach the browser, and they are safe only because RLS is on every table.

## RBAC and RLS

- RLS is enabled on every table, and anonymous users have no grants.
- Users have no direct write access to `visits`, `visitors`, `card_assignments` or `user_profiles`.
- `security definer` functions set `search_path = ''` and check the role themselves.
- Helper functions that aren't for users, such as `require_role`, aren't executable by `authenticated`.
- Details are in [03](03-database-design.md).

## Input validation

- Zod on client and server; database constraints have final say.
- Visitor phones: Bangladeshi numbers only, normalized to `+880…` on the server and checked again by the database (OQ-5).
- Queries use Supabase's parameterized methods and typed function parameters. SQL is never assembled from input.
- Search input is treated as text, and result sizes are capped.

## File uploads and Excel

- `.xlsx` only, checked by content as well as name.
- Limits on size and rows, set in implementation within platform limits.
- Formulas are never evaluated; only cell values are read.
- Stored in a private bucket, HR/Admin only.
- Exports escape values starting with `=`, `+`, `-` or `@`.

## Sensitive data

| Data | Rule |
|---|---|
| Employee email and phone | HR/Admin and the employee only; Receptionists get name and team only |
| Visitor phone | Staff, and the employee on their own visits |
| Identity documents | Not stored (DEC-Q19) |
| Notifications | Go to HR/Admin only (OQ-3). They contain visitor name and phone (PRD §6.3), so the HR/Admin Telegram chat must be access-controlled |
| Logs | No passwords, tokens or OAuth codes; avoid personal data |
| Retention | Indefinite (DEC-Q20), with no deletion process. Revisit against legal obligations. |

## Audit logging

Limited to account changes, card retirement, card number corrections and lost-card closures (DEC-T9, OQ-7). Rows are written by server or database code and HR/Admin can only read them. Failed sign-ins are left to Supabase Auth logs.

## Cron

- Cron routes require `CRON_SECRET`.
- There is no Telegram webhook, because employees don't link Telegram (OQ-4).

## Decisions still needed

OQ-13 (production email service for invitations) is pending. The company domain value for OQ-11 and OQ-12 is needed from the owner. See [Development PRD §14](DEVELOPMENT_PRD.md#14-open-questions-and-decisions).
