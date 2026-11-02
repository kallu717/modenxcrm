from conftest import ROW, import_rows

ROHAN = dict(ROW, name="Rohan Rao", email="rohan@studioweft.com")
LUMA = dict(ROW, name="Kabir Bose", account="Luma Home", email="kabir@luma.in")


def _all(client):
    return {x["lead"]["email"]: x for x in client.get("/api/leads").json()}


def _uid(client):
    return client.get("/api/me").json()["id"]


def _put(x, **changes):
    return {"version": x["version"], "lead": dict(x["lead"], **changes)}


def test_assigning_an_account_moves_every_contact_in_one_save(meera, priya):
    import_rows(meera, [ROW, ROHAN])
    pid = _uid(priya)
    rows = _all(meera)
    r = meera.post("/api/sync", json={"leads": [_put(x, assignee=pid) for x in rows.values()]})
    assert r.status_code == 200
    assert {x["lead"]["assignee"] for x in r.json()["leads"]} == {pid}
    assert len(priya.get("/api/leads").json()) == 2


def test_an_account_never_has_two_reps(meera, priya, arjun):
    import_rows(meera, [ROW, ROHAN])
    rows = list(_all(meera).values())
    # only half the account handed over: the second contact would stay with no one, which is allowed
    assert meera.post("/api/sync", json={"leads": [_put(rows[0], assignee=_uid(priya))]}).status_code == 200
    # but giving the other contact to a different rep splits the account
    r = meera.post("/api/sync", json={"leads": [_put(rows[1], assignee=_uid(arjun))]})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "account_has_two_owners"


def test_a_failed_save_changes_nothing(meera, priya, arjun):
    import_rows(meera, [ROW, ROHAN])
    rows = list(_all(meera).values())
    r = meera.post("/api/sync", json={"leads": [
        _put(rows[0], assignee=_uid(priya), stage="contacted"),
        _put(rows[1], assignee=_uid(arjun)),
    ]})
    assert r.status_code == 409
    assert {x["lead"]["stage"] for x in _all(meera).values()} == {"new"}
    assert {x["lead"]["assignee"] for x in _all(meera).values()} == {None}


def test_renaming_onto_another_accounts_name_is_refused(meera):
    import_rows(meera, [ROW, ROHAN, LUMA])
    luma = _all(meera)[LUMA["email"]]
    r = meera.post("/api/sync", json={"leads": [_put(luma, account="studio weft")]})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "account_name_taken"


def test_renaming_a_whole_account_at_once_is_fine(meera):
    import_rows(meera, [ROW, ROHAN])
    rows = _all(meera).values()
    r = meera.post("/api/sync", json={"leads": [_put(x, account="Studio Weft India") for x in rows]})
    assert r.status_code == 200
    assert {x["lead"]["account"] for x in _all(meera).values()} == {"Studio Weft India"}


def test_import_matches_accounts_whatever_the_capitals(priya):
    import_rows(priya, [ROW])
    res = import_rows(priya, [dict(ROHAN, account="STUDIO WEFT ", type="Mall")]).json()
    assert res["newAccounts"] == 0
    lead = res["created"][0]["lead"]
    assert lead["account"] == "Studio Weft" and lead["type"] == "Brand"


def test_rep_cannot_use_sync_to_skip_approval(priya, meera):
    import_rows(priya, [ROW])
    mine = _all(priya)[ROW["email"]]
    r = priya.post("/api/sync", json={"leads": [_put(mine, phone="+91 90000 00000")]})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "needs_manager"
    assert priya.post("/api/sync", json={"deleteLeads": [mine["lead"]["id"]]}).status_code == 403


def test_rep_cannot_touch_someone_elses_lead_through_sync(priya, arjun):
    import_rows(priya, [ROW])
    mine = _all(priya)[ROW["email"]]
    r = arjun.post("/api/sync", json={"leads": [_put(mine, stage="lost")]})
    assert r.status_code == 404


def test_approval_lands_together_with_the_edit(priya, meera):
    import_rows(priya, [ROW])
    pid = _uid(priya)
    lead = _all(priya)[ROW["email"]]
    cr = {"scope": "lead", "leadId": lead["lead"]["id"], "requestedBy": pid, "requestedAt": "2026-10-22",
          "changes": {"phone": {"from": ROW["phone"], "to": "+91 90000 00000"}}, "status": "pending"}
    assert priya.post("/api/sync", json={"records": [{"kind": "change_request", "id": "CR-a1", "data": cr}]}).status_code == 200
    current = _all(meera)[ROW["email"]]
    r = meera.post("/api/sync", json={
        "leads": [_put(current, phone="+91 90000 00000")],
        "records": [{"kind": "change_request", "id": "CR-a1", "data": dict(cr, status="approved")}],
    })
    assert r.status_code == 200
    assert r.json()["records"][0]["data"]["decidedBy"] == _uid(meera)
    assert _all(priya)[ROW["email"]]["lead"]["phone"] == "+91 90000 00000"


def test_sync_needs_the_csrf_header(priya):
    assert priya.post("/api/sync", json={}, headers={"X-Requested-With": ""}).status_code == 403
