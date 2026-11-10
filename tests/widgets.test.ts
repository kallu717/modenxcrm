import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  WIDGETS, addWidget, cleanLayout, defaultLayout, moveWidget, removeWidget, resizeWidget, widgetsForRole,
  type WidgetPlacement,
} from "../lib/widgets";
import {
  daysOff, followupsThisWeek, leaderboard, myActivity, noNextStep, pipelineByStage, recentlyAssigned,
  rosterCounts, wonMissingPlan, wonThisMonth,
} from "../lib/dashboard";
import { revenueByMonth } from "../lib/revenue";
import { DEMO_REPS } from "../lib/seed";
import { makeLead, resetStore, store } from "./helpers";

// Today in the tests is Wed 23 Sep 2026.

describe("WIDGET. Dashboard layouts", () => {
  it("WIDGET1 each role starts with its own default layout, using only widgets it may see", () => {
    for (const role of ["Rep", "Manager", "Admin"] as const) {
      const layout = defaultLayout(role);
      expect(layout.length, role).toBeGreaterThan(0);
      for (const w of layout) expect(WIDGETS.find((x) => x.id === w.id)!.roles, `${role} ${w.id}`).toContain(role);
    }
    expect(defaultLayout("Rep").map((w) => w.id)).not.toContain("team-today");
    expect(defaultLayout("Admin").map((w) => w.id)).not.toContain("followups");
    expect(defaultLayout("Pending")).toEqual([]);
  });

  it("WIDGET2 the gallery offers each role the right widgets", () => {
    const ids = (role: "Rep" | "Manager" | "Admin") => widgetsForRole(role).map((w) => w.id);
    expect(ids("Rep")).toContain("pipeline");
    expect(ids("Rep")).not.toContain("leaderboard");
    expect(ids("Manager")).toEqual(expect.arrayContaining(["followups", "leaderboard", "revenue"]));
    expect(ids("Manager")).not.toContain("access");
    expect(ids("Admin")).toEqual(expect.arrayContaining(["access", "roster", "team-today"]));
    expect(ids("Admin")).not.toContain("followups");
  });

  it("WIDGET3 nothing saved yet means the default layout; a saved empty layout stays empty", () => {
    expect(cleanLayout(undefined, "Rep")).toEqual(defaultLayout("Rep"));
    expect(cleanLayout({ widgets: [] }, "Rep")).toEqual([]);
  });

  it("WIDGET4 ✗ a tampered layout is cleaned: unknown, other-role and repeated widgets dropped, sizes pulled into range", () => {
    const raw = {
      widgets: [
        { id: "hot", w: 99, h: -3 },
        { id: "hot", w: 6, h: 4 },
        { id: "team-today", w: 6, h: 5 },
        { id: "<script>", w: 6, h: 4 },
        { id: "fresh", w: "wide", h: null },
        null,
      ],
    };
    expect(cleanLayout(raw, "Rep")).toEqual([
      { id: "hot", w: 12, h: 3 },
      { id: "fresh", w: 6, h: 4 },
    ]);
    expect(cleanLayout("junk", "Rep")).toEqual(defaultLayout("Rep"));
  });

  it("WIDGET5 move, resize (within limits), remove", () => {
    const l: WidgetPlacement[] = [{ id: "glance", w: 12, h: 2 }, { id: "hot", w: 6, h: 4 }, { id: "fresh", w: 6, h: 4 }];
    expect(moveWidget(l, "fresh", 0).map((w) => w.id)).toEqual(["fresh", "glance", "hot"]);
    expect(moveWidget(l, "glance", 99).map((w) => w.id)).toEqual(["hot", "fresh", "glance"]);
    expect(resizeWidget(l, "hot", 9, 6)[1]).toEqual({ id: "hot", w: 9, h: 6 });
    expect(resizeWidget(l, "hot", 1, 1)[1]).toEqual({ id: "hot", w: 4, h: 3 }); // its smallest
    expect(resizeWidget(l, "hot", 40, 40)[1]).toEqual({ id: "hot", w: 12, h: 12 });
    expect(removeWidget(l, "hot").map((w) => w.id)).toEqual(["glance", "fresh"]);
  });

  it("WIDGET6 adding puts the widget on top at its normal size", () => {
    expect(addWidget([{ id: "hot", w: 6, h: 4 }], "pipeline", "Rep")[0]).toEqual({ id: "pipeline", w: 6, h: 3 });
  });

  it("WIDGET7 ✗ can't add a widget twice, or one that isn't for your role", () => {
    const l: WidgetPlacement[] = [{ id: "hot", w: 6, h: 4 }];
    expect(addWidget(l, "hot", "Rep")).toBe(l);
    expect(addWidget(l, "leaderboard", "Rep")).toBe(l);
    expect(addWidget(l, "followups", "Admin")).toBe(l);
  });

  it("WIDGET8 the layout is saved per person and only holds id and size", () => {
    resetStore([], "priya");
    store().saveDashboard([{ id: "hot", w: 6, h: 4, extra: "x" } as unknown as WidgetPlacement]);
    expect(store().dashboards).toEqual({ priya: { widgets: [{ id: "hot", w: 6, h: 4 }] } });
  });

  it("WIDGET9 the screens and the server use the same widget list", () => {
    const screens = readFileSync(new URL("../lib/dashboard-widgets.json", import.meta.url), "utf8");
    const server = readFileSync(new URL("../backend/app/dashboard_widgets.json", import.meta.url), "utf8");
    expect(server).toBe(screens);
  });
});

describe("WIDGET. Data for the new widgets", () => {
  it("WIDGET10 pipeline by stage, won this month, missing plan", () => {
    const leads = [
      makeLead({ stage: "new" }), makeLead({ stage: "new" }), makeLead({ stage: "proposal" }),
      makeLead({ stage: "won", wonAt: "2026-09-05", plan: "growth", mandateDate: "2026-09-05" }),
      makeLead({ stage: "won", wonAt: "2026-08-20", plan: null, mandateDate: null }),
    ];
    const by = Object.fromEntries(pipelineByStage(leads).map((r) => [r.stage, r.count]));
    expect(by).toMatchObject({ new: 2, proposal: 1, won: 2, lost: 0 });
    expect(wonThisMonth(leads)).toHaveLength(1);
    expect(wonMissingPlan(leads)).toHaveLength(1);
  });

  it("WIDGET11 follow-ups this week (tomorrow to +7), no next step, recently assigned", () => {
    const a = makeLead({ nextFollowup: "2026-09-24" });
    const b = makeLead({ nextFollowup: "2026-09-30" });
    const today = makeLead({ nextFollowup: "2026-09-23" });
    const far = makeLead({ nextFollowup: "2026-10-01" });
    const none = makeLead({ nextFollowup: null, ownerSince: "2026-09-20" });
    const old = makeLead({ nextFollowup: null, ownerSince: "2026-08-01" });
    const closed = makeLead({ nextFollowup: null, stage: "lost" });
    expect(followupsThisWeek([b, a, today, far]).map((l) => l.id)).toEqual([a.id, b.id]);
    expect(noNextStep([none, old, closed, a]).map((l) => l.id)).toEqual([old.id, none.id]);
    expect(recentlyAssigned([none, old]).map((l) => l.id)).toEqual([none.id]);
  });

  it("WIDGET12 my activity: only my entries, newest first", () => {
    const l = makeLead({
      activity: [
        { who: "Priya Nair", txt: "Called", t: "", date: "2026-09-22", method: "Call" },
        { who: "Arjun Mehta", txt: "Emailed", t: "", date: "2026-09-23", method: "Email" },
        { who: "Priya Nair", txt: "Met", t: "", date: "2026-09-10", method: null },
      ],
    });
    expect(myActivity([l], "Priya Nair").map((a) => a.txt)).toEqual(["Called", "Met"]);
  });

  it("WIDGET13 days off: holidays plus only the chosen people's leave, in date order", () => {
    const off = daysOff(
      [{ date: "2026-10-02", name: "Gandhi Jayanti" }, { date: "2026-12-25", name: "Christmas" }],
      [{ id: "1", repId: "priya", date: "2026-09-25", reason: "" }, { id: "2", repId: "arjun", date: "2026-09-26", reason: "Sick" }],
      "2026-09-23", "2026-10-03", ["priya"]
    );
    expect(off.map((d) => [d.date, d.label])).toEqual([["2026-09-25", "Leave"], ["2026-10-02", "Gandhi Jayanti"]]);
  });

  it("WIDGET14 leaderboard this month: wins, then calls", () => {
    const leads = [
      makeLead({ assignee: "arjun", stage: "won", wonAt: "2026-09-10" }),
      makeLead({ assignee: "priya", stage: "contacted", stageHistory: [{ stage: "contacted", date: "2026-09-15" }] }),
      makeLead({ assignee: "priya", stage: "contacted", stageHistory: [{ stage: "contacted", date: "2026-08-15" }] }),
    ];
    const rows = leaderboard(leads, DEMO_REPS.filter((r) => r.role === "Rep"));
    expect(rows.map((r) => [r.rep.id, r.wins, r.calls])).toEqual([["arjun", 1, 0], ["priya", 0, 1]]);
  });

  it("WIDGET15 revenue for the last 6 months, oldest first, this month included", () => {
    const r = revenueByMonth([makeLead({ stage: "won", plan: "growth", mandateDate: "2026-08-10" })]);
    expect(r.map((m) => m.month)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(r.map((m) => m.amount)).toEqual([0, 0, 0, 0, 3000, 3000]);
  });

  it("WIDGET16 team by role", () => {
    expect(rosterCounts(DEMO_REPS)).toEqual([{ role: "Rep", count: 2 }, { role: "Manager", count: 1 }, { role: "Admin", count: 0 }]);
  });
});
