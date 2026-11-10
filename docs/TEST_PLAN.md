# ModenX CRM — test plan

Every case has an ID, what is done, what should happen, and **how it is checked**:

| Code | Means | Where |
|---|---|---|
| **FE** | Automated front-end test (Vitest) | `tests/*.test.ts`, test name starts with the ID shown |
| **BE** | Automated server test (pytest, real Postgres) | `backend/tests/*.py`, function name shown |
| **API** | Check against a running server over HTTP | `backend/scripts/qa_checks.py`, case ID printed |
| **UI** | Check on screen in a browser | Done by hand or by an agent; see the latest report |

**Kinds of testing**
- **Sanity (SAN)**: "is it alive" checks. Run after every deployment, in a few minutes.
- **Progression (PRG)**: the new features on branch `feature/location-assignment`.
- **Regression (REG)**: what already worked and must keep working.
- **Negative (marked ✗)**: wrong role, bad input, stale data or a missing permission. The app must refuse, safely, with a clear message. Every area has them.

Results of each run go in `docs/TEST_REPORT.md`.

Test people (development sign-in): **Priya**, **Arjun** (Rep), **Meera** (Manager, also sells, stands in for RK), **Asha** (Admin), **New Hire** (Pending).

---

## 1. Sanity (SAN)

| ID | | Do | Expect | How |
|---|---|---|---|---|
| SAN-01 | | `GET /healthz` | `{"ok": true}` | API |
| SAN-02 | ✗ | Call `/api/me` without signing in | 401; the browser is sent to sign-in | API, UI |
| SAN-03 | | Sign in as a manager | Lands on Pipeline; name and role top right | UI |
| SAN-04 | | `GET /api/bootstrap` signed in | Contains me, team, leads, records | API |
| SAN-05 | | Open every tab as a manager: Pipeline, Leads, Accounts, an account page, Follow-ups, Reports, Revenue, Calendar | Each loads with no error | UI |
| SAN-06 | | Change a lead's stage, reload | Change is still there | API, UI |
| SAN-07 | | Sign out | Session ends; `/api/me` is 401 | API |
| SAN-08 | ✗ | Save without the `X-Requested-With` header | 403 | API, BE `test_state_changing_calls_need_the_csrf_header` |
| SAN-09 | ✗ | Open an address that doesn't exist (`/api/nope`) | 404, nothing else happens | API |
| SAN-10 | ✗ | Sign in as someone still Pending | Waiting-for-access screen; no data | API, BE `test_someone_without_a_role_sees_nothing` |

## 2. Progression (PRG): new features

### 2.1 Ownership by city (LOC)

A location is a city within an account. One owner per location; an account in one city has one owner.

| ID | | Do | Expect | How |
|---|---|---|---|---|
| LOC-01 | | Give Reliance · Bengaluru to Priya and · Mumbai to Arjun | Both saved; account shows 2 owners | BE `test_each_city_of_an_account_can_have_its_own_owner`, FE LOC2, UI |
| LOC-02 | ✗ | Give two Bengaluru contacts of one account to two different people | Refused (409 `location_has_two_owners`, names the city) | BE `test_one_location_never_has_two_owners` |
| LOC-03 | | Assign an account that is in one city | Whole account to that person, as before | FE LOC3 |
| LOC-04 | | "All locations to one person" on a multi-city account | Every city to that person, in one save | FE LOC4, BE `test_assigning_an_account_moves_every_contact_in_one_save` |
| LOC-05 | | Reassign one city | Other cities' owners and dates unchanged | FE LOC5 |
| LOC-06 | | Manager imports a contact in a new city of an assigned account | New city starts unassigned | BE `test_a_new_city_under_an_assigned_account_starts_unassigned`, FE K2c |
| LOC-07 | | Rep adds a contact in a new city of someone else's account | That city becomes the rep's | BE `test_a_rep_adding_a_contact_in_a_new_city_keeps_it`, FE K2b |
| LOC-08 | ✗ | Rep adds a contact in a city someone else owns | Stays with the owner; activity note says so; rep isn't handed it | BE same test, FE K2 |
| LOC-09 | | Manager corrects a contact's city to a city someone owns | Contact moves to that owner | FE LOC6 |
| LOC-10 | | Rep's city change is approved by a manager | Contact moves to the new city's owner | FE LOC8 |
| LOC-11 | | Contact moved to a city nobody owns | Keeps its current owner | FE LOC7 |
| LOC-12 | ✗ | Save a city change that would split a city between owners | Refused by the server (409) | BE `test_moving_a_contact_to_another_city_must_follow_that_citys_owner` |
| LOC-13 | | Blank city and "—" | Treated as one "No city" location | BE `test_city_names_are_matched_loosely_and_blank_city_is_one_location`, FE LOC1 |
| LOC-14 | | Rep opens a shared account | Sees only contacts in their own cities | BE `test_each_city…`, API, UI |
| LOC-15 | ✗ | Rep tries to assign a city (direct API call) | Refused (403) | API |
| LOC-16 | ✗ | Assign a city to a person id that doesn't exist | Refused (422) | API |

### 2.2 Managers can own accounts (MGR)

| ID | | Do | Expect | How |
|---|---|---|---|---|
| MGR-01 | | Assign a city to a Manager | Saved | BE `test_reps_and_managers_can_be_assigned_but_not_admins`, FE ASG1, UI |
| MGR-02 | ✗ | Assign to an Admin | Refused (422) | BE same test, API |
| MGR-03 | ✗ | Assign to someone Pending | Refused (422) | API |
| MGR-04 | | Owner pickers | List reps and managers ("(manager)"), never admins | FE ROLE3, ASG1, UI |
| MGR-05 | | Reports and Revenue | Every rep, plus managers who own accounts; not managers who don't | FE ASG2, UI |
| MGR-06 | | Change a Rep with leads to Manager, and back | Allowed; leads kept | BE `test_rep_and_manager_keep_their_leads_but_an_admin_cannot_own_any` |
| MGR-07 | ✗ | Change someone with leads to Admin | Refused until their leads are reassigned | BE same test |
| MGR-08 | ✗ | The machine-import account | Never on the team list or in pickers | BE `test_the_import_account_is_not_on_the_team`, API |

### 2.3 One city, many spellings (CITY)

| ID | | Do | Expect | How |
|---|---|---|---|---|
| CITY-01 | | Contacts in "Gurgaon" and "Gurugram" | One location, shown as Gurugram | BE `test_different_spellings_of_one_city_are_one_location`, FE CITY1, UI |
| CITY-02 | | Old names (Bangalore, Bombay, Calcutta…) | Same location as the current name | BE `test_location_key_handles_spellings_spacing_and_hyphens` |
| CITY-03 | | Capitals, extra spaces, hyphens | Ignored | BE same, FE CITY1 |
| CITY-04 | ✗ | Different places (Mumbai / Navi Mumbai) | Stay separate | BE same, FE CITY1 |
| CITY-05 | | New contact typed "Gurgaon" | Joins whoever owns Gurugram | BE, FE CITY2 |
| CITY-06 | ✗ | Server and screen city lists drift apart | A test fails | BE `test_server_and_screens_share_the_same_city_list` |

### 2.4 Account page (PAGE)

| ID | | Do | Expect | How |
|---|---|---|---|---|
| PAGE-01 | | Click an account in Accounts | Its own page opens; no side panel | UI |
| PAGE-02 | | Look at the header | Contacts, cities, owners, unassigned cities (managers), follow-ups due | UI |
| PAGE-03 | | Owner chips | One per owner with cities and contacts, unassigned last; click filters, click again clears | FE PAGE1, UI |
| PAGE-04 | | Find a city | Case doesn't matter; partial names match | FE PAGE2, UI |
| PAGE-05 | ✗ | Search for a city that isn't there | "No cities match."; nothing breaks | UI |
| PAGE-06 | | All / Unassigned / Assigned | Shows the right rows | FE PAGE3, UI |
| PAGE-07 | | Sort by City, Contacts, Stuck for | Order changes | FE PAGE2, UI |
| PAGE-08 | | Change one city's owner in its row | Saved on the server | UI + database |
| PAGE-09 | | Tick cities, choose a person, Assign | All saved together | FE PAGE4, UI + database |
| PAGE-10 | ✗ | Press Assign before choosing a person | Button disabled; nothing changes | UI |
| PAGE-11 | | "Select all" with a filter on | Selects only the rows shown | UI |
| PAGE-12 | | Clear selection | Bar disappears | UI |
| PAGE-13 | | Click a city's contact count | Contacts list below shows only that city | UI |
| PAGE-14 | | Account in one city | Single Owner card; no city table | UI |
| PAGE-15 | ✗ | Rep opens a multi-city account | Only their cities; no tick boxes, no pickers | UI |
| PAGE-16 | ✗ | Open a page for an account that doesn't exist, or none of it is yours | Friendly "isn't here" message | UI |
| PAGE-17 | | Old link `/accounts?account=…` | Redirects to the account page | UI |
| PAGE-18 | | "open account" on a contact; account name in Reports' stuck list | Goes to the account page | UI |
| PAGE-19 | | Rename the account on its page (manager) | Page follows to the new name | UI |
| PAGE-20 | ✗ | Rep tries to rename | Goes for approval, nothing renamed yet | FE M-section, UI |
| PAGE-21 | | Account names with `&`, spaces | Address works | FE PAGE5 |

### 2.5 Pages on Leads and Accounts (PAGING)

| ID | | Do | Expect | How |
|---|---|---|---|---|
| PAGING-01 | | Open Leads | 50 rows; "Showing 1–50 of 1,906 leads"; page buttons below | FE PAGING1–2, UI |
| PAGING-02 | | Next, a page number, Prev | Right rows; list jumps back to its top | FE PAGING1, UI |
| PAGING-03 | | Last page | Only the leftover rows; Next disabled | FE PAGING1, UI |
| PAGING-04 | | Rows per page 25 / 100 | Page count changes; back to page 1 | FE PAGING3, UI |
| PAGING-05 | | Change a filter on page 3 | Back to page 1 of the filtered list | UI |
| PAGING-06 | | Open an account from Accounts page 3, then Back | Same page and filters | UI |
| PAGING-07 | | Leave Leads with a filter, come back | Filter and page remembered (this browser tab only) | UI |
| PAGING-08 | | Many pages | First, last, current ±1, "…" for gaps | FE PAGING9 |
| PAGING-09 | ✗ | Page 0, a negative page, not a number | Page 1 | FE PAGING4 |
| PAGING-10 | ✗ | Saved page is past the end (list shrank) | Last page, never an empty screen | FE PAGING5 |
| PAGING-11 | ✗ | Saved page size not offered (7, 0, "big") | 50 a page | FE PAGING6, UI |
| PAGING-12 | ✗ | Nothing matches the filter | "No leads"; no page buttons; no error | FE PAGING7 |
| PAGING-13 | ✗ | Saved filters broken or tampered with | No filter applied; page still opens | FE PAGING12, UI |
| PAGING-14 | ✗ | A second person signs in on the same browser | Doesn't see the first person's filters or page | UI |

## 3. Regression (REG): must keep working

### 3.1 Sign-in, roles, settings (AUTH)

| ID | | Do | Expect | How |
|---|---|---|---|---|
| AUTH-01 | ✗ | Any API call without signing in | 401 | BE `test_requires_sign_in` |
| AUTH-02 | | Role comes from the server | Rep / Manager as set | BE `test_me_reports_role_from_server` |
| AUTH-03 | | Admin can do what a manager can | Yes | BE `test_admin_can_do_what_a_manager_does`, FE ROLE1 |
| AUTH-04 | ✗ | Non-admin opens Settings / role API | Refused | BE `test_only_admins_reach_settings` |
| AUTH-05 | | Admin gives a newcomer a role | Applies at once | BE `test_admin_gives_a_newcomer_a_role_and_it_applies_at_once` |
| AUTH-06 | | Signing in again keeps that role | Yes | BE `test_the_role_an_admin_gave_survives_signing_in_again` |
| AUTH-07 | ✗ | Admin changes own role | Refused | BE `test_admin_cannot_change_their_own_role` |
| AUTH-08 | ✗ | Change a role set by `ADMIN_EMAILS` | Refused, shown locked | BE `test_admin_emails_are_always_admin_and_locked` |
| AUTH-09 | ✗ | Unknown role or user | 422 / 404 | BE `test_unknown_role_or_user_is_refused` |
| AUTH-10 | ✗ | Start in production with unsafe settings | Refuses to start | BE `test_production_refuses_unsafe_config` |
| AUTH-11 | | Entra ID sign-in | Works with real tenant | **Not testable yet** (no credentials) |

### 3.2 Leads, import, editing (LEAD)

| ID | | Do | Expect | How |
|---|---|---|---|---|
| LEAD-01 | | Rep imports | Leads assigned to the rep; score computed by the server | BE `test_rep_import_assigns_to_the_rep_with_a_server_score` |
| LEAD-02 | | Manager imports | Unassigned | BE `test_manager_import_stays_unassigned` |
| LEAD-03 | | Preview (dry run) | Nothing saved | BE `test_dry_run_inserts_nothing` |
| LEAD-04 | ✗ | Duplicate email, even one a rep can't see | Skipped | BE `test_duplicates_are_caught_across_all_reps_not_just_your_own` |
| LEAD-05 | ✗ | Bad rows (missing fields, bad type, bad email) | Rejected with the reason | BE `test_validation_messages`, UI |
| LEAD-06 | ✗ | New lead without email or city | Refused | BE `test_new_lead_form_requires_email_and_city`, UI |
| LEAD-07 | | Account name typed in other capitals | Joins the existing account | BE `test_import_matches_accounts_whatever_the_capitals` |
| LEAD-08 | ✗ | Rep reads another rep's lead | 404 | BE `test_reps_only_see_their_own_leads` |
| LEAD-09 | ✗ | Rep edits a locked field (phone, owner…) | Refused, needs a manager | BE `test_rep_can_move_stage_but_not_edit_locked_fields` |
| LEAD-10 | ✗ | Rep reassigns or forges a score | Refused / score recomputed | BE `test_rep_cannot_reassign_or_forge_a_score` |
| LEAD-11 | ✗ | Save an out-of-date copy | 409, newer version shown | BE `test_stale_version_is_rejected` |
| LEAD-12 | ✗ | Change an email to one already used | 409 | BE `test_database_enforces_unique_email_on_edit` |
| LEAD-13 | ✗ | Rep deletes a lead | Refused | BE `test_only_managers_delete_leads` |
| LEAD-14 | | `<` `>` in text | Allowed by default; refused when the option is on | BE `test_angle_brackets_*` |

### 3.3 Saving many changes at once (SYNC)

| ID | | Do | Expect | How |
|---|---|---|---|---|
| SYNC-01 | ✗ | One item in a save is refused | Nothing in that save is applied | BE `test_a_failed_save_changes_nothing` |
| SYNC-02 | ✗ | Rename onto another account's name | Refused | BE `test_renaming_onto_another_accounts_name_is_refused` |
| SYNC-03 | | Rename a whole account in one save | Allowed | BE `test_renaming_a_whole_account_at_once_is_fine` |
| SYNC-04 | ✗ | Rep uses the save call to skip approval | Refused | BE `test_rep_cannot_use_sync_to_skip_approval` |
| SYNC-05 | ✗ | Rep touches someone else's lead through it | Refused | BE `test_rep_cannot_touch_someone_elses_lead_through_sync` |
| SYNC-06 | | Approval and the edit save together | Both or neither | BE `test_approval_lands_together_with_the_edit` |
| SYNC-07 | ✗ | Save call without the CSRF header | 403 | BE `test_sync_needs_the_csrf_header` |

### 3.4 Requests, leave, holidays, targets (REC)

| ID | | Do | Expect | How |
|---|---|---|---|---|
| REC-01 | | Rep files an edit request; manager approves | Approved; server stamps who decided | BE `test_change_request_flow_and_who_may_decide`, UI |
| REC-02 | ✗ | Rep approves own request / files for someone else | Refused | BE same |
| REC-03 | ✗ | Rep edits holidays, targets, leave days | Refused | BE `test_only_managers_manage_holidays_targets_and_leave_days` |
| REC-04 | ✗ | Rep reads another rep's leave request | Not visible | BE `test_leave_request_is_private_to_the_rep_and_manager` |

### 3.5 Lead Desk push (INGEST)

| ID | | Do | Expect | How |
|---|---|---|---|---|
| ING-01 | ✗ | Endpoint with no key configured | 503 | BE `test_disabled_without_a_key` |
| ING-02 | ✗ | Missing or wrong key | 401 | BE `test_rejects_missing_or_wrong_key` |
| ING-03 | | Push, then push again | Unassigned leads; second push adds nothing | BE `test_push_creates_unassigned_leads_and_is_safe_to_repeat` |
| ING-04 | | Dry run | Nothing saved | BE `test_dry_run_changes_nothing` |
| ING-05 | ✗ | Sign in as the import account | Impossible | BE `test_the_service_account_cannot_sign_in` |

### 3.6 Database (DB)

| ID | | Do | Expect | How |
|---|---|---|---|---|
| DB-01 | | Migrations build the schema the app expects | Match | BE `test_migrations_build_exactly_the_schema_the_app_expects` |
| DB-02 | | Upgrade twice | Harmless | BE `test_upgrading_twice_is_harmless` |
| DB-03 | | Database from before migrations | Upgraded in place | BE `test_a_database_from_before_migrations_is_upgraded_in_place` |
| DB-04 | ✗ | Store an unknown stage or role directly | Database refuses | BE `test_the_database_refuses_an_unknown_stage_or_role` |

### 3.7 Business logic in the screens (FE)

Automated, run with `npm test`. Sections A–R are described case by case in
[`tests/TEST_CASES.md`](../tests/TEST_CASES.md): dates in IST, scoring, working
days, billing, aging, account roll-up, filters, import parsing, assignment,
visibility, adding leads, stage changes, approvals, follow-ups, leave and
holidays, reports, demo data. Also S (saving to the server), T (loading from
the server) and ROLE (roles). Each section includes negative cases (bad import
rows, leap years, weekend picks, open date ranges, refused edits).

### 3.8 Screens (UI)

| ID | | Do | Expect | How |
|---|---|---|---|---|
| UI-01 | | Pipeline: move a card to Contacted | Saved, survives reload | UI |
| UI-02 | | Leads: rep edits a phone | Sent for approval; manager sees it in Follow-ups | UI |
| UI-03 | ✗ | Rep opens Reports or Revenue (tab or typed address) | Tabs hidden; typed address sends them back to Pipeline; the server refuses the data | UI, API |
| UI-04 | | New lead form | Lead created | UI |
| UI-05 | ✗ | New lead with fields missing | Error shown, nothing created | UI |
| UI-06 | ✗ | Import a sheet with bad rows | Preview lists the problems; only good rows imported | UI |
| UI-07 | | Calendar: rep applies for leave, manager approves | Approved | UI |
| UI-08 | | Settings (admin): give New Hire a role | They get in | UI |
| UI-09 | ✗ | Non-admin opens Settings (tab or typed address) | Tab hidden; address sends them back to Pipeline; `/api/admin/users` is 403 | UI, API |
