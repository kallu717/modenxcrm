# Test report — 10 Nov 2026

Branch `feature/location-assignment` (city ownership, managers as owners, merged
city spellings, account page, pages on Leads and Accounts, Dashboard, Mark paid,
themes, bulk account actions, new name, logo, your own dashboard). Plan:
[TEST_PLAN.md](TEST_PLAN.md), 189 planned cases, 78 of them negative.

## Summary

| Layer | Result | What it covers |
|---|---|---|
| Front-end tests (Vitest) | **204 / 204 pass** | Business rules behind every screen, incl. new LOC, ASG, CITY, PAGE, ROLE, PAGING, DASH, PAID, THEME, BULK, WIDGET sections |
| Server tests (pytest, real Postgres 16) | **77 / 77 pass** | API rules, permissions, sync, records, ingest, migrations |
| Checks against a running server (`backend/scripts/qa_checks.py`) | **24 / 24 pass** (15 negative) | Sanity + new rules over real HTTP and sessions |
| Screen checks in a browser (Chromium, dev sign-in, real Lead Desk data: 1,906 contacts, 502 accounts) | **79 / 79 pass** after 2 fixes | Every screen flow below |
| Type-check, lint, production build, production audit | Clean; 0 vulnerabilities | |

Environment: Windows 11, Python 3.12, Node 24, Next.js 16.4.4, local Postgres 16,
`DEV_LOGIN=true`. Users: Priya and Arjun (Rep), Meera (Manager, standing in for
RK), Asha (Admin), New Hire (Pending).

## Defects found and fixed in this run

| # | Case | Problem | Fix | Re-test |
|---|---|---|---|---|
| 1 | PAGE-17 | Old links (`/accounts?account=…`) built the whole 502-account list before moving on to the account page: 3.5–8 s | Skip building the list when redirecting | Pass |
| 2 | PAGE-13 | Clicking a city's contact count filtered the list but didn't scroll to it (smooth scrolling stalled) | Instant jump | Pass: list in view, filtered |
| 3 | — | Test IDs collided: new L/M/N/O tests reused existing IDs; R1–R3 used twice | Renamed to LOC, ASG, CITY, PAGE, ROLE | No duplicates |
| 4 | — | Outdated test descriptions still said "only sales reps can be given leads" and "1 account = 1 rep" | ROLE3 now checks reps **and managers** can own leads, admins can't | Pass |

## Open findings (not fixed, need a decision or a later change)

| # | Finding | Why it matters | Suggestion |
|---|---|---|---|
| A | ~~Leads draws all 1,906 rows at once: 4.7 s to open~~ **Fixed**: Leads and Accounts now show 50 rows a page; Leads opens in 0.9 s | — | — |
| B | The app loads every visible lead at sign-in: 108 KB, ~1.8 s for 1,906 leads | Fine today; grows with data | Measure on a production build on the real server; load per page later if needed |
| C | A rep who owns some cities of a multi-city account can ask to rename the **whole** account | Approval is still a manager's call, so it's safe | Confirm this is wanted, or limit account edits to managers for split accounts |
| D | Reports' "stuck accounts" now lists every city (Reliance alone is 77 rows) | Long table | Group by account with a count, expand on click |
| E | Speed numbers above are from development mode | Not representative | Run a timing pass on a production build (Phase 3) |
| F | **Priority scoring barely recognises real job titles**: only 5 of 1,906 contacts were Hot, and **none** since the Bengaluru bonus was removed (Lead Desk rates 687 as hot). The CRM scores titles by an exact list of 11 demo titles ("Leasing Head", "Founder"…); only 28 real contacts match, everyone else gets the lowest title score | Hot/Warm filters and "who to call first" are misleading on real data | Score titles by keywords (CEO, Director, Head, VP, Manager…), same rule on server and screens |

## Not tested (and why)

- **Entra ID sign-in (AUTH-11)**: no Azure credentials yet.
- **Docker images, compose file, GitHub Actions**: not run on this machine.
- **Other browsers, phones and tablets**: only Chromium on desktop was used.
- **Accessibility** (screen readers, keyboard-only use): not tested.
- **Two people editing at the exact same moment through the screens**: the server side is covered (LEAD-11, SYNC tests); not tried with two live browsers.

## Screen checks (UI), all pass

| Case | Checked | Seen |
|---|---|---|
| SAN-02 ✗ | Open Accounts signed out | Sent to "Sign in with Microsoft" |
| SAN-03 | Sign in as Meera | Pipeline; "Meera Iyer · Manager" |
| SAN-05 | Every tab | Pipeline, Leads, Accounts, Follow-ups, Reports, Revenue, Calendar load; no console errors (Leads slow, finding A) |
| SAN-07 | Sign out | Back to sign-in |
| SAN-10 ✗ | New Hire (Pending) signs in | "Waiting for access" screen; no tabs |
| PAGE-01 | Click Reliance Retail | `/accounts/view?name=Reliance%20Retail`; no side panel |
| PAGE-02 | Header | 301 contacts · 77 cities · 2 owners · 73 unassigned · 1 follow-up due |
| PAGE-03 | Owner chips | Arjun 3 cities / 94, Meera 1 / 31, Unassigned 73 / 176; Arjun's chip shows his 3, again shows all 77 |
| CITY-01 | City list | "Gurugram" row; no "Gurgaon" row |
| PAGE-04 | Search "KOL", "pur" | Kolkata + Akola; 14 cities containing "pur" |
| PAGE-05 ✗ | Search "zzzz" | "No cities match." · Showing 0 of 77 |
| PAGE-06 | Unassigned / Assigned / All | 73 (all truly unassigned) / 4 / 77 |
| PAGE-07 | Sort City, Contacts | A→Z with ↑; biggest first |
| MGR-04 | Owner picker | Priya, Arjun, Meera (manager); no admin |
| PAGE-10 ✗ | Tick a city, press Assign with no person | Button disabled; nothing changed |
| PAGE-12 | Clear selection | Bar gone |
| PAGE-11 | Filter "pur" (14), select all | Exactly 14 selected |
| PAGE-09 | Tick Lucknow + Jaipur → Priya → Assign | Both saved (database checked) |
| PAGE-08 | Pune's row → Priya | Saved (database checked) |
| PAGE-13 | Click Kolkata's / Lucknow's count | Contacts filtered to that city, scrolled into view (after fix 2) |
| PAGE-18 | "open account" on a contact; Reports stuck rows | Both link to the account page |
| PAGE-17 | Old `/accounts?account=…` link | Lands on the account page (after fix 1) |
| PAGE-14 | One-city account (Laguna India, 30 contacts) | Single Owner card, one picker, no city table |
| PAGE-16 ✗ | Account that doesn't exist | "isn't here" message |
| MGR-05 | Reports and Revenue | Meera listed with the reps in performance, targets and revenue by person |
| PAGE-19 | Rename Laguna India → "… QA" → back | Page followed both times; database back to original with 30 contacts |
| UI-05 ✗ | New lead: empty form; bad email | "Fill in all required fields."; "That email doesn't look right."; nothing created |
| UI-04 | New lead, valid | "QA Tester added — unassigned"; 1,907 rows |
| UI-06 ✗ | Import: 1 good, 1 duplicate (other capitals), bad type, no name | Preview 1 ready / 1 duplicate / 2 rejected with reasons; only the good row imported |
| UI-01 | Set QA Tester to Contacted, reload | Still Contacted |
| Delete | Delete the QA account | Warned with contact count; back to Accounts; database back to 1,906 |
| PAGE-15 ✗ | Arjun (Rep) opens Reliance Retail | Only his 3 cities; no tick boxes, no pickers |
| LOC-14 | Arjun's contacts on that page | 94, all his |
| PAGE-20 ✗ | Arjun renames the account | Sent for approval; name unchanged; edit locked |
| UI-02 | Arjun edits a contact's phone | Marked "edit pending" |
| UI-03 ✗ | Arjun: Reports, Revenue | Tabs hidden; typed addresses go back to Pipeline |
| UI-09 ✗ | Arjun: Settings | Tab hidden; address goes back to Pipeline; server answers 403 |
| REC-01 | Meera approves the phone edit | Applied to the contact; server recorded Meera |
| REC-02 ✗ | Meera rejects the rename | Nothing renamed: 301 still "Reliance Retail", 0 "Reliance Retail Ltd" |
| UI-07 | Arjun requests leave; Meera approves | Approved; leave day for Arjun on 20 Nov saved |
| UI-08 | Asha gives New Hire "Sales Rep" | Saved; New Hire signs in straight to Pipeline |
| AUTH-07 ✗ | Asha's own row in Settings | Role picker locked, "That's you" |
| PAGING-01 | Meera opens Leads | 50 rows, "Showing 1–50 of 1,906 leads", ‹ Prev 1 2 3 4 … 39 Next ›; opens in 0.9 s (was 4.7 s) |
| PAGING-02 | Next, page 4, Prev | Right rows each time; list scrolled back to its top |
| PAGING-03 | Page 39 | 6 rows (1,901–1,906); Next disabled |
| PAGING-04 | Rows per page 100 on page 3 | 20 pages; back on page 1 |
| PAGING-05 | City filter Bengaluru while on page 3 | Page 1 of the filtered list |
| PAGING-06 | Accounts (502, 11 pages): page 3, open Godrej Capital, Back | Page 3 again, same filters |
| PAGING-07 | Leads with a filter, go to Accounts, come back | Filter and page kept; clearing the filter goes to page 1 |
| PAGING-13 ✗ | Saved filters and page overwritten with junk ("not json at all", size 7, page -4) | Page opened with no filter, 50 a page, page 1 |
| PAGING-14 ✗ | Arjun signs in after Meera on the same browser | Arjun sees his own unfiltered page 1, not Meera's |
| DASH-01 | Open the site as Meera | Went to /dashboard; "Dashboard" first tab; tab title "bdCRM for ModenX" |
| DASH-02/03 | Meera's day | Tiles 0 overdue · 1 today · 0 meetings · 0 payments · 0/8 calls; Aditi Toley listed for today with "Contacted" |
| DASH-05 | Test meeting tomorrow 11:30 (Video) | "Tomorrow · 11:30 AM · Pankaj Singh · Reliance Retail · Video · Renewal check-in" |
| DASH-10/11 | Your team | 650 cities with no owner (1,767 contacts), stuck 0, revenue Nov ₹3,000; team table for 4 sellers |
| DASH-12 ✗ | Arjun's dashboard | Only his day (102 not contacted yet); no team section; no Reports tab |
| DASH-13 | Asha (Admin) | Team section and "People waiting for access"; no personal tiles |
| PAID-01 | Test deal started 8 Oct (Growth) | Listed "2d overdue · Sun, 8 Nov · ₹3,000", red |
| PAID-02 | Log reminder | Row stayed, "Reminder sent" |
| PAID-03 | Mark paid | Row gone; revenue tile "₹3,000 marked paid"; server record `L048@2026-11-08`, marked by Meera, paid on 10 Nov |
| PAID-05 ✗ | Arjun sends a "paid" for Meera's account straight to the server | 403 |
| THEME-01..03 | Name menu → Themes → Midnight | Menu: Themes, Log out; 10 cards; whole app turned navy; tick on Midnight |
| THEME-04 | Reload with Terracotta chosen | Still Terracotta |
| THEME-05 ✗ | Saved theme set to `hacker;color:red` | Ignored; app followed the device |
| BULK-01/02 | Tick 2 accounts, then the header box | "2 accounts selected (8 contacts)"; then "50 accounts selected (171 contacts) · Select all 502 matching"; ticking didn't open the account |
| BULK-03/04 ✗ | Assign disabled until a person chosen; then Kreedo + LetsTransport to Arjun | Both saved on the server as Arjun's |
| BULK-09 ✗ | Delete Lotus Mall, Cancel | All 4 contacts still there |
| BULK-10 ✗ | Arjun on Accounts | No tick boxes |
| WIDGET-01 | Meera, Arjun, Asha with nothing saved | Manager 11 widgets (selling + team); rep 8 (no team); admin 6 (team + access + roster) |
| WIDGET-02/04 | Meera: Edit; Follow-ups wider ×2 and taller by keyboard; Payments corner dragged left | Follow-ups 6×5 → 8×6; Payments stopped at its 5-column minimum |
| WIDGET-05 | Move "Stuck" earlier; remove "Hot" | Done |
| WIDGET-06 | Gallery as Meera | My work, My numbers, Team; 15 to add, 10 marked "On your dashboard" |
| WIDGET-07 | Add Leaderboard and Revenue, Done, reload | Both on top; server record holds all 12 in order with sizes; same after reload |
| WIDGET-03 | Drag Approvals onto Revenue | Approvals now first |
| WIDGET-10 | Add every remaining widget (25 in all) | All rendered, no console errors |
| WIDGET-08 | Cancel | Back to the saved 12 |
| WIDGET-12 ✗ | Arjun saves "Team today" straight to the server | 403; his gallery shows only My work and My numbers |
| WIDGET-14 ✗ | Arjun saves Meera's dashboard | 403 |
| WIDGET-18 | Phone width | Every widget full width, no sideways scroll |

## Checks against a running server (API), all pass

```
SAN-01  health endpoint answers ok
SAN-02  ✗ not signed in: /api/me is refused (401)
SAN-04  bootstrap has me, team, leads, records
SAN-08  ✗ a save without the CSRF header is refused (403)
SAN-09  ✗ an unknown API address is 404
SAN-10  ✗ someone still Pending sees no data (403 pending)
LOC-01  Bengaluru to Priya and Mumbai to Arjun in one account
LOC-14  each rep sees only their own city of the shared account
LOC-02  ✗ a city can't have two owners (409 location_has_two_owners)
CITY-01 ✗ Gurgaon and Gurugram count as one city (409)
LOC-06  a new city under an assigned account starts unassigned
LOC-07  a rep's own find in a new city is theirs
LOC-08  ✗ a rep's contact in someone else's city stays with that owner
LOC-15  ✗ a rep can't assign a city (403 needs_manager)
LOC-16  ✗ assigning to a person who doesn't exist is refused (422)
MGR-01  a manager can own a city
MGR-02  ✗ an Admin can't own a city (422)
MGR-03  ✗ someone Pending can't own a city (422)
MGR-08  ✗ the machine-import account is never on the team
SAN-06  a stage change saves and is still there on reading back
LEAD-11 ✗ saving an out-of-date copy is refused (409)
LEAD-08 ✗ a rep can't read another rep's lead (404)
SAN-07  after signing out, /api/me is refused
24 of 24 checks passed
```

## How to run it again

```bash
npm test                                         # front end, 204
cd backend && pytest -q                          # server, 60 (needs Postgres)
python scripts/qa_checks.py http://<server>      # running server, 24 (DEV_LOGIN on; never production)
```

Then repeat the UI cases from the plan on screen. After a deployment, the
sanity cases (SAN) are the minimum.
