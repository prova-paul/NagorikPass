# NagorikPass — Connecting to a hosted Supabase project

You create the project and log in. I never ask for, and you should never paste into chat, a **database password**,
an **access token**, or the **secret / service_role key**. I only need the **Project URL** and the **publishable key**.

Nothing in this guide changes the hosted database. Migrations are applied only after you approve them (Step 6).

The Supabase CLI is installed at the repository root (`package.json`, version 3.0.0). Run its commands from the
repository root with `npx supabase ...`. In Claude Code you can run a shell command yourself by typing `!` first,
for example `! npx supabase login`.

## Step 1. Create the project (in your browser)

1. Open the Supabase dashboard (supabase.com/dashboard) and sign in.
2. **New project.** Name it `NagorikPass`. Choose the region nearest your users (for Dhaka, Singapore or Mumbai).
3. **Database password:** let the dashboard generate one and save it in a password manager. You need it for
   `supabase link` and `supabase db push`. It is not for me and not for any file in the repository.
4. Leave the Data API enabled; the app uses it.
5. Wait until the project says it is ready (about two minutes).

Menu names in the dashboard change from time to time; the ideas below stay the same.

## Step 2. Find the three values (in the dashboard)

| Value | Where | Share with me? |
|---|---|---|
| **Project URL**, like `https://abcdefghij.supabase.co` | Project Settings > Data API (or API) | **Yes** |
| **Publishable key**, starts `sb_publishable_` (an older project may call it the anon key) | Project Settings > API Keys | **Yes** |
| **Project ref**, the part of the URL before `.supabase.co` | Same URL, or Project Settings > General | **Yes** |
| Database password | You chose it in Step 1 | **No** |
| Secret key / service_role key | Project Settings > API Keys | **No, never** |

## Step 3. Log the CLI in (in your terminal, at the repository root)

```sh
npx supabase login
```

It opens a browser to approve the CLI. If it cannot open one, run `npx supabase login --no-browser` and follow the
link it prints. Then check it worked and find your project's ref:

```sh
npx supabase projects list
```

## Step 4. Link this folder to the project

```sh
npx supabase link --project-ref YOUR_PROJECT_REF
```

It asks for the database password you saved in Step 1. Linking only records which project this folder points at
(in `supabase/.temp`, which git ignores). It changes nothing in the hosted database.

This CLI version (3.0.0) works on a **local** stack unless you add `--remote`, so a command without it never
touches your hosted project, and fails if Docker is not running. Every hosted command below therefore has
`--remote`.

Until you approve, do **not** run `supabase db push --remote`, `supabase config push`,
`supabase functions deploy` or `supabase db reset --remote`. `config push` in particular would send the local defaults in
`supabase/config.toml` to your hosted project.

## Step 5. Give me the URL and publishable key

Send me the Project URL and the publishable key. I then create `frontend/.env.local` (git ignores `*.local`),
confirm the project answers, and continue with Supabase Auth.

## Step 6. Preview and approve the migrations

I will run a dry run first. It reads the hosted project's migration history and lists what would be applied, and
changes nothing:

```sh
npx supabase db push --remote --dry-run --skip-vault
```

You review it. Only when you say so do I (or you) run `npx supabase db push --remote --skip-vault`. The full preview and the checks to run afterwards are in `docs/MIGRATION_PREVIEW.md`. The three Phase 1 migrations were
tested on local PostgreSQL with a stand-in for Supabase, not on Supabase itself, so the first push is also the
first real check; I will re-run the checks against the hosted project afterwards.

## Step 7. Create the first HR/Admin login

A new project has no users, and every policy needs a profile row, so the first HR/Admin is made by hand:

1. Dashboard > Authentication > Users > **Add user**. Enter your email and a password, and tick **Auto Confirm User**.
2. Copy the new user's **User UID**.
3. After the migrations are applied, run this once in the dashboard's SQL editor, with your own values:

```sql
insert into public.profiles (id, role, full_name)
values ('PASTE-THE-USER-UID-HERE', 'admin', 'Your Name');
```

Every later account is created from inside NagorikPass by HR/Admin. How accounts are created is still open
(question Q8): see `docs/PDF_REQUIREMENTS_CHECKLIST.md`.

## Step 8. Authentication settings to review (dashboard)

- **Authentication > Providers > Email:** enabled.
- **Allow new users to sign up:** I recommend turning it **off**, because HR/Admin manages accounts. A person
  without a profile can see nothing anyway, but off avoids stray accounts. This depends on your answer to Q8.
- **Authentication > URL Configuration:** set **Site URL** to `http://localhost:3000` while developing (the Next.js development address), and add `http://localhost:3000/**` to the redirect URLs, and add
  your real address when you deploy. Password-reset links use it.

## Keeping secrets out

- `.gitignore` at the repository root ignores `.env`, `.env.*` (except `*.example`), `node_modules` and
  `supabase/.temp`.
- Only `frontend/.env.example` is committed, and it has no real values.
- Supabase gives Edge Functions their own service-role key at run time. If I need an Edge Function for account
  management, the key never appears in the repository or in the browser.
