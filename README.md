# NagorikPass

Smart Visitor Management. Seamless Workplace Access.

A browser-based visitor management system with three login roles. HR/Admins pre-register visitors, manage employees and login accounts, and give the final approval for every visitor's entry. Receptionists register walk-ins, ask HR/Admin to approve entry for every arriving expected visitor, and check visitors in and out. Employees submit visitor requests for HR/Admin to approve, and answer walk-ins who ask for them, in the app or through a secure email link that needs no account.

Every visitor needs HR/Admin's approval before check-in:

| Visit | Steps |
|---|---|
| Pre-registered by HR/Admin | Expected → Receptionist verifies and requests entry → HR/Admin approves → check-in |
| Requested by an employee | HR/Admin approves the request → expected → Receptionist verifies and requests entry → HR/Admin approves → check-in |
| Walk-in | Host approves → HR/Admin gives final approval → check-in |

| Folder | Contents |
|---|---|
| `frontend/` | React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query |
| `backend/` | Node.js, Express, TypeScript, PostgreSQL |
| `Project_Guide.md` | Requirements and workflows |
| `design_resources/` | VisitX design references |

More detail: [backend/README.md](backend/README.md) lists every API endpoint and table, and [frontend/README.md](frontend/README.md) covers the frontend.

## Requirements

- Node.js 22.12 or newer
- PostgreSQL 13 or newer. On a Mac, [Postgres.app](https://postgresapp.com) is the simplest option

## Installation

```sh
cd backend && npm install
cd ../frontend && npm install
```

## Database setup

Create an empty database:

```sh
createdb nagorikpass
```

Create the configuration file and edit it:

```sh
cd backend
cp .env.example .env
```

At minimum, set `DATABASE_URL`. To load sample data, also set the `SEED_*` values.

Apply the migrations, then choose one way to create your first accounts:

```sh
npm run db:migrate

# For trying the system: sample employees and visits, one admin, one receptionist.
npm run db:seed:demo

# For real use: only the first HR/Admin account. They add everything else in the application.
npm run db:seed:admin
```

`db:seed:demo` refuses to run in production or on a database that already holds employees or visits. Neither seed changes existing accounts.

## Running in development

Use two terminals:

```sh
cd backend && npm run dev     # API at http://localhost:4000
cd frontend && npm run dev    # App at http://localhost:5173
```

Open http://localhost:5173 and sign in with the `SEED_*` email and password you chose.

In the default email mode, approval links appear in the development mailbox at http://localhost:4000/api/dev/mailbox. Opening one in a private window shows what a host sees.

## Environment variables

Set these in `backend/.env`. A real environment variable takes priority over the file. The API checks them at startup and refuses to start, with an explanation, if any is invalid.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Yes | | PostgreSQL connection, such as `postgres://user:password@localhost:5432/nagorikpass` |
| `FRONTEND_ORIGIN` | Yes | | Browser address of the frontend. Used for security checks and for links in emails |
| `NODE_ENV` | | `development` | `development`, `test` or `production` |
| `PORT` | | `4000` | API port |
| `DATABASE_SSL` | | `false` | `true` if the database requires TLS |
| `APP_TIMEZONE` | | `Asia/Dhaka` | Decides what "today" means for visits and reports |
| `SESSION_TTL_HOURS` | | `12` | Sign-in length |
| `SESSION_REMEMBER_DAYS` | | `30` | Sign-in length with "Remember me" |
| `LOGIN_RATE_LIMIT_MAX` | | `10` | Failed sign-ins allowed per address and email in 15 minutes |
| `TRUST_PROXY` | | `false` | `true` only behind a reverse proxy that sets `X-Forwarded-For` |
| `EMAIL_TRANSPORT` | | `mailbox` | `smtp`, `mailbox`, `console` or `none` |
| `SMTP_HOST` | With `smtp` | | Mail server |
| `SMTP_PORT` | | `587` | 587 for STARTTLS, 465 for TLS from the start |
| `SMTP_SECURE` | | By port | Blank means true on port 465 |
| `SMTP_REQUIRE_TLS` | | By username | Blank means encryption is required when a username is set |
| `SMTP_USER`, `SMTP_PASSWORD` | | | Set both, or neither for a server that needs no sign-in |
| `SMTP_FROM_ADDRESS` | With `smtp` | | Sender address. The sender name is set in the app under Settings |
| `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | For seeding | | First admin. Passwords need 12+ characters |
| `SEED_RECEPTIONIST_EMAIL`, `SEED_RECEPTIONIST_PASSWORD` | For demo seed | | Sample receptionist |
| `TEST_DATABASE_URL` | For tests | | Test database. Its name must contain "test" |

Frontend, optional, in `frontend/.env.local`:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_PROXY_TARGET` | `http://localhost:4000` | Where the development server sends `/api` requests |

Never commit `.env`. It's already in `.gitignore`.

## Email

| `EMAIL_TRANSPORT` | What happens |
|---|---|
| `mailbox` | Kept in memory and shown at `/api/dev/mailbox`. No credentials needed. Development only |
| `console` | Printed to the API log. Development only |
| `smtp` | Sent through your mail server |
| `none` | Recorded as pending, nothing delivered, so hosts get no approval links |

To use real email, set the `SMTP_*` values and `EMAIL_TRANSPORT=smtp`, restart the API, then check it:

```sh
cd backend && npm run email:test -- you@example.com
```

See [backend/README.md](backend/README.md#email) for more detail.

## Migrations

Migrations are SQL files in `backend/migrations/`, applied in filename order. Each runs once, in its own transaction.

```sh
npm run db:status     # list applied and pending migrations
npm run db:migrate    # apply pending migrations
```

Run `db:migrate` after pulling changes. To change the schema, add a new numbered file and never edit one already applied. Migrations only go forward, so **back up production data before migrating**.

## Commands

| Where | Command | Purpose |
|---|---|---|
| Both | `npm run dev` | Start in development |
| Both | `npm run build` | Production build |
| Both | `npm run typecheck` | Check types |
| Both | `npm run lint` | Run ESLint |
| `backend` | `npm start` | Run the built API |
| Both | `npm test` | Run the test suite. The backend needs `TEST_DATABASE_URL` |
| `backend` | `npm run db:migrate`, `db:status` | Manage the schema |
| `backend` | `npm run db:seed:admin`, `db:seed:demo` | Create initial data |
| `backend` | `npm run email:test -- you@example.com` | Send a test email through SMTP |
| `frontend` | `npm run preview` | Serve the production build locally |

## Testing

The backend suite runs against a real PostgreSQL database and **empties every table it uses**. It refuses any database whose name doesn't contain "test", so your real data stays safe if you follow these steps:

```sh
createdb nagorikpass_test
cd backend
TEST_DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/nagorikpass_test npm test
```

It covers sign-in and sessions, a permission matrix of every API route for all three roles, the three visitor workflows including approval order, self-approval and rejection reasons, approval token rules, official email privacy, SMTP delivery against a local test server, reports and settings.

Before committing, run these in both `backend` and `frontend`:

```sh
npm run typecheck && npm run lint && npm run build
```

The frontend has unit tests for countdowns, delays, calendar dates and report filters:

```sh
cd frontend && npm test
```

Its pages have no automated tests in this repository, so check the browser workflows by hand:

1. **Pre-registered:** as Admin, add a visitor for later today with two hosts, and check the mailbox for the invitation. As Receptionist, use Request entry on Expected Visitors. As Admin, approve it under Visitor Approvals. As Receptionist, check them in, which emails both hosts, then check them out from Checked-in Visitors.
2. **Walk-in:** as Receptionist, add an unexpected visitor. Open the host's link from the mailbox in a private window and approve. Pending Approvals moves it to Waiting for HR/Admin. As Admin, approve it; it can then be checked in.
3. **Employee request:** as Admin, create an Employee login for an employee record under Receptionist Management. Sign in as that employee and submit a request for today. As Admin, approve it, then confirm the employee's request shows Expected. As Receptionist, use Request entry; as Admin, approve the entry; then check the visitor in.
4. **Refused paths:** reject a walk-in at the host or HR/Admin step and confirm it can't be checked in. Reopen a used link and confirm it can't be answered again.
5. **Permissions:** as Receptionist, open `/admin/employees`, and as Employee, open `/reception`. Confirm you're sent back, and that no official email appears anywhere.

## Production

- Set `NODE_ENV=production` and `EMAIL_TRANSPORT=smtp`. The API refuses to start with `mailbox` or `console` in production, because they expose live approval links.
- Use HTTPS. Session cookies are marked `Secure`, so sign-in doesn't work over plain HTTP.
- Serve `frontend/dist` and the API from the same address, with a reverse proxy sending `/api` to the API. Set `TRUST_PROXY=true` and set `FRONTEND_ORIGIN` to the public address.
- Remove the `SEED_*` values from the environment after seeding.
