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


def test_one_location_never_has_two_owners(meera, priya, arjun):
    import_rows(meera, [ROW, ROHAN])          # both Studio Weft, both Bengaluru
    rows = list(_all(meera).values())
    # only half the location handed over: the second contact would stay with no one, which is allowed
    assert meera.post("/api/sync", json={"leads": [_put(rows[0], assignee=_uid(priya))]}).status_code == 200
    # but giving the other Bengaluru contact to a different person splits the location
    r = meera.post("/api/sync", json={"leads": [_put(rows[1], assignee=_uid(arjun))]})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "location_has_two_owners"
    assert r.json()["detail"]["city"] == "bengaluru"


MUMBAI = dict(ROW, name="Meena Pillai", email="meena@studioweft.com", city="Mumbai")


def test_each_city_of_an_account_can_have_its_own_owner(meera, priya, arjun):
    import_rows(meera, [ROW, ROHAN, MUMBAI])
    rows = _all(meera)
    pid, aid = _uid(priya), _uid(arjun)
    r = meera.post("/api/sync", json={"leads": [
        _put(rows[ROW["email"]], assignee=pid), _put(rows[ROHAN["email"]], assignee=pid),
        _put(rows[MUMBAI["email"]], assignee=aid),
    ]})
    assert r.status_code == 200
    # each sees only their own city's contacts of the same account
    assert {x["lead"]["city"] for x in priya.get("/api/leads").json()} == {"Bengaluru"}
    assert {x["lead"]["city"] for x in arjun.get("/api/leads").json()} == {"Mumbai"}


def test_city_names_are_matched_loosely_and_blank_city_is_one_location(meera, priya, arjun):
    import_rows(meera, [ROW, dict(ROHAN, city=" bengaluru "),
                        dict(LUMA, city=""), dict(LUMA, name="Asha", email="asha@luma.in", city="—")])
    rows = _all(meera)
    r = meera.post("/api/sync", json={"leads": [_put(rows[ROW["email"]], assignee=_uid(priya)),
                                                 _put(rows[ROHAN["email"]], assignee=_uid(arjun))]})
    assert r.status_code == 409          # "Bengaluru" and " bengaluru " are the same city
    r = meera.post("/api/sync", json={"leads": [_put(rows[LUMA["email"]], assignee=_uid(priya)),
                                                 _put(rows["asha@luma.in"], assignee=_uid(arjun))]})
    assert r.status_code == 409          # no city and "—" are the same (unknown) location


def test_a_new_city_under_an_assigned_account_starts_unassigned(meera, priya):
    import_rows(meera, [ROW])
    first = _all(meera)[ROW["email"]]
    assert meera.post("/api/sync", json={"leads": [_put(first, assignee=_uid(priya))]}).status_code == 200
    import_rows(meera, [ROHAN, MUMBAI])
    rows = _all(meera)
    assert rows[ROHAN["email"]]["lead"]["assignee"] == _uid(priya)    # same city: joins its owner
    assert rows[MUMBAI["email"]]["lead"]["assignee"] is None          # new city: waits for a manager


def test_a_rep_adding_a_contact_in_a_new_city_keeps_it(meera, priya, arjun):
    import_rows(meera, [ROW])
    first = _all(meera)[ROW["email"]]
    meera.post("/api/sync", json={"leads": [_put(first, assignee=_uid(priya))]})
    # arjun finds someone at Studio Weft in Mumbai himself: it's his
    res = import_rows(arjun, [MUMBAI]).json()
    assert res["created"][0]["lead"]["assignee"] == _uid(arjun)
    # and a contact he adds in Bengaluru stays with priya, who owns that city
    res = import_rows(arjun, [ROHAN]).json()
    assert res["createdCount"] == 1 and res["created"] == []
    joined = _all(meera)[ROHAN["email"]]["lead"]
    assert joined["assignee"] == _uid(priya)
    assert "Studio Weft · Bengaluru is already owned by Priya Nair" in joined["activity"][0]["txt"]


def test_moving_a_contact_to_another_city_must_follow_that_citys_owner(meera, priya, arjun):
    import_rows(meera, [ROW, MUMBAI])
    rows = _all(meera)
    meera.post("/api/sync", json={"leads": [_put(rows[ROW["email"]], assignee=_uid(priya)),
                                             _put(rows[MUMBAI["email"]], assignee=_uid(arjun))]})
    rows = _all(meera)
    # correcting the Mumbai contact's city to Bengaluru while leaving it with arjun splits Bengaluru
    r = meera.post("/api/sync", json={"leads": [_put(rows[MUMBAI["email"]], city="Bengaluru")]})
    assert r.status_code == 409
    # moving it together with its new owner is fine
    r = meera.post("/api/sync", json={"leads": [_put(rows[MUMBAI["email"]], city="Bengaluru", assignee=_uid(priya))]})
    assert r.status_code == 200


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
