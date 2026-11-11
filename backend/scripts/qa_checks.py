"""Checks against a RUNNING server: sanity, the new ownership rules, and their
negative cases, over real HTTP with real sign-in sessions.

    python scripts/qa_checks.py http://127.0.0.1:8000

Needs DEV_LOGIN=true on that server (a development or test server, never
production). Uses its own uniquely named test account, so it can run on a
database that already has data. Case IDs match docs/TEST_PLAN.md.
Exit code 0 when every check passes.
"""

import sys
import time

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
H = {"X-Requested-With": "pipeline"}
STAMP = str(int(time.time()))
ACCT = f"QA Retail {STAMP}"
results: list[tuple[str, str, bool, str]] = []


def check(case: str, what: str, ok: bool, detail: str = "") -> None:
    results.append((case, what, bool(ok), detail))
    print(f"{'PASS' if ok else 'FAIL'}  {case:8} {what}" + (f"  [{detail}]" if detail and not ok else ""))


def client() -> httpx.Client:
    return httpx.Client(base_url=BASE, timeout=60)


def signed_in(who: str) -> httpx.Client:
    c = client()
    r = c.post("/auth/dev-login", data={"email": f"{who}@dev.local"})
    if r.status_code not in (200, 303):
        sys.exit(f"Can't sign in as {who} ({r.status_code}). Is DEV_LOGIN on for {BASE}?")
    return c


def code(r: httpx.Response) -> str:
    try:
        d = r.json().get("detail")
        return d.get("code", "") if isinstance(d, dict) else str(d)
    except Exception:
        return ""


def get_lead(c, lead_id):
    return c.get(f"/api/leads/{lead_id}").json()


def put(c, lead_id, **changes) -> httpx.Response:
    cur = get_lead(c, lead_id)
    return c.put(f"/api/leads/{lead_id}", headers=H, json={"version": cur["version"], "lead": {**cur["lead"], **changes}})


def sync(c, changes: dict[str, dict]) -> httpx.Response:
    items = []
    for lead_id, ch in changes.items():
        cur = get_lead(c, lead_id)
        items.append({"version": cur["version"], "lead": {**cur["lead"], **ch}})
    return c.post("/api/sync", headers=H, json={"leads": items})


def row(name, city):
    return {"name": name, "title": "Founder", "account": ACCT, "type": "Brand",
            "email": f"{name.lower().replace(' ', '.')}.{STAMP}@qa.test", "verified": "Yes", "city": city}


def main() -> int:
    # ---------------------------------------------------------------- sanity
    r = client().get("/healthz")
    check("SAN-01", "health endpoint answers ok", r.status_code == 200 and r.json().get("ok") is True)
    check("SAN-02", "not signed in: /api/me is refused (401)", client().get("/api/me").status_code == 401)

    meera, priya, arjun, asha, newhire = (signed_in(w) for w in ("meera", "priya", "arjun", "asha", "newhire"))
    ids = {w: c.get("/api/me").json()["id"] for w, c in (("meera", meera), ("priya", priya), ("arjun", arjun), ("asha", asha))}
    b = meera.get("/api/bootstrap")
    check("SAN-04", "bootstrap has me, team, leads, records",
          b.status_code == 200 and {"me", "users", "leads", "records"} <= set(b.json()))
    r = meera.post("/api/leads/import", json={"filename": "x", "rows": []})
    check("SAN-08", "a save without the CSRF header is refused (403)", r.status_code == 403)
    check("SAN-09", "an unknown API address is 404", meera.get("/api/nope").status_code == 404)
    r = newhire.get("/api/bootstrap")
    check("SAN-10", "someone still Pending sees no data (403 pending)", r.status_code == 403 and code(r) == "pending")

    # ---------------------------------------------------------------- setup
    rows = [row("Bea One", "Bengaluru"), row("Bea Two", "Bengaluru"), row("Mo One", "Mumbai"),
            row("Gee Gurgaon", "Gurgaon"), row("Gee Gurugram", "Gurugram")]
    r = meera.post("/api/leads/import", headers=H, json={"filename": "qa.csv", "rows": rows})
    created = {x["lead"]["name"]: x["lead"]["id"] for x in r.json().get("created", [])}
    check("SETUP", f"manager imports 5 contacts of {ACCT}", r.status_code == 200 and len(created) == 5, r.text[:200])
    if len(created) != 5:
        return finish()

    # ------------------------------------------------- progression + negatives
    r = sync(meera, {created["Bea One"]: {"assignee": ids["priya"]}, created["Bea Two"]: {"assignee": ids["priya"]},
                     created["Mo One"]: {"assignee": ids["arjun"]}})
    check("LOC-01", "Bengaluru to Priya and Mumbai to Arjun in one account", r.status_code == 200, r.text[:200])

    mine = [x["lead"] for x in priya.get("/api/leads").json() if x["lead"]["account"] == ACCT]
    his = [x["lead"] for x in arjun.get("/api/leads").json() if x["lead"]["account"] == ACCT]
    check("LOC-14", "each rep sees only their own city of the shared account",
          {l["city"] for l in mine} == {"Bengaluru"} and {l["city"] for l in his} == {"Mumbai"},
          f"priya={[l['city'] for l in mine]} arjun={[l['city'] for l in his]}")

    r = put(meera, created["Bea Two"], assignee=ids["arjun"])
    check("LOC-02", "✗ a city can't have two owners (409 location_has_two_owners)",
          r.status_code == 409 and code(r) == "location_has_two_owners", f"{r.status_code} {code(r)}")

    r = sync(meera, {created["Gee Gurgaon"]: {"assignee": ids["priya"]}, created["Gee Gurugram"]: {"assignee": ids["arjun"]}})
    check("CITY-01", "✗ Gurgaon and Gurugram count as one city (409)",
          r.status_code == 409 and r.json()["detail"].get("city") == "gurugram", r.text[:200])

    r = meera.post("/api/leads/import", headers=H, json={"filename": "qa2.csv", "rows": [row("Pune Person", "Pune")]})
    pune = r.json()["created"][0]["lead"]
    check("LOC-06", "a new city under an assigned account starts unassigned", pune["assignee"] is None)

    r = arjun.post("/api/leads/import", headers=H, json={"filename": "qa3.csv", "rows": [row("Chen Find", "Chennai")]})
    ok = r.status_code == 200 and r.json()["created"] and r.json()["created"][0]["lead"]["assignee"] == ids["arjun"]
    check("LOC-07", "a rep's own find in a new city is theirs", ok, r.text[:200])

    r = arjun.post("/api/leads/import", headers=H, json={"filename": "qa4.csv", "rows": [row("Bea Three", "bengaluru")]})
    res = r.json()
    joined = next((x["lead"] for x in meera.get("/api/leads").json() if x["lead"]["name"] == "Bea Three" and x["lead"]["account"] == ACCT), None)
    check("LOC-08", "✗ a rep's contact in someone else's city stays with that owner",
          res.get("createdCount") == 1 and res.get("created") == [] and joined and joined["assignee"] == ids["priya"],
          f"{res.get('createdCount')} {joined and joined['assignee']}")

    r = put(priya, created["Bea One"], assignee=ids["arjun"])
    check("LOC-15", "✗ a rep can't assign a city (403 needs_manager)", r.status_code == 403 and code(r) == "needs_manager",
          f"{r.status_code} {code(r)}")
    r = put(meera, pune["id"], assignee="999999")
    check("LOC-16", "✗ assigning to a person who doesn't exist is refused (422)", r.status_code == 422, str(r.status_code))

    r = put(meera, pune["id"], assignee=ids["meera"])
    check("MGR-01", "a manager can own a city", r.status_code == 200 and r.json()["lead"]["assignee"] == ids["meera"], r.text[:200])
    r = put(meera, created["Gee Gurgaon"], assignee=ids["asha"])
    check("MGR-02", "✗ an Admin can't own a city (422)", r.status_code == 422, str(r.status_code))
    pending_id = None
    admin_list = asha.get("/api/admin/users")
    if admin_list.status_code == 200:
        pending_id = next((u["id"] for u in admin_list.json() if u["email"] == "newhire@dev.local"), None)
    r = put(meera, created["Gee Gurgaon"], assignee=str(pending_id))
    check("MGR-03", "✗ someone Pending can't own a city (422)", pending_id is not None and r.status_code == 422, str(r.status_code))
    team = [u["email"] for u in meera.get("/api/users").json()]
    check("MGR-08", "✗ the machine-import account is never on the team", not any("service.local" in e for e in team))

    r = put(priya, created["Bea One"], stage="contacted",
            stageHistory=get_lead(priya, created["Bea One"])["lead"]["stageHistory"] + [{"stage": "contacted", "date": "2026-11-10"}])
    again = get_lead(priya, created["Bea One"])["lead"]["stage"]
    check("SAN-06", "a stage change saves and is still there on reading back", r.status_code == 200 and again == "contacted")

    cur = get_lead(priya, created["Bea One"])
    r = priya.put(f"/api/leads/{created['Bea One']}", headers=H, json={"version": cur["version"] - 1, "lead": cur["lead"]})
    check("LEAD-11", "✗ saving an out-of-date copy is refused (409)", r.status_code == 409 and code(r) == "version_conflict")

    r = arjun.get(f"/api/leads/{created['Bea One']}")
    check("LEAD-08", "✗ a rep can't read another rep's lead (404)", r.status_code == 404)

    meera.get("/auth/logout")
    check("SAN-07", "after signing out, /api/me is refused", meera.get("/api/me").status_code == 401)
    return finish()


def finish() -> int:
    failed = [r for r in results if not r[2]]
    print(f"\n{len(results) - len(failed)} of {len(results)} checks passed against {BASE}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
