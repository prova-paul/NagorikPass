# NagorikPass — Proposed Excel import templates

**Status: proposal for your confirmation. Nothing here is built.** The PDF only says that HR/Admin uploads an
Excel file of card numbers (PDF 6.4, "for example, 50 card numbers") and an Excel file of "interview candidate
details" (PDF 6.5). It gives no columns, limits or rules (question Q9). Everything below is my proposal, kept as
small as the PDF allows.

## Rules for both files

| Topic | Proposal |
|---|---|
| File type | `.xlsx` only |
| Size | Up to 2 MB and 1,000 data rows |
| Layout | First sheet, header in row 1, one record per row. Blank rows are ignored |
| Headers | Matched ignoring case and surrounding spaces. A missing required header rejects the whole file with a clear message. Extra columns are ignored and listed as a note |
| Cell values | Read as text and trimmed. This matters for cards: `001` stays `001` and does not become `1` |
| Outcome | **Partial import.** Valid rows are saved. Every rejected or skipped row is shown with its row number and reason. Nothing already saved is ever overwritten |
| Re-uploading a fixed file | Safe. Rows already saved are reported as "already registered" and skipped |
| Who | HR/Admin only, enforced in the database as well as the screen |
| Where it is checked | The browser reads the file and shows a preview. The database function **validates every row again** before saving, so a hand-built request cannot skip the rules |
| Reader library | `read-excel-file` (see below) |

## Template 1 — Visitor cards

| Card Number |
|---|
| 001 |
| 002 |
| 003 |

- One required column, `Card Number`.
- A row is rejected when the number is empty, or longer than 50 characters.
- A number already registered is skipped as "already registered", compared ignoring letter case.
- The same number twice in the file: the first is saved, later ones are rejected as duplicates.
- Saved cards start as Available and appear for the Receptionist (PDF 6.4).

## Template 2 — Interview candidates

| Candidate Name | Phone Number | Interview Date | Interview Time | Company / Organization | Invited By | Purpose |
|---|---|---|---|---|---|---|
| Mitali Das | 01887654321 | 2026-11-10 | 10:00 | Example Ltd | Nusrat Jahan | Interview for Accounts Officer |
| David Smith | 01555566666 | 2026-11-10 | 11:30 | | | |

| Column | Required | Rule |
|---|---|---|
| Candidate Name | **Yes** | Not empty |
| Phone Number | **Yes** | Not empty. Spaces and hyphens are removed, as in manual registration |
| Interview Date | No | An Excel date, or `YYYY-MM-DD` |
| Interview Time | No | An Excel time, or `HH:MM` in 24-hour form. Give **both** date and time, or neither |
| Company / Organization | No | Free text |
| Invited By | No | An employee's full name, matched ignoring case. No match: the typed name is kept as it is, as in workflow C. Two employees with that name: the row is rejected as ambiguous |
| Purpose | No | If blank, **"Job interview"** is used (see question E5) |

Every imported candidate becomes: category **Job Interview**, status **Expected**, source **import**,
registered by the HR/Admin who uploaded the file. They then appear in the Receptionist's Expected Visitors
(workflow E). Number of guests is not a column; each candidate counts as 1.

Duplicates: a row is skipped as "already imported" when an Expected visit already exists for the same name and
phone with the same interview date and time (or the same name and phone when no schedule is given). The same
row twice in the file: the first is saved.

Times are read in the organization's time zone, Asia/Dhaka, which is the assumption already written into the
database (tracker assumption 9).

## Reader library

I compared the options on npm today, each installed alone in a scratch folder:

| Library | Packages installed | Known vulnerabilities | Notes |
|---|---|---|---|
| **`read-excel-file` 9.3.14** | **7** | **none** | MIT, updated 2026-10-29. Reads `.xlsx` only, runs in the browser |
| `exceljs` 4.4.0 | 193 | 9 moderate | Last release December 2024; large |
| `xlsx` (npm, 0.18.5) | 9 | 1 **high** (prototype pollution) | The npm copy is no longer the maintained one |

I recommend `read-excel-file`. It will be added when the importer is built, not before. A PDF library is **not**
needed yet; the report PDF is decided in Phase 7.

## Please confirm or change

- **E1** `.xlsx` only. (Older `.xls` files would need another library. The reference image mentions `.xls`, but the PDF does not.)
- **E2** The limits: 2 MB and 1,000 rows.
- **E3** Partial import with a per-row report, instead of all-or-nothing.
- **E4** The card template is the single column `Card Number`.
- **E5** The candidate columns above, and "Job interview" as the purpose when the Purpose column is blank. The PDF makes purpose mandatory but says nothing about the import.
- **E6** Interview date and time given together, or not at all. (Scheduled times are optional in the schema; Q14.)
- **E7** The browser reads the file and the database re-checks every row.
- **E8** Whether you also want a **Download template** button on each import screen. It is not in the PDF, so I will not add it unless you say so.

Reply "confirmed" to accept everything as written, or list the changes.
