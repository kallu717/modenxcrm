@AGENTS.md

# Project context (read first)

ModenX CRM: a Next.js front end (root) plus a Python/FastAPI/PostgreSQL back end
(`backend/`). Read `docs/PLAN.md` for status and decisions and `docs/DEVOPS.md`
for what infrastructure must provide.

## Decisions already made (by the product owner, do not reopen)

- **No Supabase.** Self-hosted on the company's own servers. Back end is Python + Postgres.
- **Azure Entra ID** for sign-in; credentials are supplied by devops later.
- The front end talks to the back end over a **REST API** (cookie session, same origin behind a reverse proxy).
- **Hosting is undecided** and is devops' call (Sateesh, Prashanth). Keep images plain and hosting-neutral.

## Where things stand

- Phase 1 done on branch `phase-1/foundation`: Next.js 16.3.5 -> 16.3.8 (critical CVEs), back end added, CI, Docker/nginx/compose, docs.
- **Next job: Phase 2 in `docs/PLAN.md`**: wire the front end to the API (remove fake login and seed data from the production path, add `lib/api.ts` and a sync layer, keep the 116 tests green).
- The back end's `Lead` JSON has the same shape as `lib/types.ts` `Lead`. Score and priority are computed server-side (`backend/app/scoring.py` mirrors `lib/scoring.ts`).

## Commands

```bash
npm ci && npm test && npm run lint && npx tsc --noEmit && npm run build    # front end gate
npm audit --omit=dev --audit-level=high                                    # what ships
cd backend && pip install -r requirements-dev.txt && pytest -q             # needs Postgres (TEST_DATABASE_URL)
```

## Rules for working here

- Server enforces permissions; front-end guards are only cosmetic. Never trust the browser for role or ownership.
- Security-sensitive or hard-to-reverse actions (pushing to `main`, changing auth, touching secrets) need the owner's say-so. Work on branches and open PRs; do not push to `main`.
- Never commit secrets or `.env` files (only `*.example`).
- Windows note: a very long checkout path breaks the psycopg DLL; keep the Python venv at a short path such as `C:\mxp\venv`.
- Not yet verified: Entra sign-in against real Azure, the Docker images and compose file, the GitHub Actions workflow. Say so rather than claiming they work.
