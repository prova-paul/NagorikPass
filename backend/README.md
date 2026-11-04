# NagorikPass Backend

> **Legacy notice (2026-11-04).** This describes the original Express and PostgreSQL application. The frontend is now Next.js with Supabase (see `frontend/README.md` and `docs/IMPLEMENTATION_TRACKER.md`). The Express backend stays in the repository until its replacement is complete and verified; these instructions no longer start a working app.

Node.js, Express, TypeScript and PostgreSQL. Requires Node.js 22.12 or newer and PostgreSQL 13 or newer.

## Set up

### 1. Create the database

Install PostgreSQL ([Postgres.app](https://postgresapp.com) is the simplest option on a Mac), then:

```sh
createdb nagorikpass
```

### 2. Configure

```sh
cp .env.example .env
```

Edit `.env`:

- Set `DATABASE_URL`.
- Set the `SEED_*` values. Choose your own passwords of at least 12 characters.

### 3. Install, migrate and seed

```sh
npm install
npm run db:migrate
npm run db:seed:demo    # sample employees, visits, one admin and one receptionist
```

For a real installation, run `npm run db:seed:admin` instead. It creates only the first HR/Admin account, who then adds everything else in the application. Remove the `SEED_*` values from the environment afterwards.

### 4. Start

```sh
npm run dev             # API at http://localhost:4000, restarts on changes
```

In a second terminal:

```sh
cd ../frontend
npm run dev             # http://localhost:5173
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start with automatic restart |
| `npm run build` then `npm start` | Compile to `dist/` and run the compiled server |
| `npm run typecheck` | Check types |
| `npm run lint` | Run ESLint |
| `npm test` | Run the test suite. Needs `TEST_DATABASE_URL` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:status` | List applied and pending migrations |
| `npm run db:seed:admin` | Create the first HR/Admin account |
| `npm run db:seed:demo` | Add sample data. Refused in production or if data exists |
| `npm run email:test -- you@example.com` | Send a test message through SMTP |

## Migrations

Migrations are plain SQL files in `migrations/`, applied in filename order. Each runs in its own transaction and is recorded in `schema_migrations`, so running the command twice is safe.

To change the schema, add a new numbered file such as `005_add_badges.sql`. Never edit a file that has been applied. Migrations only go forward: to undo one, write another that reverses it.

| Table | Holds |
|---|---|
| `employees` | Employee records, including official email. Most employees never have a login |
| `users` | Login accounts, optionally linked to an employee |
| `sessions` | Signed-in sessions, stored as token hashes |
| `visitors` | People who visit. Returning visitors are matched on name and phone |
| `visits` | Each visit, its status, its schedule (`visit_date`, `expected_time`, `scheduled_minutes`) and its actual times (`check_in_at`, `check_out_at`) |
| `visit_hosts` | The employees selected in Meeting With |
| `approvals` | One row per host on a walk-in visit, with a hash of the link token |
| `notifications` | Delivery record of each email. Message bodies are not stored |
| `audit_log` | Security log of actions not tied to one visit |
| `visitor_logs` | Audit trail of visit activity |
| `app_settings` | Single row of organization settings, including the approval rule |

## API

All routes are under `/api`. Errors have the form `{ "error": { "code", "message", "fields"? } }`, where `fields` maps a request field to its message. List routes accept `page` and `pageSize` (at most 100) and return `{ items, total, page, pageSize }`.

"Both" means HR/Admin and Receptionist.

### Authentication

| Method and path | Access | Purpose |
|---|---|---|
| `POST /auth/login` | Public | Sign in with `email`, `password`, `remember`. Rate limited |
| `POST /auth/logout` | Public | End the session |
| `GET /auth/me` | Signed in | Current user |
| `POST /auth/change-password` | Signed in | Change password. Signs out other devices |

### Employees and hosts

| Method and path | Access | Purpose |
|---|---|---|
| `GET /hosts` | Both | Meeting With search: ID, name, department and designation only |
| `GET /employees` | Admin | List. `search`, `department`, `status`, `sort`, `order` |
| `GET /employees/departments` | Admin | Department names |
| `GET /employees/:id` | Admin | One employee |
| `POST /employees` | Admin | Create |
| `PUT /employees/:id` | Admin | Update |
| `PATCH /employees/:id/status` | Admin | Activate or deactivate with `active` |

### Visitors

| Method and path | Access | Purpose |
|---|---|---|
| `GET /visitors` | Both | List. `search` |
| `GET /visitors/:id` | Both | One visitor and their recent visits |
| `PUT /visitors/:id` | Admin | Update |

### Visits

| Method and path | Access | Purpose |
|---|---|---|
| `GET /visits` | Both | List. `search`, `status` (comma-separated), `type`, `from`, `to`, `period` (`today`, `upcoming`), `sort`, `order` |
| `GET /visits/export` | Admin | CSV. Same filters |
| `GET /visits/:id` | Both | One visit with its activity |
| `POST /visits/pre-register` | Admin | Create an expected visit |
| `POST /visits/walk-in` | Receptionist | Create a pending visit and request approval |
| `POST /visits/:id/check-in` | Receptionist | Expected or approved visits, on the day only. Needs `identityVerified: true` |
| `POST /visits/:id/check-out` | Receptionist | Checked-in visits only |
| `POST /visits/:id/cancel` | Both | Visits that haven't started |
| `POST /visits/:id/resend-invitation` | Admin | Send the invitation again |
| `POST /visits/:id/resend-approvals` | Both | New links for hosts who haven't answered. Earlier links stop working |

### Host approval links

These need no account: the link is the credential. Opening a link changes nothing, so email scanners can't approve a visit.

| Method and path | Access | Purpose |
|---|---|---|
| `GET /public/approvals/:token` | Link holder | What the host is being asked |
| `POST /public/approvals/:token` | Link holder | Answer with `decision`: `approved` or `rejected`. Single use |

### Dashboard, reports, accounts and settings

| Method and path | Access | Purpose |
|---|---|---|
| `GET /dashboard/stats` | Both | Statistics for the signed-in role |
| `GET /reports/summary` | Admin | Totals, trend and rankings. `days` (7, 30 or 90) or `from` and `to`, plus `status` and `type` |
| `GET /reports/calendar` | Admin | Daily check-ins, check-outs and visits. `month` (YYYY-MM) |
| `GET /reports/export` | Admin | Download a report. `format`: `pdf`, `docx`, `csv` or `daily-csv`, plus the summary filters |
| `GET /users` | Admin | Login accounts |
| `GET /users/available-employees` | Admin | Employees with no login yet |
| `POST /users` | Admin | Create a login. Returns a temporary password once |
| `PATCH /users/:id/status` | Admin | Activate or deactivate |
| `POST /users/:id/reset-password` | Admin | Issue a new temporary password |
| `GET /settings` | Both | Organization settings |
| `PUT /settings` | Admin | Update settings |
| `GET /settings/email-status` | Admin | Which email transport is active |
| `GET /audit-log` | Admin | Security log. `action` |
| `GET /health` | Public | Liveness check |

## Email

`EMAIL_TRANSPORT` chooses how email is delivered.

| Value | What happens | Use it for |
|---|---|---|
| `mailbox` | Emails are kept in memory and shown at http://localhost:4000/api/dev/mailbox, with working links. No credentials needed | Development |
| `smtp` | Sent through your SMTP server | Production, or testing real delivery |
| `console` | Printed to the server log | Development |
| `none` | Recorded as `pending`, nothing delivered. Hosts get no approval links | Deliberately switching email off |

`mailbox` and `console` expose live approval links, so the API refuses to start with them in production. The mailbox also answers only to the computer it runs on, and empties when the API restarts.

### Configure SMTP

Set these in `.env`, then restart the API. The startup log says whether it could connect.

```sh
EMAIL_TRANSPORT=smtp
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASSWORD=your-password-or-api-key
SMTP_FROM_ADDRESS=reception@your-domain.com
```

| Setting | Notes |
|---|---|
| `SMTP_PORT` | 587 for STARTTLS (usual), 465 for TLS from the start |
| `SMTP_SECURE` | Leave blank: true on port 465, otherwise false |
| `SMTP_REQUIRE_TLS` | Leave blank: when a username is set, refuses to send without encryption |
| `SMTP_USER`, `SMTP_PASSWORD` | Set both, or neither for a server that needs no sign-in |
| `SMTP_FROM_ADDRESS` | Must be an address your provider lets you send from |
| Sender name | Set in the application, under Settings |

Check it with a real message:

```sh
npm run email:test -- you@example.com
```

Providers differ, so check their documentation. Gmail, for example, needs an [app password](https://support.google.com/accounts/answer/185833) rather than your normal one, and limits daily sending, so a transactional provider suits production better.

To see real SMTP traffic without a provider, run [Mailpit](https://mailpit.axllent.org) and set `SMTP_HOST=localhost`, `SMTP_PORT=1025`, with `SMTP_USER` and `SMTP_PASSWORD` blank.

### If sending fails

The visit is still saved. The person who acted is told, the host shows **Email failed** on Pending Approvals, the failure appears in the visit's activity, and `notifications` keeps the error. Use **Resend** for approvals and **Resend invitation** for invitations. A failed arrival email isn't retried automatically, so reception is asked to tell the hosts directly.

## Security

- Approval tokens have 256 random bits from the operating system's secure generator. Only their SHA-256 hash is stored.
- Before accepting an answer, the server checks the token, its expiry, that it's unused, that the employee belongs to the visit and is still active, and that the visit is still waiting.
- Resending replaces a host's token, so the older link stops working.
- A link that can no longer be answered reveals nothing about the visit.
- Check-in requires a status of expected or approved, the day of the visit, and `identityVerified: true`.

### Logs

- `visitor_logs` records each visit's activity: registration, emails, host answers, refused link attempts, check-in, check-out and cancellation. It's shown in the visit details.
- `audit_log` records sign-ins including failures, password changes, account, employee and settings changes, and unknown approval links. Admins can read it at `GET /api/audit-log`. There's no page for it yet.

Neither log contains passwords, tokens or approval links.

## Tests

The suite truncates every table, so it refuses any database whose name doesn't contain "test".

```sh
createdb nagorikpass_test
TEST_DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/nagorikpass_test npm test
```

## Production

- Set `NODE_ENV=production`. Session cookies are then marked `Secure`, so the site must use HTTPS.
- Serve the frontend's `dist/` and this API from the same origin, with a reverse proxy sending `/api` here. Set `TRUST_PROXY=true` and `FRONTEND_ORIGIN` to the public URL.
