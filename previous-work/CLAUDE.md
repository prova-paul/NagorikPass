# NagorikPass — AI Development Guide

## 1. Project identity
NagorikPass is a Visitor Management System (VMS) for an organization. It replaces manual visitor logs with a centralized system for visitor registration, expected-visitor tracking, check-in/check-out, visitor-card tracking, notifications, dashboards, history, and reports.

## 2. Source-of-truth rules
Read these files before making changes:
1. `docs/PRD.md` — functional requirements and business rules. This is the source of truth.
2. `docs/UI_DESIGN_SYSTEM.md` — visual direction and reusable UI rules.
3. `docs/SYSTEM_ARCHITECTURE.md` — approved architecture.
4. `docs/DATABASE_SCHEMA.md` — approved data model and database constraints.
5. `docs/IMPLEMENTATION_PLAN.md` — development sequence.
6. `docs/TESTING_STRATEGY.md` — quality and acceptance checks.

If documents conflict, do not silently choose one. Report the conflict and ask for clarification. Never invent a business requirement.

## 3. Design reference image
The user-provided visual reference is stored at:

`/Users/nagorik/Desktop/NagorikPass/design_resources/NagorikPass Visitor Management Showcase-1.png`

Inspect this image before implementing or changing UI. It is the visual reference for color, layout, component styling, spacing, and overall product feel. Do not copy sample names, dates, metrics, or other demo data from the image as real application data.

If the image is not available at that path in the current environment, ask the user to place it there or provide the correct path. Do not pretend to have inspected it.

## 4. Technology constraints from the PRD
- Frontend: React, TypeScript, Vite
- Styling: Tailwind CSS (implementation choice already selected for this project; keep consistent)
- Backend platform: Supabase
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- Authorization: role-based access control and database policies
- Receptionist experience: web and mobile-responsive web UI

Do not add another backend framework, database, or authentication provider without explaining the reason and receiving approval.

## 5. User roles
### HR/Admin
Can manage employees, receptionists, visitor records, expected visitors, visitor cards, interview candidate imports, VIP/group visits, dashboards, history, reports, settings, and notifications as defined in the PRD.

### Receptionist
Can view expected visitors, register unscheduled visitors, search for a host employee by permitted fields, check visitors in/out, assign available visitor cards, and confirm card return. Receptionists must not check in delivery personnel.

### Employee
Can register their own visitors directly through the employee web application without prior HR/Admin approval and coordinate those visitors.

## 6. Non-negotiable business rules
- Visitor name, phone number, and purpose of visit are mandatory.
- Visitor category/type must be recorded.
- Employee-initiated visitor registration does not require HR/Admin approval.
- An unscheduled visitor does not require additional employee approval once the visitor entry and host information are recorded.
- Delivery/courier personnel are not permitted to enter, must not be checked in, and must not receive a visitor card.
- Every card has a unique Card Number/ID.
- Only an Available card can be assigned.
- An Issued card cannot be assigned to another active visitor.
- Check-out is completed only after the receptionist confirms the card has been returned.
- If the card is not returned, the visitor remains Checked In and the card remains Issued.
- Preserve card issue/return history, including timestamps.
- Receptionists can see employee name and team only, not private employee information.
- Enforce authorization in Supabase policies/database, not only by hiding frontend controls.

## 7. Coding rules
- Use TypeScript types for application and database entities.
- Keep pages, reusable components, hooks, services, types, and utilities separated.
- Keep business logic out of presentation-only components.
- Reuse shared components and design tokens.
- Validate user input on the client and enforce important rules on the server/database side.
- Handle loading, empty, success, and error states.
- Do not put Supabase service-role keys or other secrets in frontend code.
- Do not use hardcoded demo data as production data.
- Do not delete or rewrite existing working code without inspecting it first.
- Avoid unnecessary dependencies.

## 8. Required agent workflow
For each task:
1. Read this file and the relevant documentation.
2. Inspect the existing repository and current implementation.
3. State the goal, files likely to change, and implementation approach.
4. Identify any unresolved requirement or security concern.
5. Implement one coherent feature at a time.
6. Run relevant checks/tests and report their actual results.
7. Update documentation if architecture, schema, behavior, or setup changes.

Do not start the whole product in one uncontrolled generation. Work phase by phase and wait for approval at the approval gates in `docs/IMPLEMENTATION_PLAN.md`.

## 9. Definition of done
A feature is done only when it:
- Meets the PRD and approved design system.
- Works for the correct role(s).
- Enforces relevant database authorization.
- Handles validation and edge cases.
- Has loading, empty, and error states where appropriate.
- Passes relevant tests.
- Is responsive where required.
- Has updated documentation when needed.
