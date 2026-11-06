# 11. UI Design System

Part of the [Development PRD](DEVELOPMENT_PRD.md). Added by owner decision J7.

## Sources

| Source | Role |
|---|---|
| Company image, `design_resources/visitx/nagorik.jpeg`, supplied by the owner on 2026-11-05 | **Base color.** Stored in the repository, unchanged (OQ-15). |
| `design_resources/NagorikPass Visitor Management Showcase-1.png` | **Layout and style.** "I want to make the design like this." |
| [Requirement PRD](../source/REQUIREMENT_PRD.md) and [Development PRD](DEVELOPMENT_PRD.md) | **Behavior, fields and wording.** These win over any image. |

The old `previous-work/docs/UI_DESIGN_SYSTEM.md` isn't used. Sample names, numbers, dates and charts in the Showcase are mock data.

## Color tokens

**These are the official brand tokens (OQ-15, decided 2026-11-05).** They were sampled from the company image, `design_resources/visitx/nagorik.jpeg`, and the owner confirmed them as the values to follow. Don't replace them without the owner's approval. The logo mark is slightly duller than the Showcase's button purple (`#5125B7`), and the owner directed that the company color is the base.

| Token | Value | Use | Source |
|---|---|---|---|
| `--color-primary` | `#403090` | Primary buttons, links, focus | Logo mark |
| `--color-primary-hover` | `#382880` | Hover and pressed | Logo mark, darker area |
| `--color-primary-bright` | `#4838A0` | Accents, active fills | Logo mark, lit area |
| `--color-sidebar` | `#2A1B6D` | Sidebar | Showcase, same hue family |
| `--color-ink` | `#101828` | Main text | Logo wordmark |
| `--color-app-bg` | `#F4F3FC` | Page background | Showcase |
| `--color-surface` | `#FFFFFF` | Cards, forms, tables | Showcase |
| `--color-border` | `#F1F1FA` | Soft card edges | Showcase |
| `--color-success` | `#1BA356` | Available, Checked Out, success icon | Showcase |

Status tints, muted text and field borders aren't fixed here. Choose them in Phase 7 and check contrast. The amber, green and blue in the office photo are interior decoration, and are treated as outside the brand base unless the owner says otherwise.

## Contrast

White text measured on the main fills:

| Fill | Ratio |
|---|---|
| `#403090` | 10.3:1 |
| `#2A1B6D` | 14.2:1 |

Body text must reach 4.5:1, and large text and interface edges 3:1. Status is never shown by color alone.

## Layout from the Showcase

- **Login:** split screen, with a purple panel with brand and welcome text on the left and the form on the right. Includes the Continue with Google button below Sign In.
- **Shell:** full-height purple sidebar with logo, navigation and user block at the bottom. The active item is a filled, brighter pill. Light page background with white rounded cards.
- **Dashboard:** row of KPI cards with tinted icons, an activity chart beside today's visitors.
- **Tables:** white container, clear headings, soft separators, a primary action button per row, search above.
- **Forms:** labels above fields, required marks, rounded inputs, primary and secondary buttons at the bottom.
- **Dialogs:** centered with a large status icon, a short message, and two buttons.
- **Mobile reception:** purple top bar, large action cards, today's list, bottom navigation.
- **Import:** dashed drop zone with Excel icon, primary button, success banner.
- **Employee:** My Visitors with Upcoming and Past tabs.

## Where the Showcase differs from the requirements

The requirements win.

| In the Showcase | Build this instead | Reason |
|---|---|---|
| "Have you received the visitor card back?" | **"Did you get the visitor card back?"** | PRD §5 exact wording |
| Visitor Approval in the sidebar, Pending Approval KPI, Pending status | Not built | DEC-Q1 |
| Print Card button | Not built | Not requested |
| Card-punching illustration and "please punch the visitor card" | Not built | PRD §6.4, no machine integration |
| Card status Returned and In Use | Available and Issued (plus DEC-Q4 states) | PRD §6.4 |
| "Supported: .xlsx, .xls" | `.xlsx` only | ExcelJS |
| Notification bell and "Call Reminder" list | Not built unless requested | Not requested; notifications are Telegram |
| Global search bar | Search per list | Not requested |
| Mobile nav: Home, My Visitors, Profile | Home, Expected Visitors, Add New Visitor | PRD §6.2 |
| Purpose as a dropdown of categories | Separate free-text purpose and a category field | PRD §4, §4.1 |
| Illustration on the login panel | Optional; needs a licensed asset | Not requested |

**Continue with Google is included**, by owner decision DEC-G1.

## Continue with Google button

- Follow Google's branding guidelines: the official "G" mark, on a white button with a neutral border, labelled "Continue with Google". Don't recolor it purple.
- Place it below Sign In, after an "or" separator, as in the Showcase.
- Show progress while redirecting. Show denial and failure messages in the login page's alert area.

## Other rules

- **Typography:** Inter or a comparable sans-serif, with a small fixed scale.
- **Spacing:** a consistent spacing scale, with rounded corners and soft lavender-tinted shadows.
- **Interface language:** English (DEC-Q20).
- **Responsive:** full sidebar on desktop, compact navigation on tablet, stacked layout on mobile. Reception actions stay within easy reach.
- **States:** loading, empty, success and error on every screen.
- **Accessibility:** visible labels, keyboard use, visible focus.
- **Brand:** NagorikPass name with the company's mark once a usable logo file (SVG or PNG) is supplied. The company image is a photo of the office sign, which isn't suitable as a logo file. The Showcase's "N" mark is a mockup.

## Removed references

The four third-party "VisitX" screenshots that were in `design_resources/` aren't used. They were removed from the working folder during this work, and git still holds them.
