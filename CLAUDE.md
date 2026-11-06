# NagorikPass

NagorikPass is a Visitor Management System for one organization, used by HR/Admin, Receptionists and Employees.

## Source of truth

1. `docs/source/REQUIREMENT_PRD.md`: business requirements. Never edit it.
2. `docs/development/DEVELOPMENT_PRD.md`: approved technical specification and owner decisions.
3. `PROJECT_STATUS.md`: current progress.

`previous-work/` is an archive and isn't a source of truth. The repository's existing code predates this specification, and its future is decided in Phase 0.

If documents conflict or a requirement is unclear, report it and ask. The deviations from the Requirement PRD are listed in Development PRD §14.

## Reading order

Read the Development PRD, then the documents for your task in `docs/development/`:

| Task | Read |
|---|---|
| Any module | `01-system-overview.md`, `06-business-workflows.md`, `10-development-roadmap.md` |
| Architecture or auth | `02-technical-architecture.md`, `04-user-roles-and-permissions.md` |
| Database | `03-database-design.md` |
| Server operations | `05-api-contracts.md` |
| Security | `07-security-guidelines.md` |
| Tests | `08-testing-strategy.md` |
| Deployment | `09-deployment-guide.md` |
| UI | `11-ui-design-system.md`, and inspect the Showcase image |

## Stack

Next.js App Router, TypeScript, Tailwind CSS, Server Actions and Route Handlers, Supabase PostgreSQL, Auth (email and password, plus Google), Storage and Realtime, RBAC and RLS, ExcelJS, PDFKit, Zod, Telegram for HR/Admin notifications only, implemented later by the owner (WhatsApp and Slack later), Vercel and Vercel Cron. The Receptionist app is a responsive PWA.

Express and Edge Functions aren't part of the target.

## Architecture and security rules

- Enforce authorization in the database and server, never only in the UI.
- Signing in proves identity only. Access needs an active `user_profiles` row with a role. Never create a profile or role from a Google or any other email.
- Google Sign-In accepts only the company Google Workspace domain, checked on the server. Only company email addresses are used.
- Visit and card state changes go through the transactional database functions.
- Don't bypass RLS. Use the service-role key only in the server-only cases listed in `07-security-guidelines.md`, and never expose it or other secrets to the browser, logs or repo.

## Coding conventions

- Use TypeScript types for application and database entities.
- Keep pages, components, server code and utilities separate, and keep business logic out of presentation components.
- Validate with Zod on client and server. Handle loading, empty, success and error states.
- Use the design tokens and shared components.

## Testing

Add tests for each change using the IDs in `08-testing-strategy.md`, covering every affected role. Report actual results. Don't mark a task complete without verification.

## Prohibited without explicit approval

- Implementing features outside the approved module or scope. Implementation itself needs separate authorization.
- Inventing business rules, or making significant architecture or business-rule changes.
- Changing the database schema without an approved migration plan.
- Running migrations or changing hosted Supabase, Auth settings, Google Cloud, Vercel or Telegram configuration.
- Creating users, seeding hosted data, or deleting archived work.
- Adding unapproved dependencies.
- Committing or pushing.

Always read the relevant documentation before planning or implementing a module. See `.claude/commands/` for the plan, implement and review procedures.
