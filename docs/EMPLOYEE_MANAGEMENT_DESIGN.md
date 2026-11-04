# Employee management, visitor-registration permission, bulk import and invitations — proposal

**Status (updated 2026-11-04): decided and partly built.** You answered A1 to A8 (Section 9). The migration, its
tests, the two Edge Function modules and the import logic are written and tested locally. **Nothing is applied to
the hosted project and nothing is deployed;** each needs your explicit approval. See
`docs/MIGRATION_PREVIEW_EMPLOYEE_MANAGEMENT.md`. The screens are not built yet.

**Where these requirements come from.** They are your additions of 2026-11-04. They are not in
`docs/NagorikPass_PRD.pdf` or `docs/NagorikPass_PRD_Updated.md`, which I have not edited. They are tracked as
**Addendum A** in `docs/IMPLEMENTATION_TRACKER.md`. They do not contradict the PDF: employees still register their
own visitors without HR/Admin approval (PDF section 7); the permission only decides *which* employees may.

This also settles question Q8: **HR/Admin creates Employee and Receptionist accounts by invitation email; people set
their own passwords; public self-registration stays off.**

## 1. Requirements checklist

| ID | Requirement |
|---|---|
| EM-1 | HR/Admin adds employees one at a time |
| EM-2 | HR/Admin edits employee information |
| EM-3 | HR/Admin deactivates employee accounts |
| EM-4 | HR/Admin views and searches all employees |
| EM-5 | HR/Admin manages employee access and permissions |
| EM-6 | Bulk import from `.xlsx` or CSV: preview before saving, required-field checks, duplicate Employee ID and email detection, row-level errors, success and failure results, no silently skipped rows |
| EM-7 | Accounts are created and invited securely after validation |
| EM-8 | Every employee has `can_register_visitors`. ON: may register visitors. OFF: may not. HR/Admin can change it at any time. Enforced in the database, not only the screen |
| EM-9 | An employee without permission gets a clear access-denied message |
| EM-10 | HR/Admin creates Employee and Receptionist accounts; invitation emails; users set their own passwords |
| EM-11 | Public self-registration stays disabled |
| EM-12 | Invitations use secure Edge Functions; the service-role key is never in frontend code |
| EM-13 | Receptionists can never read private employee information |
| EM-14 | Tracker and tests are updated |

## 2. What exists today (reviewed)

| Area | As built in Phase 1 |
|---|---|
| `employees` | `id`, `full_name`, `team`, `official_email` (optional), `phone` (optional), `active`, timestamps. **No Employee ID, no designation, no permission flag** |
| `profiles` | `id` (the login), `role`, `full_name`, `employee_id` (unique), `active`, timestamps. **No email, no invitation tracking** |
| Who can write `employees` | HR/Admin only (policy). An employee reads only their own row. Receptionists and other employees read `employee_directory`, which shows only `id`, `full_name`, `team` |
| `register_visit` | Any active login may register. The role sets the source. **It does not check any permission** |
| `service_role` | Has **no** privileges on any of our tables or functions (verified on the hosted project) |
| Hosted data | 1 login and 1 profile (yours), 0 employees |

Because the hosted `employees` table is empty, adding required columns needs no backfill and changes no data.

## 3. Permission model

**What "access and permissions" means here (EM-5).** Two things per employee, and nothing else. I am not adding any
other permission.

1. **Account access:** the account is active or deactivated.
2. **`can_register_visitors`:** ON or OFF.

| Action | HR/Admin | Receptionist | Employee, flag ON | Employee, flag OFF | Deactivated employee |
|---|---|---|---|---|---|
| Register a visitor | Yes | Yes | **Yes** | **No: access denied** | No |
| Read their own employee record, including the flag | n/a | No | Yes | Yes | No |
| Change any employee's flag | **Yes** | No | No | No | No |
| See other employees | All fields | Name and team only | Name and team only | Name and team only | Nothing |
| See visitors they registered earlier | All | Expected list | Yes | **Yes, still** | No |

**How it is enforced.** In `register_visit`, for a caller whose role is `employee`: the login must be active, the
employee record must be active, and `can_register_visitors` must be true. Otherwise the database raises
`visitor_registration_not_permitted` (privilege error `42501`) and registers nothing.

**The message.** The screen turns that error into: *"You don't have permission to register visitors. Please contact
HR/Admin."* The employee can read their own flag, so the Add New Visitor screen can also show this message up
front. The database check is what protects you; the screen message is convenience.

**Who can change it.** Only HR/Admin. Employees have no write access to `employees`, so they cannot turn their own
flag on (a test will prove it, as the existing one proves they cannot edit their record).

**What turning it OFF does not do.** Visitors already registered stay registered and visible to that employee, and
check-in is unaffected. It blocks only *new* registrations.

**What it does not affect.** HR/Admin and Receptionist registration.

**Receptionist privacy (EM-13).** Unchanged by design. The new private columns (Employee ID, designation, email,
phone, the flag) live in `employees`, which receptionists cannot read at all. `employee_directory` stays at
`id`, `full_name`, `team`. Tests will assert both, again.

## 4. Proposed database changes

One new migration, for example `20261104130000_employee_management.sql`. It does not exist yet. It only adds and
tightens; it drops and rewrites nothing that holds data.

### Columns

| Table | Change | Why |
|---|---|---|
| `employees` | add `employee_code text not null` (Employee ID), unique ignoring case, trimmed, at most 50 characters | The Employee ID column in your template |
| `employees` | add `designation text` (optional) | Designation column |
| `employees` | add `can_register_visitors boolean not null default <A1>` | EM-8 |
| `employees` | `official_email` becomes `not null`, with a basic format check and unique ignoring case | Every employee can be invited (A2) |
| `profiles` | add `email text` (copy of the login's email, unique ignoring case) | HR needs to see a receptionist's email; it is not readable from `auth.users` |
| `profiles` | add `invited_at timestamptz`, `activated_at timestamptz` | Shows "Invited" or "Active" without reading `auth.users` |

I keep the existing column names (`full_name`, `team`, `official_email`, `phone`) so Phase 1 and its tests stay
valid. The screen labels them Full Name, Department / Team and Email.

### Functions

| Function | Who may run it | What it does |
|---|---|---|
| `import_employees(rows jsonb)` | HR/Admin | Re-validates every row, inserts the valid ones in one transaction, returns one result per row (EM-6) |
| `admin_create_profile(user_id, role, full_name, email, employee_id)` | **`service_role` only** | Called by the invitation Edge Function to create the profile for a newly invited login. Accepts only the `receptionist` and `employee` roles. For an employee it requires an active employee whose email matches and who has no login yet |
| `admin_mark_invited(user_id)` | **`service_role` only** | Refreshes `invited_at` when an invitation is sent again, for an account not yet activated |
| `mark_account_active()` | Any signed-in user | Sets `activated_at` on first sign-in, for their own profile only |
| `register_visit` (replaced) | As before | Adds the permission check in Section 3 |

`service_role` gets `EXECUTE` on `admin_create_profile` and `admin_mark_invited` **only**, and no table privileges.
That is narrower than giving it table access, and it answers the gap I reported earlier. It means the Edge
Functions can create a profile and refresh an invitation, and do nothing else to our data. (`admin_mark_invited`
was added during the build, for the "Invite again" action.)

### A trigger

When `employees.active` changes, the matching login's `profiles.active` follows in the same transaction. So
deactivating an employee immediately denies everything for their login, whatever path made the change.
Reactivating reverses it.

### Rules I am not changing

- No employee is ever deleted; they are deactivated. Visits refer to them.
- HR/Admin cannot create another HR/Admin through the app. The first one was made by hand; adding more is not in
  your requirements.
- An employee's email cannot be edited once a login exists, because the login's email would stop matching (A5).

### Tests and checks

- The 151 SQL checks stay. New ones are added for: the flag blocking and allowing registration; an employee unable to
  change their own flag; deactivation cascading to the login and blocking everything; every import rule; only
  `service_role` able to run `admin_create_profile`; employees' and receptionists' unchanged privacy. The fixture
  gets the new required columns.
- `supabase/verify_remote.sql` is updated so the hosted project can be checked after the push: the exact function
  lists, and that `service_role` has execute on one function and nothing else.

### Safety of applying it

- The hosted `employees` table is empty, so no existing row can break the new `not null` columns.
- It would be previewed with a dry run and the same destructive-statement scan as before, then shown to you.
- **I will not apply it without your explicit approval.**

## 5. Bulk import workflow (employees)

Same pattern as the card and candidate imports: the browser reads the file, the database validates again.

1. **Choose a file.** `.xlsx` or `.csv`, up to 2 MB and 1,000 rows (the same limits as the other imports). CSV is UTF-8
   with commas. Header in row 1. All cells are read as text, so an Employee ID like `0042` keeps its zeros.
2. **Columns.** Matched ignoring case and spaces.

   | Column | Required | Rule |
   |---|---|---|
   | Employee ID | **Yes** | Not empty, at most 50 characters. Unique ignoring case |
   | Full Name | **Yes** | Not empty |
   | Email | **Yes** | A valid address. Lower-cased. Unique ignoring case |
   | Phone Number | No | Free text, trimmed |
   | Department / Team | No | Free text. The headers `Department` and `Team` are also accepted |
   | Designation | No | Free text |

   A missing required column rejects the whole file with a clear message. Extra columns are ignored and listed.
3. **Preview, before anything is saved.** A table of every row with a status, all checked in the browser:
   **Ready**, **Error** (with each reason), **Duplicate in file** (names the other row), or **Already exists**
   (Employee ID or email already in the system). Counts at the top: "148 ready, 12 with errors".
4. **Nothing is silently skipped.** Rows with errors are never imported and are never hidden: they stay in the
   preview with their reasons. You can fix the file and upload again, or continue.
5. **Confirm.** The button says exactly what it will do: "Import 148 employees. 12 rows with errors will not be
   imported." Nothing is saved until you press it.
6. **Save.** The browser sends the rows to `import_employees`. The database checks every row again (required fields,
   formats, duplicates inside the batch, duplicates against existing employees) and inserts the valid ones in one
   transaction. If someone else added a clashing employee between preview and confirm, that row is reported as
   failed, not lost.
7. **Result screen.** How many were imported, and every failed row with its reason. Optionally a downloadable error
   list (A6).
8. **Invitations.** Imported employees do not get a login yet. A choice appears: **"Send invitations to the N
   imported employees now"**, showing the count first (A4). Invitation is a separate step, so a mail problem can
   never undo or block an import, and failed invitations can be retried from the employee list.

Re-uploading the same file: every row would be reported as "Already exists". It would not be quietly skipped.

Spreadsheets can hold text that begins with `=`, `+`, `-` or `@`. The importer treats every cell as plain text, and
any downloadable error list will neutralise those so it cannot run as a formula when opened in Excel.

## 6. Invitation workflow

### Who can invite

HR/Admin only, for **employees** (an existing employee record) and **receptionists** (a name and email). There is
no self-registration (EM-11).

### Steps

```
HR/Admin presses Invite
  -> browser calls the Edge Function invite-user, sending the HR/Admin's own session token
  -> the function checks, using the database, that the caller is an active HR/Admin
     (it never trusts a role claim sent by the browser)
  -> it validates the target (employee exists, is active, has an email, has no login; or receptionist name + email)
  -> it asks Supabase Auth to invite that email (Supabase sends the email)
  -> it calls admin_create_profile to create the profile (role, link to the employee, email, invited_at)
  -> if creating the profile fails, it deletes the just-invited login, so no orphan is left
  -> it returns "invited" or a clear error for that person
```

Then the invited person:

```
Opens the email link  ->  /auth/confirm  ->  the app verifies the one-time token  ->  "Set your password" screen
  ->  password saved  ->  mark_account_active()  ->  sent to their own area (HR/Admin, Reception or Employee)
```

The link points at our app and the token is checked by the app's script, not by a plain page load, so mail scanners
that open links do not use it up.

### Details

- **Bulk invitations** run one person at a time with a visible progress list: sent, failed with the reason, or
  already has a login. A failure never stops the rest, and failed ones can be retried.
- **Resend.** An "Invite again" action for people still marked Invited. I will check on your project whether
  Supabase re-sends for an unconfirmed login or needs a different call, before relying on it.
- **Status shown to HR/Admin:** Not invited, Invited, Active, Deactivated.
- **Deactivation.** The database already denies everything the moment `active` is false. A second function,
  `set-login-status`, also bans the login in Supabase Auth, so it cannot even sign in. If that function fails, the
  database rule still holds, and the reply says the second layer did not apply. That function **refuses to change an
  HR/Admin account**, so nobody can lock everyone out by deactivating an administrator. (Ending existing sessions is
  not done: the database already denies them, and I did not want to promise more than I could test.)
- **Role is never taken from the user.** It comes only from `profiles`, which only HR/Admin and the function can
  write. I will not put the role in the invite's user metadata, which a user can edit.
- **No secrets in the repository.** Supabase provides an Edge Function with its own service-role key at run time.
  I never see it, and it never enters the repository or the browser.

### What you must configure in the Supabase dashboard (I cannot do these from the CLI safely)

1. **Authentication, Sign In / Providers:** turn **off** "Allow new users to sign up". Whether the invite call still
   works with sign-ups off is something I will confirm on your project.
2. **Authentication, URL Configuration:** Site URL `http://localhost:3000` for now, plus your real address later.
3. **Authentication, Emails:** the invite template, edited to link to `/auth/confirm?token_hash={{ .TokenHash }}&type=invite`.
   I will give you the exact text.
4. **Custom SMTP: needed before bulk invitations (A3).** Supabase's built-in email sender is meant for testing and has a
   very low hourly limit. Inviting a whole company needs your own email provider set up under Authentication, SMTP.
   I will read the actual limit from your project's settings before we rely on it.
5. **Password rules and link lifetime:** I recommend a minimum of 12 characters and a link lifetime of up to a day;
   I will check the ranges your project allows.

### Testing, and its limits

- Docker is not installed and Deno is not available, and `supabase functions serve` is local-only, so the Edge
  Functions **cannot be run locally**.
- So I keep the logic that matters in places I can test here: the rules in SQL (tested as each role, on
  PostgreSQL) and the file parsing and row validation in plain TypeScript (unit tests). The Edge Functions themselves
  are thin.
- The functions are then deployed to the hosted project (`functions deploy --use-api`, which needs no Docker) and
  tested for real with an email address you control, for example `you+test1@nagorik.tech`. **I will ask before each
  deploy, and before sending any invitation email.**

## 7. Screens (built after the migration is approved)

- **Employee Management:** searchable, paged list (Employee ID, name, email, team, designation, status, permission);
  add and edit; deactivate and reactivate; the `can_register_visitors` switch per employee; Invite and Invite again;
  Import employees.
- **Receptionist Management:** invite a receptionist, deactivate and reactivate, status.
- **Invitation page** (`/auth/confirm`) and the set-password screen.
- **Employee, Add New Visitor:** shows the access-denied message when the permission is off.

Search covers name, Employee ID, email and team. HR/Admin only (receptionists never reach this page or its data).

## 8. Security review

| Risk | Mitigation |
|---|---|
| A user promotes themselves or flips their own permission | Role only in `profiles`, permission only in `employees`, both writable by HR/Admin alone; tests prove it |
| The browser sends a forged "I am admin" to the function | The function re-checks the caller in the database from their token |
| Service-role key leaks | It never enters the repository or browser; it is not even given to us. `service_role` can run one SQL function only |
| An invited login without a profile | The profile is created in the same call, and the login is deleted if that fails. A login with no profile has no access anyway |
| An invited person's link used by someone else | One-time token, limited lifetime, checked by the app; resend replaces it |
| Employee emails or phones read by a receptionist | They are in `employees`, which receptionists cannot read; directory unchanged; tested |
| Spreadsheet formula injection | Cells are text; any exported error list neutralises leading `=`, `+`, `-`, `@` |
| Mass-invitation abuse | HR/Admin only; one at a time with progress; the dashboard's email limits apply |
| Personal data in the import | Read in the browser, sent only on confirm, never logged by me |

## 9. Questions and my recommendations

| # | Question | Recommendation |
|---|---|---|
| **A1** | Default for `can_register_visitors` on a new employee: ON or OFF? | **ON — confirmed.** The PDF says employees register their own visitors; ON keeps that working by default, and HR turns it off for specific people. With OFF, HR would have to enable every employee after an import |
| **A2** | Required import columns: Employee ID, Full Name, Email required; Phone, Team, Designation optional. And Email required for every employee in the database? | Yes. Every employee can then be invited |
| **A3** | Email provider for invitations. Do you have an SMTP provider (for example your company's email or a service like Resend or SendGrid)? | Needed before bulk invitations. Not needed to build or to test with a few emails |
| **A4** | After an import, show "Send invitations now" as a choice (with the count), or only invite from the employee list? | The choice, **not** ticked by default, so an import never sends email by accident |
| **A5** | An employee's email cannot be edited once they have a login. OK? | Yes, until a safe change-email function is wanted |
| **A6** | Partial import (valid rows saved, errors listed), plus a downloadable error list? | Partial, with the list. It matches "show successful and failed results" |
| **A7** | Approve the CSV reader `papaparse` (5.7.0: 1 package, no known vulnerabilities)? | Yes. The Excel reader `read-excel-file` was recommended earlier |
| **A8** | Keep a history of who changed an employee's permission and when? | Not in your requirements, so not included. Say if you want it |

## 10. Order of work

| Step | What | Needs |
|---|---|---|
| 1 | You answer A1 to A8 | You |
| 2 | I write the migration and its tests; run them locally | A1, A2, A5 |
| 3 | Dry run plus destructive-statement scan, shown to you | |
| 4 | **You approve**, I push, I run the read-only check | Your approval |
| 5 | I write the Edge Functions and the importer logic, with unit tests | A7 |
| 6 | You configure the dashboard (Section 6); **you approve the function deploy**; I test with your test email | A3 for bulk |
| 7 | Frontend: Employee and Receptionist Management, invitation page, permission message | Step 4 |
| 8 | Phase 2 sign-in work continues in parallel as soon as `frontend/.env.local` exists | Publishable key |
