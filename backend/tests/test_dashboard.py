"""Each person's dashboard layout (record kind "dashboard")."""

from pathlib import Path


def _me(client):
    return client.get("/api/me").json()["id"]


def _save(client, widgets, rid=None):
    rid = rid or _me(client)
    return client.post("/api/sync", json={"records": [{"kind": "dashboard", "id": rid, "data": {"widgets": widgets}}]})


def _mine(client):
    me = _me(client)
    return [r for r in client.get("/api/records", params={"kind": "dashboard"}).json() if r["id"] == me]


def test_rep_saves_their_own_layout_in_order(priya):
    widgets = [{"id": "followups", "w": 8, "h": 5}, {"id": "glance", "w": 12, "h": 2}]
    assert _save(priya, widgets).status_code == 200
    [rec] = _mine(priya)
    assert rec["data"] == {"widgets": widgets}


def test_unknown_fields_are_dropped(priya):
    assert _save(priya, [{"id": "hot", "w": 6, "h": 4, "colour": "red", "html": "<b>x</b>"}]).status_code == 200
    assert _mine(priya)[0]["data"]["widgets"] == [{"id": "hot", "w": 6, "h": 4}]


def test_rep_cannot_add_manager_or_admin_widgets(priya):
    assert _save(priya, [{"id": "team-today", "w": 6, "h": 5}]).status_code == 403
    assert _save(priya, [{"id": "access", "w": 6, "h": 2}]).status_code == 403
    assert _mine(priya) == []


def test_manager_can_add_team_widgets_but_not_admin_ones(meera):
    assert _save(meera, [{"id": "team-today", "w": 6, "h": 5}, {"id": "followups", "w": 6, "h": 5}]).status_code == 200
    assert _save(meera, [{"id": "access", "w": 6, "h": 2}]).status_code == 403


def test_admin_cannot_add_selling_widgets(asha):
    assert _save(asha, [{"id": "access", "w": 6, "h": 2}, {"id": "team-glance", "w": 12, "h": 2}]).status_code == 200
    assert _save(asha, [{"id": "followups", "w": 6, "h": 5}]).status_code == 403


def test_nobody_can_change_someone_elses_dashboard(priya, meera):
    assert _save(meera, [{"id": "followups", "w": 6, "h": 5}], rid=_me(priya)).status_code == 403
    assert _save(priya, [{"id": "followups", "w": 6, "h": 5}], rid=_me(meera)).status_code == 403


def test_bad_layouts_are_refused(priya):
    bad = [
        [{"id": "nope", "w": 6, "h": 4}],                                  # unknown widget
        [{"id": "hot", "w": 6, "h": 4}, {"id": "hot", "w": 6, "h": 4}],    # twice
        [{"id": "hot", "w": 2, "h": 4}],                                   # narrower than allowed
        [{"id": "hot", "w": 13, "h": 4}],                                  # wider than the grid
        [{"id": "hot", "w": 6, "h": 99}],                                  # too tall
        [{"id": "hot", "w": "6", "h": 4}],                                 # not a number
        [{"id": "hot", "w": True, "h": 4}],
        ["hot"],
        [{"id": "glance", "w": 12, "h": 2}] * 41,                          # too many
    ]
    for widgets in bad:
        assert _save(priya, widgets).status_code in (403, 422), widgets
    r = priya.post("/api/sync", json={"records": [{"kind": "dashboard", "id": _me(priya), "data": {"widgets": "all"}}]})
    assert r.status_code == 422
    assert _mine(priya) == []


def test_an_empty_dashboard_is_allowed(priya):
    assert _save(priya, []).status_code == 200
    assert _mine(priya)[0]["data"] == {"widgets": []}


def test_pending_user_cannot_save_a_dashboard(newhire):
    r = newhire.post("/api/sync", json={"records": [{"kind": "dashboard", "id": "1", "data": {"widgets": []}}]})
    assert r.status_code == 403


def test_server_and_screens_share_the_same_widget_list():
    root = Path(__file__).resolve().parents[2]
    server = (root / "backend" / "app" / "dashboard_widgets.json").read_text(encoding="utf-8")
    screens = (root / "lib" / "dashboard-widgets.json").read_text(encoding="utf-8")
    assert server == screens, "backend/app/dashboard_widgets.json and lib/dashboard-widgets.json must be identical"
