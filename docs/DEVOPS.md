# DevOps handoff (for Sateesh and Prashanth)

What you need to provide or decide so ModenX CRM can run for a real pilot.
Everything the application itself needs is built or planned on our side (see
[PLAN.md](PLAN.md)); this file is the list of things only infrastructure can do.

## What is being deployed

```
 browser ──HTTPS──► reverse proxy (one public hostname)
                       ├─ /api  /auth  /ingest  /healthz ─► Python API (FastAPI) ─► PostgreSQL
                       └─ everything else ───────────────► Next.js front end
                                      Python API ──► login.microsoftonline.com (Entra ID)
```

- **One hostname, one origin.** The sign-in uses a cookie, so the front end and
  the API must be reachable under the same address (the proxy does that).
- **The API is stateless.** Sessions are signed cookies, so you can run more than
  one copy. State is only in PostgreSQL.
- `deploy/` has a Dockerfile for each service, an nginx sample and a
  docker-compose that wires them together. They are a starting point, not a
  production definition, and have **not been built or run yet** (no Docker on
  the machine they were written on). Please treat them as untested.

## What we need from you

| # | Item | Details | Status |
|---|---|---|---|
| 1 | **Entra ID app registration** | Single tenant. Web redirect URI `https://<host>/auth/callback`. Client secret (note its expiry). Optionally add the `groups` claim to the ID token. Give us tenant id, client id, and the secret through your secrets store. | open |
| 2 | **Who is a manager** | Either a list of emails (`MANAGER_EMAILS`) or an Entra group object id (`MANAGER_GROUP_ID`). Everyone else who signs in is a Rep. | open |
| 3 | **PostgreSQL** | 14+ (tested on 16). One empty database, one role that owns it. TLS on. Backups with a restore you have actually tested. The tables are created by migration scripts (see *Database* below); you don't create any by hand. | open |
| 4 | **Where it runs** | Containers on what? (D1) Needs: 1+ replica of the API, 1 of the front end, outbound HTTPS to `login.microsoftonline.com`. | open |
| 5 | **Hostname, TLS, proxy** | One public name, a certificate, the proxy rules in `deploy/nginx.conf` (or your equivalent). Set `COOKIE_SECURE=true` once on HTTPS. | open |
| 6 | **Secrets** | `SESSION_SECRET`, DB password, Azure client secret, `INGEST_API_KEY`. None of these may live in git. Say how rotation works. | open |
| 7 | **CI/CD** | `.github/workflows/ci.yml` runs lint, typecheck, tests, build and a production-dependency audit. You add: a container registry, the deploy step, branch protection on `main` with these checks required. | open |
| 8 | **Logging and monitoring** | The API logs to stdout. Health check is `GET /healthz`. Alerting and log retention are yours. | open |
| 9 | **Security controls in front** | Rate limiting on `/auth` and `/ingest`, HSTS, a Content-Security-Policy for the Next.js app (the API sends none, it only serves JSON), WAF if you use one, image and dependency scanning. | open |
| 10 | **Data handling** | The database holds business contacts' names, emails and phone numbers. Retention, who may read the database directly, and any privacy review your company needs. | open |

## Environment variables (API)

| Variable | Needed | Notes |
|---|---|---|
| `ENV` | yes | `production` turns on safety checks. In production the API **refuses to start** if `DEV_LOGIN` is on, `SESSION_SECRET` is weak, `COOKIE_SECURE` is off, or Azure is not configured. |
| `DATABASE_URL` | yes | `postgresql+psycopg://user:pass@host:5432/db` |
| `SESSION_SECRET` | yes | 32+ random characters. Changing it signs everyone out. |
| `BASE_URL` | yes | Public URL users type, e.g. `https://crm.company.internal`. |
| `COOKIE_SECURE` | yes | `true` on HTTPS. |
| `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` | yes | From item 1. |
| `MANAGER_EMAILS` / `MANAGER_GROUP_ID` | one of | From item 2. |
| `APP_TIMEZONE` | no | Default `Asia/Kolkata`; stamps "today" on new leads and is the time zone of every database connection. |
| `AUTO_MIGRATE` | no | Default `true`: the API brings the database schema up to date when it starts. Set `false` if you run `python -m app.migrate` as a separate deploy step. |
| `INGEST_API_KEY` | no | Enables the Lead Desk push endpoint. Empty = disabled. |
| `DEV_LOGIN` | never in production | Local pick-list sign-in for development. |

## Database

The schema is managed with migration scripts (Alembic) in
`backend/app/migrations/versions/`, numbered `0001`, `0002`, ... Point the API at
an **empty** database and it creates everything on first start; on later
deploys it applies only the new scripts. Several API copies starting at once
are safe (they take a database lock and one does the work). To run it as its
own step instead, set `AUTO_MIGRATE=false` and run, with the same environment
as the API:

```bash
python -m app.migrate            # create / upgrade the tables
python -m app.migrate current    # show which version the database is on
```

What it creates:

| Object | Holds | Rules enforced by the database |
|---|---|---|
| `users` | Everyone who has signed in, with role and colour | Email unique; Entra id unique; role must be `Rep` or `Manager` |
| `leads` | One row per contact: the full lead as JSON plus copies of account, email, owner, stage | One lead per email (case-insensitive); stage must be one of the 7 pipeline stages; owner must be a real user |
| `lead_id_seq` | The counter behind lead numbers L001, L002, ... | Never hands out the same number twice |
| `records` | Change requests, leave requests, approved leave days, company holidays, payment reminders, call targets | Kind must be one of those six |
| `alembic_version` | Which migration the database is on | (managed by the tool) |

Indexes cover what the app looks up: account (also lower-cased), owner, stage,
record owner. Every connection runs in the `APP_TIMEZONE` time zone; business
dates (follow-ups, billing, leave) are stored as plain `YYYY-MM-DD` values, so
they never shift by a day. There is nothing to seed: users appear when they
first sign in, and managers add holidays and targets in the app.

## Run it locally

```bash
# API (needs a Postgres you can reach)
cd backend && python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env        # edit DATABASE_URL etc., set DEV_LOGIN=true
uvicorn app.main:app --port 8000
pytest -q                   # needs a database named in TEST_DATABASE_URL

# front end
npm ci && npm test && npm run build
```

Or the whole stack: `docker compose -f deploy/docker-compose.yml --env-file deploy/.env up --build`.

## Things to know before you design anything

- **Sign-in is not tested against Azure yet.** The code path is
  `backend/app/auth.py`; the role logic is unit-tested, the token exchange needs
  real credentials. We will test it with you once item 1 exists.
- **Users appear at first sign-in.** A manager can only assign accounts to reps
  who have signed in at least once.
- **Schema changes ship as migration scripts** (see *Database*). Take a backup before each deploy that includes a new one.
- **Security fixes already done:** Next.js upgraded from 16.3.5 to 16.3.8
  (patches the critical advisories). A dev-only `braces` advisory remains
  because no fixed release exists; it is the linter, it never ships.
- **Machine import:** `POST /ingest/leads` with `Authorization: Bearer <key>`,
  used by `backend/scripts/push_leads.py` to load Lead Desk exports.

## Questions for you (decisions we need)

See D1 to D5 in [PLAN.md](PLAN.md#decisions-we-need). Most urgent: **D1 where it
runs** and **item 1 the Entra app registration**, because everything else waits on
a place to run and a way to sign in.
