import pytest
from fastapi.testclient import TestClient

from app.auth import role_for
from app.config import Settings
from app.main import app

from conftest import HEADERS, ROW, import_rows


# ---------------------------------------------------------------- access

def test_requires_sign_in():
    c = TestClient(app, headers=HEADERS)
    assert c.get("/api/me").status_code == 401
    assert c.get("/api/bootstrap").status_code == 401


def test_state_changing_calls_need_the_csrf_header(priya):
    r = priya.post("/api/leads/import", json={"rows": [ROW]}, headers={"X-Requested-With": ""})
    assert r.status_code == 403


def test_me_reports_role_from_server(priya, meera):
    assert priya.get("/api/me").json()["role"] == "Rep"
    assert meera.get("/api/me").json()["role"] == "Manager"


# ---------------------------------------------------------------- import

def test_rep_import_assigns_to_the_rep_with_a_server_score(priya):
    r = import_rows(priya, [ROW])
    assert r.status_code == 200
    body = r.json()
    assert body["ready"] == 1 and body["newAccounts"] == 1
    lead = body["created"][0]["lead"]
    me = priya.get("/api/me").json()
    assert lead["assignee"] == me["id"]
    assert lead["id"].startswith("L")
    # Marketing Head 15 + verified 12 + Bengaluru 10 = 37 -> Hot
    assert lead["score"] == 37 and lead["priorityAuto"] == "Hot"


def test_manager_import_stays_unassigned(meera):
    lead = import_rows(meera, [ROW]).json()["created"][0]["lead"]
    assert lead["assignee"] is None and lead["ownerSince"] is None


def test_dry_run_inserts_nothing(priya):
    r = import_rows(priya, [ROW], dry_run="true")
    assert r.json()["ready"] == 1 and r.json()["created"] == []
    assert priya.get("/api/leads").json() == []


def test_duplicates_are_caught_across_all_reps_not_just_your_own(priya, arjun):
    import_rows(priya, [ROW])
    # arjun can't see priya's lead, but the email is still a duplicate
    r = import_rows(arjun, [ROW]).json()
    assert r["duplicates"] == 1 and r["ready"] == 0
    # case-insensitive, and duplicates inside one file are caught too
    twice = [dict(ROW, email="X@Y.com", name="A"), dict(ROW, email="x@y.com", name="B")]
    assert import_rows(arjun, twice).json()["duplicates"] == 1


def test_one_account_one_owner(priya, arjun):
    import_rows(priya, [ROW])
    other = dict(ROW, name="Rohan Rao", email="rohan@studioweft.com")
    res = import_rows(arjun, [other]).json()
    # the contact was added, joined priya's account, and arjun isn't handed a lead he can't see
    assert res["createdCount"] == 1 and res["created"] == []
    assert arjun.get("/api/leads").json() == []
    joined = next(x["lead"] for x in priya.get("/api/leads").json() if x["lead"]["email"] == other["email"])
    assert joined["assignee"] == priya.get("/api/me").json()["id"]
    assert "already owned by Priya Nair" in joined["activity"][0]["txt"]


def test_validation_messages(priya):
    rows = [dict(ROW, email="a@b.co", type="Shop"), dict(ROW, email="c@d.co", name=""), dict(ROW, email="not-an-email")]
    r = import_rows(priya, rows).json()
    assert r["ready"] == 0 and r["rejected"] == 3
    assert any("must be Brand, Mall or Store" in i for i in r["issues"])
    assert any("missing Contact name" in i for i in r["issues"])


def test_angle_brackets_pass_through_by_default(priya):
    r = import_rows(priya, [dict(ROW, notes="budget > 1Cr")]).json()
    assert r["ready"] == 1


def test_angle_brackets_are_refused_when_enabled(priya, meera, monkeypatch):
    from app.api import settings as api_settings
    monkeypatch.setattr(api_settings, "reject_markup", True)
    evil = dict(ROW, name="<img src=x onerror=alert(1)>")
    r = import_rows(priya, [evil]).json()
    assert r["ready"] == 0 and any("< or >" in i for i in r["issues"])
    import_rows(priya, [ROW])
    lead, v = _lead_and_version(priya)
    note = dict(lead, activity=[{"who": "x", "txt": "<a href=//evil>click</a>", "t": "now", "date": "2026-10-22", "method": None}])
    assert priya.put(f"/api/leads/{lead['id']}", json={"version": v, "lead": note}).status_code == 422
    assert meera.put("/api/records/holiday/2026-12-25", json={"data": {"date": "2026-12-25", "name": "<b>x</b>"}}).status_code == 422


def test_new_lead_form_requires_email_and_city(priya):
    r = priya.post("/api/leads", json=dict(ROW, email=""))
    assert r.status_code == 422
    assert priya.post("/api/leads", json=ROW).status_code == 201


# ------------------------------------------------------------ visibility

def test_reps_only_see_their_own_leads(priya, arjun, meera):
    mine = import_rows(priya, [ROW]).json()["created"][0]["lead"]
    assert len(priya.get("/api/leads").json()) == 1
    assert arjun.get("/api/leads").json() == []
    assert arjun.get(f"/api/leads/{mine['id']}").status_code == 404
    assert len(meera.get("/api/leads").json()) == 1
    assert len(arjun.get("/api/bootstrap").json()["leads"]) == 0


# --------------------------------------------------------------- updates

def _lead_and_version(client, email="ananya@studioweft.com"):
    return next((x["lead"], x["version"]) for x in client.get("/api/leads").json() if x["lead"]["email"] == email)


def test_rep_can_move_stage_but_not_edit_locked_fields(priya):
    import_rows(priya, [ROW])
    lead, v = _lead_and_version(priya)
    ok = dict(lead, stage="contacted", stageHistory=lead["stageHistory"] + [{"stage": "contacted", "date": "2026-10-22"}])
    r = priya.put(f"/api/leads/{lead['id']}", json={"version": v, "lead": ok})
    assert r.status_code == 200 and r.json()["version"] == v + 1

    bad = dict(r.json()["lead"], phone="+91 0000")
    r2 = priya.put(f"/api/leads/{lead['id']}", json={"version": v + 1, "lead": bad})
    assert r2.status_code == 403 and "phone" in r2.json()["detail"]["fields"]


def test_rep_cannot_reassign_or_forge_a_score(priya, arjun):
    import_rows(priya, [ROW])
    lead, v = _lead_and_version(priya)
    arjun_id = arjun.get("/api/me").json()["id"]
    r = priya.put(f"/api/leads/{lead['id']}", json={"version": v, "lead": dict(lead, assignee=arjun_id)})
    assert r.status_code == 403
    forged = dict(lead, score=999, priorityAuto="Hot", priorityOverride="Low")
    r = priya.put(f"/api/leads/{lead['id']}", json={"version": v, "lead": forged})
    assert r.status_code == 200
    assert r.json()["lead"]["score"] == 37          # recomputed, forged value ignored
    assert r.json()["lead"]["priorityOverride"] == "Low"  # a rep's own override is allowed


def test_stale_version_is_rejected(priya):
    import_rows(priya, [ROW])
    lead, v = _lead_and_version(priya)
    assert priya.put(f"/api/leads/{lead['id']}", json={"version": v, "lead": lead}).status_code == 200
    r = priya.put(f"/api/leads/{lead['id']}", json={"version": v, "lead": lead})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "version_conflict"


def test_manager_assigns_to_reps_only(meera, priya):
    import_rows(meera, [ROW])
    lead, v = _lead_and_version(meera)
    pid = priya.get("/api/me").json()["id"]
    mid = meera.get("/api/me").json()["id"]
    assert meera.put(f"/api/leads/{lead['id']}", json={"version": v, "lead": dict(lead, assignee=mid)}).status_code == 422
    r = meera.put(f"/api/leads/{lead['id']}", json={"version": v, "lead": dict(lead, assignee=pid)})
    assert r.status_code == 200
    assert len(priya.get("/api/leads").json()) == 1   # now visible to the rep


def test_database_enforces_unique_email_on_edit(meera):
    import_rows(meera, [ROW, dict(ROW, name="B", email="b@x.com")])
    a, va = _lead_and_version(meera, "ananya@studioweft.com")
    r = meera.put(f"/api/leads/{a['id']}", json={"version": va, "lead": dict(a, email="B@x.com")})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "duplicate_email"


def test_only_managers_delete_leads(priya, meera):
    import_rows(priya, [ROW])
    lead, _ = _lead_and_version(priya)
    assert priya.delete(f"/api/leads/{lead['id']}").status_code == 403
    assert meera.delete(f"/api/leads/{lead['id']}").status_code == 204
    assert meera.get("/api/leads").json() == []


# --------------------------------------------------------------- records

def _cr(rep_id, lead_id):
    return {"scope": "lead", "leadId": lead_id, "requestedBy": rep_id, "requestedAt": "2026-10-22",
            "changes": {"phone": {"from": "x", "to": "y"}}, "status": "pending"}


def test_change_request_flow_and_who_may_decide(priya, arjun, meera):
    import_rows(priya, [ROW])
    lead, _ = _lead_and_version(priya)
    pid = priya.get("/api/me").json()["id"]

    assert priya.put("/api/records/change_request/CR1", json={"data": _cr(pid, lead["id"])}).status_code == 200
    # arjun can't file a request for priya's lead, or in priya's name
    aid = arjun.get("/api/me").json()["id"]
    assert arjun.put("/api/records/change_request/CR2", json={"data": _cr(aid, lead["id"])}).status_code == 403
    assert arjun.put("/api/records/change_request/CR3", json={"data": _cr(pid, lead["id"])}).status_code == 403
    # a rep can't approve their own request
    approved = dict(_cr(pid, lead["id"]), status="approved")
    assert priya.put("/api/records/change_request/CR1", json={"data": approved}).status_code == 403
    # a manager can, and the server stamps who decided
    r = meera.put("/api/records/change_request/CR1", json={"data": approved})
    assert r.status_code == 200 and r.json()["data"]["decidedBy"] == meera.get("/api/me").json()["id"]
    # visibility: priya sees hers, arjun sees none, meera sees all
    assert len(priya.get("/api/bootstrap").json()["records"]["change_request"]) == 1
    assert arjun.get("/api/bootstrap").json()["records"]["change_request"] == []


def test_only_managers_manage_holidays_targets_and_leave_days(priya, meera):
    assert priya.put("/api/records/holiday/2026-12-25", json={"data": {"date": "2026-12-25", "name": "Christmas"}}).status_code == 403
    assert meera.put("/api/records/holiday/2026-12-25", json={"data": {"date": "2026-12-25", "name": "Christmas"}}).status_code == 200
    assert priya.get("/api/bootstrap").json()["records"]["holiday"][0]["id"] == "2026-12-25"
    pid = priya.get("/api/me").json()["id"]
    assert priya.put(f"/api/records/target/{pid}", json={"data": {"callsPerDay": 99}}).status_code == 403
    assert meera.put(f"/api/records/target/{pid}", json={"data": {"callsPerDay": 12}}).status_code == 200
    assert priya.put("/api/records/leave_day/LV1", json={"data": {"repId": pid, "date": "2026-11-01"}}).status_code == 403
    assert priya.delete("/api/records/holiday/2026-12-25").status_code == 403


def test_leave_request_is_private_to_the_rep_and_manager(priya, arjun, meera):
    pid = priya.get("/api/me").json()["id"]
    req = {"repId": pid, "date": "2026-11-03", "reason": "Family", "status": "pending", "requestedAt": "2026-10-22"}
    assert priya.put("/api/records/leave_request/LR1", json={"data": req}).status_code == 200
    assert arjun.get("/api/bootstrap").json()["records"]["leave_request"] == []
    assert len(meera.get("/api/bootstrap").json()["records"]["leave_request"]) == 1
    forged = dict(req, repId=arjun.get("/api/me").json()["id"])
    assert priya.put("/api/records/leave_request/LR2", json={"data": forged}).status_code == 403


# ---------------------------------------------------------------- config

def test_role_for_uses_config(monkeypatch):
    from app import auth
    monkeypatch.setattr(auth.settings, "manager_emails", "boss@co.com, Other@co.com")
    monkeypatch.setattr(auth.settings, "manager_group_id", "grp-1")
    assert role_for("Boss@co.com", None) == "Manager"
    assert role_for("rep@co.com", ["grp-1"]) == "Manager"
    assert role_for("rep@co.com", ["grp-2"]) == "Rep"


def test_production_refuses_unsafe_config():
    with pytest.raises(RuntimeError) as e:
        Settings(env="production", dev_login=True, session_secret="change-me").check_production_safety()
    msg = str(e.value)
    assert "DEV_LOGIN" in msg and "SESSION_SECRET" in msg and "AZURE" in msg
    Settings(env="production", dev_login=False, session_secret="x" * 40, cookie_secure=True, azure_tenant_id="t",
             azure_client_id="c", azure_client_secret="s").check_production_safety()
