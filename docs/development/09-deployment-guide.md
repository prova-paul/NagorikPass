# 09. Deployment Guide

Part of the [Development PRD](DEVELOPMENT_PRD.md).

**Nothing here has been done.** These are future steps. No hosted, Google Cloud, Vercel or Telegram settings have been changed. Each step needs authorization at the time.

## Environments

| Environment | Application | Supabase | Purpose |
|---|---|---|---|
| Development | Local Next.js | Local Supabase CLI | Daily work |
| Staging | Vercel preview or staging | Separate project | Pre-release checks, including real Google sign-in |
| Production | Vercel production | Separate project | Live |

Staging may add cost (DEC-T8). Environments never share data or credentials.

## Environment variables

Names only. Real values never go in the repo or in documentation.

| Variable | Scope | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Supabase client |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Invitations, deactivation, jobs |
| `COMPANY_EMAIL_DOMAIN` | Server only | Google domain check and company-email validation (OQ-11, OQ-12). **Value to be provided by the owner.** |
| `TELEGRAM_BOT_TOKEN` | Server only | HR/Admin notifications, when Telegram is implemented (OQ-4) |
| `CRON_SECRET` | Server only | Cron routes |

Google's client ID and secret aren't Next.js variables. They live in Supabase.

## Google Sign-In configuration

Required per environment before Google can be enabled.

### Google Cloud Console

1. Choose a project, and configure the OAuth consent screen: app name, support email, authorized domain. Sign-in is limited to the company Google Workspace (OQ-11), so the **Internal** user type fits when the project belongs to that Workspace. The server-side domain check applies either way.
2. Request only the `openid`, `email` and `profile` scopes.
3. Create an OAuth client of type **Web application**.
4. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`. This is Supabase's address, not the app's. Local development uses the Supabase CLI equivalent.
5. Authorized JavaScript origins: the application's address in that environment.

### Supabase Auth

1. Enable the Google provider, and enter the client ID and secret.
2. Set the Site URL to the application's address.
3. Add `https://<app-domain>/auth/callback` and `https://<app-domain>/auth/confirm` to the Redirect URLs allow list. Avoid wildcards in production.
4. **Confirm public sign-up is disabled.** It was on for the hosted project at the last check. It must be off before Google is enabled.
5. Set `COMPANY_EMAIL_DOMAIN` in the application's server environment. Google can't be enabled until the owner provides the domain.
6. Locally, `supabase/config.toml` needs an `[auth.external.google]` section reading from local env. It already has `enable_signup = false`.

### Verification on staging

Real Google logins, for each case: an authorized user for each role, an unknown company account, a personal Google account, an inactive account, and cancelling. Also run TC-AUTH-10 before production.

## Other external setup

| Service | Needed |
|---|---|
| Telegram | Bot token and the HR/Admin chat ID, when the owner implements it (OQ-4). No webhook. |
| Email | A production email service for invitations. **Provider pending (OQ-13).** |
| Vercel | Project, env variables, Cron from `vercel.json`. **Plan pending (OQ-14):** the daily No-Show job works on any plan; the notification retry schedule depends on the plan. |
| Storage | Private `imports` bucket |

## Database migrations

- Migrations live in `supabase/migrations`, are reviewed, and are applied by Supabase CLI to staging first, then production.
- **Nothing is applied without an approved migration plan.** The plan depends on Phase 0, because the hosted project may already contain earlier migrations.
- Migrations are forward-only. Risky changes get a written backout.

## Release steps

1. CI passes: types, lint, unit and integration tests, database tests, production build.
2. Apply migrations to staging, deploy, and run end-to-end tests and the manual Google checklist.
3. Back up production.
4. Apply migrations to production, then deploy.
5. Verify: sign-in for each role with password and company Google, a personal Google account refused, one check-in and check-out, one HR/Admin notification once Telegram is implemented, one report, and that cron runs.

## Backup and recovery

Use Supabase backups according to the plan, and confirm the plan's retention before go-live, since visitor data is kept indefinitely (DEC-Q20). Test a restore on staging before go-live. Storage files need their own check, because database backups don't include them.

## Rollback

- **Application:** promote the previous Vercel deployment.
- **Database:** apply a forward fix or the written backout. Restore from backup only as a last resort, since it loses newer visits.
- **Google:** the provider can be disabled in Supabase at once, and email and password sign-in keeps working.
- **Notifications:** a Telegram outage needs no rollback; the manual fallback applies (OQ-9: calls aren't recorded).
