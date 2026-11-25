import pytest
from fastapi.testclient import TestClient

from app.api import settings as api_settings
from app.main import app

from conftest import ROW

KEY = "k" * 40


@pytest.fixture
def machine(monkeypatch):
    """A client with NO cookies and NO csrf header — like a script."""
    monkeypatch.setattr(api_settings, "ingest_api_key", KEY)
    return TestClient(app)


def push(c, rows, key=KEY, **params):
    headers = {"Authorization": f"Bearer {key}"} if key is not None else {}
    return c.post("/ingest/leads", params=params, headers=headers, json={"filename": "x.xlsx", "rows": rows})


def test_disabled_without_a_key(monkeypatch):
    monkeypatch.setattr(api_settings, "ingest_api_key", "")
    assert push(TestClient(app), [ROW]).status_code == 503


def test_rejects_missing_or_wrong_key(machine):
    assert push(machine, [ROW], key=None).status_code == 401
    assert push(machine, [ROW], key="wrong").status_code == 401


def test_push_creates_unassigned_leads_and_is_safe_to_repeat(machine, meera, priya):
    rows = [ROW, dict(ROW, name="Rohan Rao", email="rohan@studioweft.com"), dict(ROW, email="bad", name="Z")]
    first = push(machine, rows).json()
    assert first["created"] == 2 and first["newAccounts"] == 1 and first["rejected"] == 1
    again = push(machine, rows).json()
    assert again["created"] == 0 and again["duplicates"] == 2

    leads = [x["lead"] for x in meera.get("/api/leads").json()]
    assert len(leads) == 2 and all(l["assignee"] is None for l in leads)
    assert "Pushed from Lead Desk (x.xlsx)" in leads[0]["activity"][0]["txt"]
    assert priya.get("/api/leads").json() == []      # nothing lands on a rep by itself


def test_dry_run_changes_nothing(machine, meera):
    res = push(machine, [ROW], dry_run="true").json()
    assert res["dryRun"] and res["ready"] == 1 and res["created"] == 0
    assert meera.get("/api/leads").json() == []


def test_the_service_account_cannot_sign_in(machine):
    push(machine, [ROW])
    c = TestClient(app)
    r = c.post("/auth/dev-login", data={"email": "lead-desk-import@service.local"}, follow_redirects=False)
    assert r.status_code == 400   # not one of the dev users; with Entra it has no identity to sign in with
