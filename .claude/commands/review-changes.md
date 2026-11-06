---
description: Review NagorikPass changes against the Development PRD, reporting without editing
argument-hint: [module, branch or path]
---

Review these changes: $ARGUMENTS (if empty, review the current uncommitted changes)

Do not change any code. Report only.

Read `docs/development/DEVELOPMENT_PRD.md` and the relevant supporting documents, then check:

1. **Requirements:** matches the Requirement PRD and the owner decisions, with no invented rules.
2. **Architecture:** follows `02-technical-architecture.md`.
3. **RBAC and RLS:** each role can do only what `04-user-roles-and-permissions.md` allows, enforced in the database as well as the server.
4. **Authentication:** signing in by any method gives no access without an active profile and role.
5. **Security:** per `07-security-guidelines.md`, especially secrets and the service-role key.
6. **Validation and errors:** client, server and database, with all screen states.
7. **Tests:** the listed test IDs exist and pass. Run them if you can, and say if you could not.
8. **Scope:** unrelated changes, unapproved dependencies, migrations or configuration changes.

Report findings by severity, with file and line, the failure scenario, and the document it conflicts with. If nothing is wrong, say so.
