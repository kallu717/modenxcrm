# Plan: from front-end prototype to a pilot two people can use

Baseline reviewed by Sateesh (DevOps): clean code, strong business logic in
`lib/`, but four blockers. Status of each:

| Blocker | What was wrong | Status |
|---|---|---|
| 3. Next.js CVEs | `next@16.3.5` inside the vulnerable range (RCE in `next/og`, SSRF in image optimization, SSG/ISR cache poisoning) | **Fixed on this branch.** Now 16.3.8. `npm audit --omit=dev`: 0 vulnerabilities. 116 tests, lint, typecheck, build all pass. |
| 1. No authentication | `login()` sets a sessionStorage flag; "Switch user" lets anyone become a manager; guards are client-side redirects | **Server side built, front end not wired.** `backend/app/auth.py` does Entra ID sign-in; the API enforces who sees and changes what. Front end still has the fake login. See Phase 2. |
| 2. No shared data | State is in-memory Zustand; each browser makes its own 118 fake leads | **Server side built, front end not wired.** Postgres + REST API exist and are tested (29 backend tests). Front end store still generates fake data. See Phase 2. |
| 4. Demo data, no scaffolding | Reps hard-coded, `lib/seed.ts` on the prod path, no CI/Docker/`.env.example`, boilerplate README | **Scaffolding added, seed removal in Phase 2.** CI workflow, Dockerfiles, nginx sample, compose, env templates, README, DEVOPS.md are in. Not yet run (see DEVOPS.md). |

## Phases

**Phase 1: foundation (done on branch `phase-1/foundation`)**
Security bump; Python/FastAPI/Postgres backend with Entra sign-in and the
permission rules; CI; deploy scaffolding; docs. Backend has 29 tests, run
against a real Postgres. Previously also checked end to end in a browser with
a dev login, against an earlier single-page front end.

**Phase 2: connect the real front end to the API (our work, no devops needed)**
1. `lib/api.ts`: fetch wrapper (cookie, `X-Requested-With: pipeline`, 401 sends the browser to `/auth/login`).
2. Boot: load `/api/bootstrap` into the store (`me`, `users`, `leads`, `records`). Reps come from the users table, not `lib/constants.ts`.
3. Remove `login()`, `hydrateAuth` sessionStorage, "Switch user", and the `/login` button. `AuthGate` asks the server who you are.
4. Saving: keep the store's business rules (the 116 tests stay valid) and add a sync layer that sends what changed: `PUT /api/leads/{id}` with `{version, lead}`; `/api/records/{kind}/{id}` for change requests, leave, holidays, reminders, targets. Import and "New lead" call `/api/leads/import` and `/api/leads` (the server assigns ids and checks duplicates across all leads). A refused or stale save reverts the screen.
5. Seed only in tests and an explicit dev flag; never on the production path.
6. Align server rules with the store's where the store is stricter: match account names case-insensitively on import, refuse renaming onto an existing account, re-check email and account-name collisions at approval.
7. Tests: keep the 116; add API-contract tests; one browser end-to-end script (two users, assignment, approval).

**Phase 3: pilot hardening (needs devops items)**
Test Entra sign-in with real credentials; run the containers; migrations (Alembic); logging; rate limiting; CSP at the proxy; backup restore test; a short security review.

**Phase 4: Lead Desk to Pipeline**
Already available: Lead Desk "Export for Pipeline" file, loaded by Import or by
`backend/scripts/push_leads.py` through `POST /ingest/leads` (key protected).
Later: scheduled push, or move Lead Desk's data into this database.

## Decisions we need

| # | Decision | Options and our lean | Who |
|---|---|---|---|
| D1 | Where does it run? | VM with Docker, Kubernetes, or a platform you already operate. We are neutral; the images are plain. | DevOps |
| D2 | Front end as a Node server or static files? | Every page is client-rendered, so a static export (`output: "export"`) served by the proxy is possible. That removes the Node runtime and the whole class of Next-server vulnerabilities. Lean: static export, if nothing needs a Next server. We confirm it builds in Phase 2. | Both |
| D3 | Schema migrations | Add Alembic before the first schema change. Lean: yes, in Phase 3. | Dev |
| D4 | Rep onboarding | Users are created at first sign-in. Alternative: devops or a manager pre-loads reps from the Entra group. Lean: keep first sign-in for the pilot. | Both |
| D5 | Live updates | The page saves within about 2 seconds and re-reads every 30 seconds when idle. Real-time push is more work. Lean: not needed for the pilot. | Product |

## Known gaps (not blockers for the plan, but real)

- Entra sign-in itself is untested until credentials exist.
- `braces` (dev-only, via the linter) has a high advisory with no fixed release. CI audits production dependencies only; revisit when a fix ships.
- One shared ingest key, no per-caller identity.
- The front-end store's rules and the server's rules overlap; Phase 2 step 6 makes the server the authority and the store a fast preview.

## Definition of done for the pilot

Two real people sign in with company accounts, one as a rep and one as a manager,
and: the manager imports and assigns an account; the rep sees only theirs and
works it; the rep files an edit and the manager approves it; both survive a
refresh and a restart; a rep cannot reach anything a manager-only screen shows,
even by calling the API directly.
