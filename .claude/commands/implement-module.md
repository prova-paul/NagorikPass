---
description: Implement one explicitly approved NagorikPass module
argument-hint: <approved module name or phase number>
---

Implement only this approved module: $ARGUMENTS

Before starting, confirm that the user has explicitly authorized implementing this module. If not, stop and ask.

1. Read `CLAUDE.md`, the approved plan, and the relevant documents in `docs/development/`.
2. Stop and ask if a required decision is open, or if documents conflict.
3. Follow the approved architecture, database design and permission matrix:
   - Enforce authorization in server code and in the database.
   - Do not run migrations or change hosted or external configuration without separate approval.
   - Do not add unapproved dependencies.
4. Include validation, error handling, and loading, empty, success and error states.
5. Add the tests for this module from `08-testing-strategy.md`, and run them along with type checks and lint.
6. Avoid unrelated changes.
7. Update `PROJECT_STATUS.md`, and any document whose content changed. Mark tasks complete only when verified.
8. Report every file changed, actual test results, and anything skipped. Do not commit unless asked.
