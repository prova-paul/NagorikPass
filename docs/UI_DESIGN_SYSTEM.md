# NagorikPass — UI Design System

## 1. Design intent
Use the supplied image as the visual reference for a modern enterprise SaaS Visitor Management System. The visual direction is **Royal Purple + Lavender + White**, with clear hierarchy, spacious cards, subtle shadows, rounded corners, and restrained status colors.

Reference image path:
`/Users/nagorik/Desktop/NagorikPass/design_resources/NagorikPass Visitor Management Showcase-1.png`

Inspect the actual image before implementation. The palette below is a practical starting palette sampled/approximated from the reference, not a claim that every hex value is an exact pixel sample.

## 2. Color tokens
| Token | Hex | Intended use |
|---|---|---|
| `--color-primary` | `#2C1971` | Main sidebar, primary buttons, key actions |
| `--color-primary-hover` | `#45239B` | Hover/active primary controls |
| `--color-secondary` | `#7A67AF` | Secondary purple, accents |
| `--color-lavender` | `#DFDDF7` | Soft borders, accents |
| `--color-app-bg` | `#F3F2FD` | Main app background |
| `--color-surface` | `#FFFFFF` | Cards, forms, tables |
| `--color-text` | `#171329` | Main text |
| `--color-text-muted` | `#77738C` | Secondary text |
| `--color-success` | `#16A36A` | Checked-in/completed/available success states |
| `--color-warning` | `#F59E0B` | Pending/expected states |
| `--color-danger` | `#DC3545` | Rejected/errors/destructive actions |
| `--color-info` | `#2563EB` | Informational states |

Check text/background contrast before finalizing tokens. Do not use pale status colors for small text unless contrast is sufficient.

## 3. Global visual rules
- Main content background: very light lavender.
- Content surfaces: white.
- Sidebar: deep royal purple with white icons and labels.
- Active sidebar item: brighter purple surface with clear active indication.
- Primary action: deep purple with white text.
- Secondary action: white with purple border/text.
- Use subtle lavender-tinted borders and shadows.
- Avoid excessive gradients, glass effects, animation, and decorative clutter.
- Keep status colors meaningful and consistent.
- Never use color alone to communicate a status; include text or an icon.

## 4. Component guidance
### Sidebar and navigation
- Consistent width and spacing across role-based layouts.
- Logo/brand at top; role-appropriate navigation; user identity/actions at bottom.
- Clearly distinguish active navigation.
- On small screens, use an appropriate compact navigation pattern.

### Cards and KPI summaries
- White card surface, rounded corners, subtle border/shadow.
- KPI icon may sit in a lightly tinted circular/square container.
- Use purple as the primary visual accent; use green/orange/blue only for meaning.
- Avoid presenting every KPI in a different saturated color.

### Tables
- White container with clear column headings.
- Soft row separators.
- Consistent row height and alignment.
- Search, filters, pagination, and empty state where relevant.
- Responsive overflow or mobile-friendly alternative.

### Forms
- Visible labels; do not rely only on placeholders.
- Consistent field heights and spacing.
- Light lavender border; purple focus state.
- Inline validation and clear error messages.
- Distinguish required and optional fields.

### Dialogs and confirmations
- Use for consequential actions.
- Check-out must show the exact business confirmation: "Did you get the visitor card back?"
- A No response must not complete check-out.

### Status badges
Use text labels and consistent semantic colors:
- Available / Completed / Checked Out: success where appropriate.
- Issued / Checked In: use a distinct informational or purple state as appropriate.
- Expected / Pending: warning.
- Rejected / Error: danger.
Do not conflate visitor status and card status.

## 5. Typography and spacing
- Use Inter or a comparable legible sans-serif if available.
- Establish a small, consistent type scale for page titles, section titles, body, labels, and helper text.
- Use a consistent spacing scale rather than arbitrary per-page values.
- Ensure readable line height and accessible text sizes.

## 6. Responsive behavior
- Desktop: full sidebar and multi-column dashboard.
- Tablet: adapt navigation and reduce dashboard columns.
- Mobile: stack cards and forms; make receptionist check-in/out actions easy to reach.
- Receptionist workflows must remain usable on mobile-sized screens.

## 7. Screens in scope
Create consistent layouts for:
1. Login
2. HR/Admin Dashboard
3. Visitor Management
4. Visitor Approval (scope to be clarified)
5. Visitor History
6. Visitor Card Management
7. Employee Management
8. Receptionist Management
9. Reports
10. Settings
11. Receptionist Home
12. Expected Visitors
13. Add New Visitor
14. Employee Portal / My Visitors

## 8. Reference image usage
Use the image for visual direction only. Do not treat its sample names, phone numbers, dates, metrics, chart values, or notification content as real requirements or seed data. Follow `PRD.md` for behavior and fields.

## 9. Design acceptance checklist
- [ ] Consistent purple/lavender/white theme across roles.
- [ ] Sidebar, buttons, forms, cards, tables, and dialogs share tokens.
- [ ] All screens have loading, empty, error, and success states where applicable.
- [ ] Status labels are understandable without color.
- [ ] Responsive layouts work on desktop, tablet, and mobile.
- [ ] Contrast and keyboard focus are usable.
- [ ] No unrelated theme or arbitrary color palette introduced.

---

## Existing tokens against the reference image — 2026-11-04

The frontend already has a design system (`frontend/src/index.css`, `frontend/src/components/ui/`). It uses the v1 navy-and-purple direction. The reference image is royal purple.

### Colors sampled from the image
Read from pixels of `NagorikPass Visitor Management Showcase-1.png` (1536 by 1024). Approximate, because the image is a composite mockup.

| Use | Image | Existing token | This document's table |
|---|---|---|---|
| Sidebar | `#2a1874` to `#301b79` | `navy-950` `#11112f`, `navy-900` `#1c1c45` | `--color-primary` `#2C1971` |
| Primary button | `#441ab3` to `#4f23b7` | `primary-500` `#6c4ed0`, `primary-600` `#5d41bb` | `#2C1971`, hover `#45239B` |
| Active sidebar item | `#8363d6` | `primary-500` | not specified |
| Page background | `#faf9fd` to `#f3f2fd` | `canvas` `#f3f2f9` | `#F3F2FD` |
| Card | `#ffffff` | `surface` `#ffffff` | `#FFFFFF` |

Findings:
- The sidebar in the image is purple, not navy. This document's `#2C1971` matches it. The code's `navy-*` tokens do not.
- The image's buttons are a brighter purple than this document's `#2C1971`. `#4f23b7` fits the image; white text on it is about 9:1 contrast.
- White text on the active item `#8363d6` is about 4.4:1, just under 4.5:1 for small text. Use bold or larger text, or a slightly darker active color.
- The page background and card colors already match.

### Plan (not applied)
Change the token values in `index.css` (`navy-*` to the purple sidebar range, `primary-*` to the brighter button range, keep `canvas`, `surface`, `line`, `ink`, `muted`). Components use token names, so most screens follow. Then check the sidebar classes in `DashboardLayout.tsx`, and re-check status badge contrast. Show the result against the image before restyling anything else (Phase 2 gate).

### Elements in the image that the PRD does not request
Do not build without approval:
- **Continue with Google** on the login screen.
- **Print Card** in the check-in success dialog, and the card-punching machine illustration. The PRD says integration with a physical card machine is not required.
- A **notification bell** with an in-app list ("Call Reminder: Please call HR for card issue"). The PRD asks for notifications, not a bell.
- Sample names, dates, counts and chart values. These are mockup data.

### Screens in the image that map to PRD features not yet built
Visitor Card Management (table with Card No. and status, Returned or In Use), Import Interview Candidates (drop zone, `.xlsx` and `.xls`, success count), the card-return question dialog ("Have you received the visitor card back?", Cancel and Yes, Checkout), Add New Visitor with Invited By, No. of Guests and a category, Expected Visitors with a Check In action, and the employee My Visitors page with Upcoming and Past tabs. The dialog wording differs from the PRD's required text; use the PRD's: **"Did you get the visitor card back?"**

## Token alignment applied — 2026-11-04

- Tokens now follow this document: primary `#2C1971` (sidebar, primary buttons, focus), hover `#45239B`, lavender `#DFDDF7`, app background `#F3F2FD`, text `#171329`, lavender-tinted borders and shadows.
- Active sidebar item is the brighter purple `#6B4FC7` (white text, about 5.3:1). The reference's `#8363D6` was rejected: white on it is about 4.4:1.
- Muted text stays `#5E5D7A` (4.5:1 on the app background). The document's `#77738C` is used only for placeholders and icons (`subtle`) because it is 4.1:1 on `#F3F2FD`.
- Login is the split layout from the reference (gradient panel, "Welcome back!", icon-in-field inputs). Not copied, because the PRD does not request them: Google sign-in, illustration, search bar, notification bell.
- Sidebar bottom block shows avatar, name and role; the logo mark is an "N" monogram.
