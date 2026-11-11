# ModenX CRM

Sales CRM for ModenX: pipeline board, leads, accounts, follow-ups, reports,
revenue and a working calendar, with managers and reps.

- **Front end:** Next.js 16 + React 19 + Zustand + Tailwind, in `app/`, `components/`, `lib/`. Tests in `tests/` (116, Vitest).
- **Back end:** Python (FastAPI) + PostgreSQL in `backend/`. Azure Entra ID sign-in, REST API, server-enforced permissions. Tests in `backend/tests/` (29, pytest).
- **Deploy scaffolding:** `deploy/` (Dockerfiles, nginx sample, compose) and `.github/workflows/ci.yml`.

> Status: the back end is built and tested; the front end is not connected to it
> yet and still runs on in-memory sample data. See [docs/PLAN.md](docs/PLAN.md).
> Infrastructure needs are in [docs/DEVOPS.md](docs/DEVOPS.md).

## Develop

```bash
npm ci
npm run dev          # http://localhost:3000
npm test             # 116 tests
npm run lint && npx tsc --noEmit && npm run build
```

Back end: see the "Run it locally" section of [docs/DEVOPS.md](docs/DEVOPS.md).

## Layout

```
app/ components/ lib/ tests/     Next.js front end and its business logic
backend/app                      FastAPI service (api.py, auth.py, models.py, scoring.py)
backend/scripts/push_leads.py    load a Lead Desk export through the API
deploy/                          Dockerfiles, nginx.conf, docker-compose.yml
docs/                            PLAN.md (roadmap, decisions), DEVOPS.md (handoff)
```
