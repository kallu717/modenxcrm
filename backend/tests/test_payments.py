"""Marking a monthly debit as paid (record kind "payment")."""

from conftest import ROW, import_rows


def _lead_id(client):
    return next(x["lead"]["id"] for x in client.get("/api/leads").json() if x["lead"]["email"] == ROW["email"])


def _mark(client, lead_id, billing="2026-11-05", **extra):
    data = {"leadId": lead_id, "billingDate": billing, "amount": 3000, **extra}
    return client.post("/api/sync", json={"records": [{"kind": "payment", "id": f"{lead_id}@{billing}", "data": data}]})


def _payments(client):
    return client.get("/api/records", params={"kind": "payment"}).json()


def test_rep_marks_a_payment_on_their_own_account_paid(priya):
    import_rows(priya, [ROW])
    lid = _lead_id(priya)
    r = _mark(priya, lid, markedBy="999", paidOn="1999-01-01")
    assert r.status_code == 200
    [p] = _payments(priya)
    me = priya.get("/api/me").json()["id"]
    assert p["id"] == f"{lid}@2026-11-05"
    assert p["data"]["markedBy"] == me                  # set by the server, not the browser
    assert p["data"]["paidOn"] != "1999-01-01"


def test_manager_sees_and_can_undo_a_payment(priya, meera):
    import_rows(priya, [ROW])
    lid = _lead_id(priya)
    _mark(priya, lid)
    assert len(_payments(meera)) == 1
    r = meera.post("/api/sync", json={"deleteRecords": [{"kind": "payment", "id": f"{lid}@2026-11-05"}]})
    assert r.status_code == 200 and _payments(meera) == []


def test_rep_cannot_mark_someone_elses_account_paid(priya, arjun):
    import_rows(priya, [ROW])
    assert _mark(arjun, _lead_id(priya)).status_code == 403
    assert _payments(arjun) == []


def test_rep_cannot_undo_or_rewrite_a_marked_payment(priya):
    import_rows(priya, [ROW])
    lid = _lead_id(priya)
    _mark(priya, lid)
    r = priya.post("/api/sync", json={"deleteRecords": [{"kind": "payment", "id": f"{lid}@2026-11-05"}]})
    assert r.status_code == 403
    assert _mark(priya, lid, amount=1).status_code == 403
    assert len(_payments(priya)) == 1


def test_payment_with_a_bad_date_or_mismatched_id_is_refused(priya):
    import_rows(priya, [ROW])
    lid = _lead_id(priya)
    assert _mark(priya, lid, billing="2026-02-30").status_code == 422
    assert _mark(priya, lid, billing="next week").status_code == 422
    r = priya.post("/api/sync", json={"records": [{"kind": "payment", "id": "L1@2026-11-05",
                                                   "data": {"leadId": lid, "billingDate": "2026-11-05"}}]})
    assert r.status_code == 422
    assert _mark(priya, "L999999").status_code == 403   # no such lead
    assert _payments(priya) == []


def test_pending_user_cannot_mark_payments(priya, newhire):
    import_rows(priya, [ROW])
    assert _mark(newhire, _lead_id(priya)).status_code == 403
