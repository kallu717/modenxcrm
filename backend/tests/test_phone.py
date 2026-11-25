"""Every contact needs an email or a 10-digit phone (or both), and a phone
number, like an email, can belong to only one lead."""

import pytest

from app.phone import phone_digits
from conftest import ROW, import_rows

A = dict(ROW, name="A", email="a@x.com", phone="")
B = dict(ROW, name="B", email="", phone="9876543210")


def _all(client):
    return client.get("/api/leads").json()


def _put(x, **changes):
    return {"version": x["version"], "lead": dict(x["lead"], **changes)}


@pytest.mark.parametrize("raw,want", [
    ("9876543210", "9876543210"),
    ("98765 43210", "9876543210"),
    ("+91 98765 43210", "9876543210"),
    ("+91-98765-43210", "9876543210"),
    ("919876543210", "9876543210"),
    ("080 2558 8844", "8025588844"),
    ("(080) 2558-8844", "8025588844"),
    ("987654321", None),        # 9 digits
    ("98765432101", None),      # 11 digits, no leading 0
    ("+1 415 555 0100 9", None),
    ("98765abc10", None),
    ("", None),
    ("   ", None),
])
def test_phone_rule(raw, want):
    assert phone_digits(raw) == want


def test_PH1_email_only_imports(meera):
    r = import_rows(meera, [A]).json()
    assert r["ready"] == 1 and r["rejected"] == 0


def test_PH2_phone_only_imports_and_is_saved_as_10_digits(meera):
    r = import_rows(meera, [dict(B, phone="+91 98765 43210")]).json()
    assert r["ready"] == 1
    lead = r["created"][0]["lead"]
    assert lead["phone"] == "9876543210" and lead["email"] == "" and lead["emailQuality"] == "none"


def test_PH3_neither_email_nor_phone_is_refused(meera):
    r = import_rows(meera, [dict(ROW, email="", phone="")]).json()
    assert r["ready"] == 0 and r["rejected"] == 1
    assert "needs an email or a phone number" in r["issues"][0]


def test_PH4_phone_must_be_10_digits(meera):
    r = import_rows(meera, [dict(B, phone="12345"), dict(B, name="C", phone="98765432101")]).json()
    assert r["ready"] == 0 and r["rejected"] == 2
    assert all("must be 10 digits" in t for t in r["issues"])


def test_PH5_duplicate_phone_is_skipped_across_reps_and_formats(priya, arjun):
    import_rows(priya, [B])
    # arjun can't see priya's lead, and types it differently: still a duplicate
    r = import_rows(arjun, [dict(B, name="Other", phone="+91 98765-43210")]).json()
    assert r["duplicates"] == 1 and r["ready"] == 0
    assert "phone 9876543210 already exists" in r["issues"][0]


def test_PH6_duplicate_phone_inside_one_sheet(meera):
    r = import_rows(meera, [B, dict(B, name="Twin", email="twin@x.com")]).json()
    assert r["ready"] == 1 and r["duplicates"] == 1


def test_PH7_new_lead_form_takes_phone_only_but_not_neither(priya):
    ok = priya.post("/api/leads", json=dict(B))
    assert ok.status_code == 201
    bad = priya.post("/api/leads", json=dict(ROW, email="", phone=""))
    assert bad.status_code == 422
    dup = priya.post("/api/leads", json=dict(B, name="Again", email="again@x.com"))
    assert dup.status_code == 422 and "already exists" in dup.json()["detail"]["issues"][0]


def test_PH8_editing_to_a_taken_phone_is_a_409(meera):
    import_rows(meera, [A, B])
    leads = {x["lead"]["name"]: x for x in _all(meera)}
    r = meera.post("/api/sync", json={"leads": [_put(leads["A"], phone="098765 43210")]})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "duplicate_phone"


def test_PH9_editing_to_a_bad_phone_or_to_nothing_is_refused(meera):
    import_rows(meera, [A, B])
    leads = {x["lead"]["name"]: x for x in _all(meera)}
    r = meera.post("/api/sync", json={"leads": [_put(leads["A"], phone="12345")]})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "bad_phone"
    r = meera.post("/api/sync", json={"leads": [_put(leads["B"], phone="")]})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "needs_email_or_phone"


def test_PH10_freed_phone_can_be_reused(meera):
    import_rows(meera, [A, B])
    leads = {x["lead"]["name"]: x for x in _all(meera)}
    # B gets an email and drops the phone; then A can take that phone
    r = meera.post("/api/sync", json={"leads": [_put(leads["B"], email="b@x.com", phone="")]})
    assert r.status_code == 200
    r = meera.post("/api/sync", json={"leads": [_put(leads["A"], phone="9876543210")]})
    assert r.status_code == 200


def test_PH11_unchanged_old_style_phone_does_not_block_other_edits(meera):
    # A lead saved before the rule with a number that doesn't fit it
    import_rows(meera, [A])
    x = _all(meera)[0]
    from app.db import SessionLocal
    from app.models import Lead
    with SessionLocal() as db:
        row = db.get(Lead, x["lead"]["id"])
        row.data = dict(row.data, phone="+1 415 555 0100")
        db.commit()
    x = _all(meera)[0]
    r = meera.post("/api/sync", json={"leads": [_put(x, stage="contacted")]})
    assert r.status_code == 200
