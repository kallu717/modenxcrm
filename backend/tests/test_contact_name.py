"""First name and last name (NAME): a contact's name comes in as firstName +
lastName — both required from this app's own New lead form and import sheet —
and the server merges them into the one name shown everywhere. A legacy
caller that only ever sends a plain `name` (the Lead Desk feed) still works
unchanged; see test_AA10 in test_auto_assign.py for that path."""

from conftest import ROW, import_rows


def split_row(**over):
    row = dict(ROW)
    row.pop("name")
    row = {**row, "firstName": "Ananya", "lastName": "Sharma", **over}
    return row


def test_NAME1_first_and_last_name_are_merged_into_the_contact_name(priya):
    r = import_rows(priya, [split_row(email="a@studioweft.net")]).json()
    assert r["createdCount"] == 1
    assert r["created"][0]["lead"]["name"] == "Ananya Sharma"


def test_NAME2_missing_last_name_is_refused(priya):
    row = split_row(email="a@studioweft.net")
    row["lastName"] = ""
    r = import_rows(priya, [row]).json()
    assert r["ready"] == 0
    assert any("missing Last name" in i for i in r["issues"])


def test_NAME3_missing_first_name_is_refused(priya):
    row = split_row(email="a@studioweft.net")
    row["firstName"] = ""
    r = import_rows(priya, [row]).json()
    assert r["ready"] == 0
    assert any("missing First name" in i for i in r["issues"])


def test_NAME4_neither_first_nor_last_name_is_refused(priya):
    row = split_row(email="a@studioweft.net")
    row["firstName"] = ""
    row["lastName"] = ""
    r = import_rows(priya, [row]).json()
    assert r["ready"] == 0
    assert any("missing First name, Last name" in i for i in r["issues"])


def test_NAME5_a_legacy_plain_name_still_works(priya):
    # The Lead Desk feed (and anything else that predates this change) sends
    # only `name`, never firstName/lastName — that path keeps working.
    r = import_rows(priya, [dict(ROW, name="Legacy Contact", email="legacy@studioweft.net")]).json()
    assert r["createdCount"] == 1
    assert r["created"][0]["lead"]["name"] == "Legacy Contact"


def test_NAME6_new_lead_form_requires_both_names_too(priya):
    row = split_row(email="form@studioweft.net")
    row.pop("lastName")
    bad = priya.post("/api/leads", json=row)
    assert bad.status_code == 422
    assert any("missing Last name" in i for i in bad.json()["detail"]["issues"])

    ok = priya.post("/api/leads", json=split_row(email="form2@studioweft.net"))
    assert ok.status_code == 201
    assert ok.json()["lead"]["name"] == "Ananya Sharma"


def test_NAME7_extra_spaces_around_each_name_are_trimmed(priya):
    row = split_row(email="spaced@studioweft.net", firstName="  Ananya  ", lastName="  Sharma  ")
    r = import_rows(priya, [row]).json()
    assert r["created"][0]["lead"]["name"] == "Ananya Sharma"
