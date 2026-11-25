"""The admin's "assign uploads to the person uploading them" switch.

On (the default): contacts a rep or a manager imports or adds go to them.
Off: they arrive unassigned for a manager to hand out. Either way a city that
already has an owner at that account keeps its owner, an admin (who can't own
leads) never gets them, and the Lead Desk feed always arrives unassigned."""

from fastapi.testclient import TestClient

from app.main import app
from conftest import HEADERS, ROW, import_rows, set_auto_assign, signed_in

OTHER_CITY = dict(ROW, name="Meena Pillai", email="meena@studioweft.com", city="Mumbai")


def _uid(client):
    return client.get("/api/me").json()["id"]


def _assignees(res):
    return [x["lead"]["assignee"] for x in res.json()["created"]]


def test_AA1_on_by_default_and_everyone_can_read_it(priya):
    assert priya.get("/api/settings").json() == {"autoAssignUploads": True}
    assert priya.get("/api/bootstrap").json()["settings"] == {"autoAssignUploads": True}


def test_AA2_on_a_managers_import_goes_to_the_manager(meera):
    assert _assignees(import_rows(meera, [ROW])) == [_uid(meera)]


def test_AA3_on_a_reps_import_and_new_lead_go_to_the_rep(priya):
    assert _assignees(import_rows(priya, [ROW])) == [_uid(priya)]
    r = priya.post("/api/leads", json=OTHER_CITY)
    assert r.status_code == 201 and r.json()["lead"]["assignee"] == _uid(priya)


def test_AA4_on_a_managers_new_lead_goes_to_the_manager(meera):
    r = meera.post("/api/leads", json=ROW)
    assert r.json()["lead"]["assignee"] == _uid(meera)


def test_AA5_off_imports_and_new_leads_arrive_unassigned(meera, priya):
    set_auto_assign(False)
    assert _assignees(import_rows(meera, [ROW])) == [None]
    r = priya.post("/api/leads", json=OTHER_CITY)
    assert r.status_code == 201 and r.json()["lead"]["assignee"] is None
    # a rep's upload that isn't theirs isn't handed back to them
    rep = import_rows(priya, [dict(ROW, name="X", email="x@studioweft.com", city="Delhi")]).json()
    assert rep["createdCount"] == 1 and rep["created"] == []


def test_AA6_a_city_with_an_owner_keeps_its_owner_either_way(meera, priya, arjun):
    import_rows(priya, [ROW])                       # priya owns Studio Weft · Bengaluru
    twin = dict(ROW, name="Rohan Rao", email="rohan@studioweft.com")
    r = import_rows(meera, [twin]).json()
    assert r["created"][0]["lead"]["assignee"] == _uid(priya)
    set_auto_assign(False)
    third = dict(ROW, name="Third", email="third@studioweft.com")
    r = import_rows(arjun, [third]).json()
    assert r["createdCount"] == 1                   # went to priya, not arjun and not unassigned
    assert len(priya.get("/api/leads").json()) == 3


def test_AA7_an_admins_upload_stays_unassigned(asha):
    assert _assignees(import_rows(asha, [ROW])) == [None]


def test_AA8_only_an_admin_can_change_it(priya, meera, asha):
    for c in (priya, meera):
        assert c.put("/api/admin/settings", json={"autoAssignUploads": False}).status_code == 403
    r = asha.put("/api/admin/settings", json={"autoAssignUploads": False})
    assert r.status_code == 200 and r.json() == {"autoAssignUploads": False}
    assert priya.get("/api/settings").json() == {"autoAssignUploads": False}
    assert asha.put("/api/admin/settings", json={"autoAssignUploads": True}).json() == {"autoAssignUploads": True}


def test_AA9_bad_settings_are_refused(asha):
    assert asha.put("/api/admin/settings", json={"somethingElse": True}).status_code == 422
    assert asha.put("/api/admin/settings", json={"autoAssignUploads": "yes"}).status_code == 422
    assert asha.put("/api/admin/settings", json={"autoAssignUploads": 1}).status_code == 422
    assert TestClient(app, headers=HEADERS).put("/api/admin/settings", json={"autoAssignUploads": False}).status_code == 401


def test_AA10_lead_desk_feed_always_arrives_unassigned(monkeypatch):
    from app import api
    monkeypatch.setattr(api.settings, "ingest_api_key", "k")
    c = TestClient(app)
    r = c.post("/ingest/leads", json={"rows": [ROW]}, headers={"Authorization": "Bearer k"})
    assert r.status_code == 200 and r.json()["created"] == 1
    meera_view = signed_in("meera@dev.local").get("/api/leads").json()
    assert [x["lead"]["assignee"] for x in meera_view] == [None]
