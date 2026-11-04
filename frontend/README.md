# NagorikPass Frontend

Next.js (App Router), React, TypeScript and Tailwind CSS, with Supabase Auth and Supabase PostgreSQL. It replaces
the earlier Vite and Express frontend; the reasons and the decisions are in `docs/DECISIONS_AND_OPEN_QUESTIONS.md`.

Requires Node.js 22.12 or newer.

## Set up

```sh
cd frontend
npm install
cp .env.example .env.local     # then fill in the two values
npm run dev                    # http://localhost:3000
```

`.env.local` needs two values from your Supabase project (Project Settings in the dashboard):

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The project address, like `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The **publishable** key, which starts `sb_publishable_` |

Never put the secret key or the `service_role` key in any file. The app refuses them. Without the two values, every
page shows a "setup required" screen instead of failing.

Check the connection to your project, using only the publishable key and never creating an account:

```sh
npm run check:supabase
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` then `npm start` | Production build and server |
| `npm run typecheck` | Check types |
| `npm run lint` | Run ESLint |
| `npm test` | Run the tests |
| `npm run check:supabase` | Check the connection, sign-up setting and sign-out access to your project |

From the repository root: `npm run types:generate` rewrites `src/types/database.ts` from the hosted schema.

## How sign-in and access work

- **Sessions** live in cookies that Supabase sets and the server reads (`@supabase/ssr`). `src/proxy.ts` keeps the
  session fresh on every page request and sends visitors without one to `/login`. It reads only the cookie.
- **Roles** (HR/Admin, Receptionist, Employee) come from the signed-in person's row in the `profiles` table, never
  from anything the user can edit. `src/lib/dal.ts` is the one place that asks who is signed in. Every protected
  page and layout calls `requireRole`, because layouts do not re-render on every navigation.
- **Row-level security** in the database is the final check: even a page that rendered wrongly could only read what
  the database allows that person to read.
- **No public sign-up.** There is no sign-up page, and the app never calls Supabase's sign-up. HR/Admin creates
  accounts (invitations). Turn off "Allow new users to sign up" in the Supabase dashboard too.
- A login with no profile, or a deactivated one, is signed out and told why. It cannot loop.

## Folders

| Folder | Holds |
|---|---|
| `src/app` | Pages and layouts (App Router): `login`, `admin`, `reception`, `employee`, `auth/denied`, `setup-required` |
| `src/auth` | Roles, access decisions, login action, messages (the decisions are plain functions with tests) |
| `src/lib` | `supabase/` clients and config, `dal.ts`, `dashboard.ts`, the employee import logic, shared helpers |
| `src/components` | `ui/` shared pieces, `layout/` (shell, navigation), `dashboard/`, `auth/` (session listener) |
| `src/types/database.ts` | Generated from the database schema. Do not edit |
| `src/screens`, `src/api`, `src/store`, `src/mocks`, `src/components/visits`, `src/layouts`, `src/auth/AuthContext.tsx`, `src/auth/RequireRole.tsx` | **Legacy** code written for the old Express API and react-router. Kept on disk, outside the build, until each part is rewritten. They no longer compile |

Design tokens (royal purple, lavender, white) are in `src/app/globals.css`.
