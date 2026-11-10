# Test report — 10 Nov 2026

Branch `feature/location-assignment` (city ownership, managers as owners, merged
city spellings, account page). Plan: [TEST_PLAN.md](TEST_PLAN.md), 115 planned
cases, 51 of them negative.

## Summary

| Layer | Result | What it covers |
|---|---|---|
| Front-end tests (Vitest) | **147 / 147 pass** | Business rules behind every screen, incl. new LOC, ASG, CITY, PAGE, ROLE sections |
| Server tests (pytest, real Postgres 16) | **60 / 60 pass** | API rules, permissions, sync, records, ingest, migrations |
| Checks against a running server (`backend/scripts/qa_checks.py`) | **24 / 24 pass** (15 negative) | Sanity + new rules over real HTTP and sessions |
| Screen checks in a browser (Chromium, dev sign-in, real Lead Desk data: 1,906 contacts, 502 accounts) | **42 / 42 pass** after 2 fixes | Every screen flow below |
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
| A | **Leads draws all 1,906 rows at once**: 4.7 s to open in development mode | Will get slower as data grows | Paging or "show more" on Leads |
| B | The app loads every visible lead at sign-in: 108 KB, ~1.8 s for 1,906 leads | Fine today; grows with data | Measure on a production build on the real server; load per page later if needed |
| C | A rep who owns some cities of a multi-city account can ask to rename the **whole** account | Approval is still a manager's call, so it's safe | Confirm this is wanted, or limit account edits to managers for split accounts |
| D | Reports' "stuck accounts" now lists every city (Reliance alone is 77 rows) | Long table | Group by account with a count, expand on click |
| E | Speed numbers above are from development mode | Not representative | Run a timing pass on a production build (Phase 3) |

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
npm test                                         # front end, 147
cd backend && pytest -q                          # server, 60 (needs Postgres)
python scripts/qa_checks.py http://<server>      # running server, 24 (DEV_LOGIN on; never production)
```

Then repeat the UI cases from the plan on screen. After a deployment, the
sanity cases (SAN) are the minimum.
