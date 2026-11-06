# NagorikPass — PRD Gap Analysis

Audit of 2026-11-04. The tracker said the PRD's requirements were done. Reading the PDF against the code, then running the app in a real browser, found the gaps below. Several were in my own earlier phases, and five could only be seen by running the app.

## Gaps found and fixed

| # | Gap | Root cause | Change | Found by |
|---|---|---|---|---|
| 1 | **Invited people could never set a password.** The invitation link pointed to `/auth/confirm`, which did not exist | Phase 2 built the sender, not the receiver | `/auth/confirm`, `/auth/accept`, `/auth/set-password` | Code review |
| 2 | Accounts stayed "Invited" for ever | `mark_account_active` was never called | Called at password setup and sign-in | Code review |
| 3 | The card dropdown was in a dialog; the PRD puts it in the visitor list | Misread of PRD 5 and 6.2 | `VisitRowActions` | PDF re-read |
| 4 | **The "Checked in" dialog, with the manual notification text, never appeared** | The server refresh removed the row holding the dialog. My first fix failed for the same reason | `CheckInOutcomeProvider` above the list | Browser |
| 5 | Settings not built | Deferred | `app_settings`, `/admin/settings`; HR contact shown after check-in | PDF re-read |
| 6 | Card monitoring lacked check-in time and check-out status | PRD list not followed exactly | Columns added | PDF re-read |
| 7 | **A deactivated host's name vanished from visit history** (PRD 6.6) | The view used the active-only directory | `employee_names` view | Code review |
| 8 | Dashboards did not update "automatically" | Server pages only refreshed on navigation | `AutoRefresh`, every 20 s, paused during dialogs | PDF re-read |
| 9 | A walk-in could be registered with no host | Host treated as optional, against workflows C and D | Required, except delivery | PDF re-read |
| 10 | Notifications lacked PRD 6.3 detail | Partial implementation | Phone, card, invited employee, check-in time | PDF re-read |
| 11 | Bangla names printed as "?" in every report form | Latin-only PDF font | Print view using browser fonts; the downloaded PDF still has the limit | Review |
| 12 | Reports had no scheduled time or organization name | Thin first version | Added | Review |
| 13 | No direct way to register a VIP visit | Generic form only | Register VIP visit button | PDF re-read |
| 14 | Colours contradicted the design system (status colours, secondary buttons, teal chart, sidebar labels) | Design system not followed strictly | See the matrix's design section | Design review |
| 15 | Field edges and switches 1.5:1; focus ring invisible on the sidebar | Soft lavender used for controls | New `control-border` token; white ring | Contrast check |
| 16 | **Check out clipped at tablet width; words split mid-word; tables scrolled sideways on phones** | Table columns and word breaking | Responsive columns, details fold under the name | Browser |
| 17 | Cards out of number order across pages ("10" before "2") | Database text sort | Sorted after reading | Review |
| 18 | Unnamed file inputs, small link targets | Oversight | Fixed | Browser sweep |
| 19 | Local `config.toml` allowed sign-up | Default left in place | `enable_signup = false`, local redirects | Review |

## Remaining blockers

| Blocker | Requirements | Needed |
|---|---|---|
| What are Visitor Approval, Pending Approval and Rejected for? (Q1) The PRD lists them but also says no approval is needed, and no workflow creates a record | A-5, A-7, A-14 | Your decision. I did not invent an approval workflow |
| WhatsApp or Telegram (Q10) | N-3, T-4 | A provider and credentials, and your choice |
| Public sign-up is ON on the hosted project | X-2 | You change the dashboard setting |
| Receptionist editing after registering (Q16) | RO-R4 | Your decision |
| What Settings must contain (Q13) | A-20 | Your decision |
| Real Supabase not exercised for most flows | T-2, X-1, and all "local" rows | Migrations and functions on Supabase, or a staging project |
