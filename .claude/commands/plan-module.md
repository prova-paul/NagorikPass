---
description: Plan one NagorikPass module from the approved documents, without writing code
argument-hint: <module name or phase number>
---

Produce an implementation plan for: $ARGUMENTS

Do not write code, create migrations or change any configuration.

1. Read `CLAUDE.md`, `PROJECT_STATUS.md`, `docs/development/DEVELOPMENT_PRD.md`, and the relevant sections of `docs/source/REQUIREMENT_PRD.md`.
2. Read the supporting documents for this module in `docs/development/`, and find its phase in `10-development-roadmap.md`.
3. Inspect the current code for this module. Treat it as existing state, not as the specification.
4. Report:
   - The goal and the requirement IDs covered (Development PRD §13)
   - Dependencies, and whether they are complete
   - Database, operation, permission and UI requirements
   - Files likely to change
   - Tests to add, by test ID
   - Open questions or missing decisions that block this module. Do not guess the answers.
5. Stop, and wait for explicit instruction before writing code.
