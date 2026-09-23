# ModenX CRM — frontend test cases

Real-world scenarios for the business logic behind every screen. Each case ID
matches a test name in `tests/*.test.ts`. All tests run with the clock pinned to
**Wed 23 Sep 2026, 10:00 IST** and the timezone set to **Asia/Kolkata**, unless a
case says otherwise.

Run with `npm test`.

## A. Dates (India timezone)

| ID | Scenario | Expected |
|---|---|---|
| A1 | Rep opens the app at 00:30 IST on 23 Sep (still 22 Sep in UTC) | "Today" is 23 Sep, not 22 Sep |
| A2 | Rep opens the app at 23:50 IST on 23 Sep | "Today" is still 23 Sep |
| A3 | Follow-up set 1 day after 31 Jan; 1 day after 28 Feb 2028 (leap year) | 1 Feb; 29 Feb 2028 |
| A4 | Days until today / tomorrow / 3 days ago | 0 / 1 / -3 |
| A5 | Follow-up label for today, tomorrow, yesterday, 3 days ago | "Today · …", "Tomorrow · …", "Yesterday · …", "3d overdue · …" |
| A6 | Follow-up bucket for past, today, future, none | overdue / today / upcoming / null |
| A7 | "This Fri" picked on a Friday; picked on a Saturday | That same Friday; the following Friday |
| A8 | Meeting time 00:30, 12:00, 15:05 shown in 12-hour form | 12:30 AM, 12:00 PM, 3:05 PM |
| A9 | Date range check with only a start, only an end, or neither | Open ends are unbounded |

## B. Priority scoring

| ID | Scenario | Expected |
|---|---|---|
| B1 | Bengaluru Leasing Head, verified email, found in 2 sources | 15+12+10+5 = 42 → Hot |
| B2 | Mumbai Store Manager, no email | 5 → Low |
| B3 | Chennai Category Manager, catch-all email | 10+4 = 14 → Nurture |
| B4 | Unknown job title ("Intern") | Scores the default +5, reason shows "+5" |
| B5 | Band edges: 30, 29, 20, 19, 12, 11 | Hot, Warm, Warm, Nurture, Nurture, Low |
| B6 | Imported city written "bengaluru" or "Bangalore" | Still gets the +10 flagship bonus |
| B7 | Rep overrides Nurture to Hot, then picks the auto band again | Override set, then cleared back to auto |

## C. Working days (call targets)

| ID | Scenario | Expected |
|---|---|---|
| C1 | Saturday / Sunday / Monday | Weekend / weekend / working |
| C2 | "Last 7 working days" ending Wed 23 Sep, no holidays or leave | Starts Tue 15 Sep (skips one weekend) |
| C3 | Same, with a company holiday on Fri 18 Sep | Starts one working day earlier (Mon 14 Sep) |
| C4 | Priya on leave Mon 21 Sep; Arjun not | Priya's span starts a day earlier than Arjun's |
| C5 | Working days in a custom range with a weekend, a holiday and a leave day | Only true working days counted |
| C6 | Custom range with no start date | Working days is "—" (null) |
| C7 | "Last 7 days" calendar range | 17 Sep – 23 Sep, 7 days |
| C8 | Why a day is non-working, when it's both a Sunday and a holiday | "Weekend" |

## D. Subscription billing

| ID | Scenario | Expected |
|---|---|---|
| D1 | ₹1,06,000 formatting | Indian digit grouping: "₹1,06,000" |
| D2 | Mandate starts 31 Jan; today 10 Feb | Next debit 28 Feb (short month) |
| D3 | Mandate on the 15th; today the 16th | Next debit the 15th of next month |
| D4 | Mandate on the 5th; today 20 Dec | Next debit 5 Jan next year |
| D5 | Mandate starts 10 days from now | First debit is the mandate date itself |
| D6 | Lead not Won, or Won with no plan | No billing date |
| D7 | Mandate 14 Aug 2026; current quarter Q3 (Jul–Sep) | 2 billed months (Aug, Sep) — never counts future months |
| D8 | Same mandate, Q4 2026 (future) | 0 billed months |
| D9 | Mandate Jan 2026, Q2 2026 (fully past) | 3 billed months |
| D10 | Quarter revenue: Growth ₹3,000 × 2 months + Starter ₹1,000 × 3 | ₹9,000 |
| D11 | Six recent quarters from Q3 2026 | Q2 2025 … Q3 2026, crossing the year boundary |
| D12 | Debit due in 3 days | Listed under Payments due |
| D13 | Reminder logged for that debit | Drops off the list |
| D14 | A month later, next debit comes due | Shows again (reminder was for the old date) |
| D15 | Debit 8 days away | Not listed yet (7-day window) |
| D16 | Won with no plan recorded | Flagged "needs revenue details" |

## E. Account aging

| ID | Scenario | Expected |
|---|---|---|
| E1 | Furthest contact reached Qualified 40 days ago; owner since 100 days | 40 days |
| E2 | Account reassigned 5 days ago | 5 days (new rep isn't blamed for old history) |
| E3 | Aging buckets at 29, 30, 59, 60, 89, 90 days | ok, caution, caution, warn, warn, crit |
| E4 | Account whose furthest stage is Won | No aging shown |

## F. Account roll-up

| ID | Scenario | Expected |
|---|---|---|
| F1 | Three contacts at New, Proposal, Won | Furthest stage Won; highest priority wins |
| F2 | Domain from the first email; no emails at all | "studioweft.com"; "—" |
| F3 | Contacts in two cities | Both cities listed once |
| F4 | Only scheduled meetings counted | Done/cancelled meetings excluded |

## G. Filters

| ID | Scenario | Expected |
|---|---|---|
| G1 | Search "bandra", "l003", "STUDIO" | Matches city, lead ID and account, ignoring case |
| G2 | Filter "Unassigned" | Only leads with no owner |
| G3 | Priority filter "Hot" on a lead overridden to Hot | Included |
| G4 | Follow-up filters: overdue, today, this week, next 30 days, custom | Each returns only its dates |

## H. Spreadsheet import

| ID | Scenario | Expected |
|---|---|---|
| H1 | One fully valid row | 1 ready |
| H2 | Row missing Job title | Rejected, message says "Row 2" (row 1 is headers) |
| H3 | Type "brand" (lower case); type "Retail" | Accepted as Brand; rejected |
| H4 | Email already in the CRM | Skipped as duplicate |
| H5 | Same email twice in one sheet | Second one skipped |
| H6 | Header typed "  contact NAME " | Still recognised |
| H7 | Two rows for one new account; one row for an existing account | New accounts = 1 |
| H8 | Duplicate email differing only in case | Treated as duplicate |
| H9 | Phone stored as a number in Excel | Read as text |
| H10 | A real .xlsx file | Parsed to rows |

## I. Account assignment (1 account = 1 rep)

| ID | Scenario | Expected |
|---|---|---|
| I1 | Manager assigns an account to Arjun | Every contact there moves to Arjun |
| I2 | Reassigned from Priya to Arjun | Aging clock resets to today on all contacts |
| I3 | "Reassigned" to the same rep | Aging clock does NOT reset |
| I4 | Account unassigned | Owner and owner-since cleared |
| I5 | Reassignment | Activity says "reassigned from Priya Nair to Arjun Mehta by Meera Iyer" |

## J. Role visibility

| ID | Scenario | Expected |
|---|---|---|
| J1 | Priya logged in | Sees only her own leads |
| J2 | Meera (manager) logged in | Sees every lead, including unassigned |
| J3 | Can Priya edit Arjun's account? Her own? | No; yes |

## K. Adding leads (New Lead + Import)

| ID | Scenario | Expected |
|---|---|---|
| K1 | Rep adds a contact at a brand-new account | Assigned to that rep |
| K2 | Rep adds a contact at an account Arjun owns | Goes to Arjun, with a note explaining why |
| K3 | Manager adds a contact at a brand-new account | Stays unassigned |
| K4 | Email already used (different case) | Refused |
| K5 | No phone; no city | Accepted; refused |
| K6 | Contact marked "email verified" | Gets the +12 verified bonus |
| K7 | Rep imports two contacts for one new account | Both hers, with new unique IDs after the highest existing |
| K8 | Import a "Mall" contact for an existing Brand account | Contact joins as Brand — one account never has two types |
| K9 | Import "studio weft" when "Studio Weft" exists | Joins the existing account and its owner (no duplicate account) |

## L. Stage changes

| ID | Scenario | Expected |
|---|---|---|
| L1 | Stage changed; then set to the same stage again | History + activity added once; second is a no-op |
| L2 | Moved to Won; then moved back to Proposal | wonAt set to today; then cleared |
| L3 | Dragged on the board from New to Contacted | Activity "Moved from New to Contacted." |
| L4 | Subscription recorded | Plan + mandate saved, activity logged |

## M. Edit approvals

| ID | Scenario | Expected |
|---|---|---|
| M1 | Rep edits a phone number | Pending request; lead unchanged |
| M2 | Manager approves it | Phone updated, request approved |
| M3 | Manager rejects it | Lead unchanged |
| M4 | Manager edits directly | Applied at once, no request |
| M5 | Two requests filed | IDs CR001, CR002 — no gaps |
| M6 | Rep renames an account; manager approves | Every contact renamed |
| M7 | Rename to an existing account's name (any case) | Refused |
| M8 | Rename approved after another account took that name | Refused, request stays pending |
| M9 | Rep changes email to one another lead already uses | Refused (email is the duplicate key) |
| M10 | Lead with a pending request deleted | Request removed too |
| M11 | Account deleted | Its contacts' requests, account requests and payment reminders removed |

## N. Follow-ups, notes and meetings

| ID | Scenario | Expected |
|---|---|---|
| N1 | Follow-up set, then cleared | Saved, then null; activity logged each time |
| N2 | "Snooze 1 week" on a follow-up due in 2 days | Moves to 9 days from today |
| N3 | "Snooze 1 week" on a follow-up 10 days overdue | Lands 7 days from today — not still in the past |
| N4 | Marked contacted with next follow-up / with none | Date set / cleared |
| N5 | WhatsApp note logged by Priya | Counted as WhatsApp in her Reports stats |
| N6 | Meeting at 15:30 scheduled, then marked done | Shown as 3:30 PM; status done |

## O. Leave and holidays

| ID | Scenario | Expected |
|---|---|---|
| O1 | Priya requests leave for 5 Oct | Pending |
| O2 | Requests 5 Oct again | Refused |
| O3 | Manager approves | Approved leave recorded; Priya's working days drop |
| O4 | Manager rejects | No leave recorded |
| O5 | Requests a day already approved | Refused |
| O6 | Manager adds a holiday twice on the same date | Second refused |

## P. Reports

| ID | Scenario | Expected |
|---|---|---|
| P1 | Lead first contacted inside the range; another contacted before it | Calls = 1 |
| P2 | Lead reached Contacted twice (went back and forth) | Counted once |
| P3 | Onboardings = wins inside the range for that rep | Counted per rep |
| P4 | Arjun's WhatsApp note | Not counted in Priya's stats |
| P5 | Funnel with 4 leads created in range | Correct counts and conversion % |
| P6 | Funnel with nobody created in range | All zeros, no errors |
| P7 | Time in stage | Correct average and oldest |

## Q. Sign-in placeholder

| ID | Scenario | Expected |
|---|---|---|
| Q1 | Sign in | Signed in as Meera; survives a page refresh |
| Q2 | Log out | Signed out; refresh stays signed out |

## R. Demo data

| ID | Scenario | Expected |
|---|---|---|
| R1 | Seed data | 118 leads |
| R2 | Every account | At most one owner (1 account = 1 rep) |
| R3 | Any lead past New | Has an owner |
| R4 | Generating twice | Identical data (stable demo) |

---

## Bugs found — first run (111 / 116 passing)

| # | Test | What's wrong | Real-world impact |
|---|---|---|---|
| 1 | B6 | The Bengaluru flagship bonus only matches the exact spelling "Bengaluru". "bengaluru", "Bangalore" or a stray space loses the +10. | A Founder in "Bangalore" scores 15 (Nurture) instead of 25 (Warm), so imported leads get the wrong priority and sort lower on the board. |
| 2 | K8 | A contact added to an existing account keeps whatever account type the sheet says. | One account ends up both Brand and Mall. The Accounts screen shows one type, and the type filter splits the account. |
| 3 | K9 | When adding contacts, account names are matched case-sensitively. | Importing "studio weft" creates a second account beside "Studio Weft", possibly with a different owner, which breaks 1 account = 1 rep. The New Lead form even says "Existing account — owned by Arjun" (its check ignores case), then creates a separate account anyway. |
| 4 | M9 | A lead's email can be edited to one another lead already has, by a manager directly or through an approved rep request. | Duplicate emails creep in, and import relies on email to skip duplicates. |
| 5 | N3 | "Snooze 1 week" adds 7 days to the old due date, not to today. | A follow-up 10 days overdue gets "snoozed" to 3 days ago, so it's still overdue and the button looks broken. |
| 6 | (setup) | The test config file type triggers a tooling warning. | None for users; fixed so test output stays clean. |

## Fixes — second run (116 / 116 passing)

| # | Fix |
|---|---|
| 1 | Flagship check ignores case and spaces, and accepts "Bangalore" (`lib/scoring.ts`). |
| 2, 3 | A new contact (New Lead or Import) is matched to its account ignoring case, and takes that account's exact name, type and owner, including rows earlier in the same sheet (`lib/store.ts`). |
| 4 | Changing a lead's email to one another lead uses is refused on save, and again at approval. The Leads screen shows the reason (`lib/store.ts`, `components/LeadInlineDetail.tsx`). |
| 5 | Snoozing an overdue follow-up counts from today. Upcoming ones still move a week from their current date (`lib/store.ts`). |
| 6 | Test config renamed to `vitest.config.mts`. |
