import { describe, expect, it } from "vitest";
import {
  approvalsWaiting, callsToday, followupsDue, greeting, hotWithoutNextStep, myRequests, notContactedYet,
  stuckLocations, teamToday, unownedCities, upcomingMeetings,
} from "../lib/dashboard";
import { paymentId } from "../lib/revenue";
import { DEMO_REPS } from "../lib/seed";
import type { Meeting } from "../lib/types";
import type { ChangeRequest } from "../lib/store";
import { makeLead, resetStore, store } from "./helpers";

// Today in the tests is Wed 23 Sep 2026.
const meeting = (date: string, time = "10:00", status: Meeting["status"] = "scheduled"): Meeting => ({
  id: "M" + date + time, date, time, mode: "Call", notes: "", status,
});

describe("DASH. Dashboard: my day", () => {
  it("DASH1 overdue and today's follow-ups, oldest first; closed deals and other days left out", () => {
    const late2 = makeLead({ nextFollowup: "2026-09-20" });
    const late1 = makeLead({ nextFollowup: "2026-09-10" });
    const today = makeLead({ nextFollowup: "2026-09-23" });
    const later = makeLead({ nextFollowup: "2026-09-24" });
    const wonLate = makeLead({ nextFollowup: "2026-09-01", stage: "won" });
    const none = makeLead({ nextFollowup: null });
    const r = followupsDue([late2, late1, today, later, wonLate, none]);
    expect(r.overdue.map((l) => l.id)).toEqual([late1.id, late2.id]);
    expect(r.today.map((l) => l.id)).toEqual([today.id]);
  });

  it("DASH2 meetings: scheduled ones from today through the next 7 days, in time order", () => {
    const a = makeLead({ meetings: [meeting("2026-09-25", "15:00"), meeting("2026-09-23", "16:30")] });
    const b = makeLead({ meetings: [meeting("2026-09-23", "09:00"), meeting("2026-09-30", "11:00")] });
    const r = upcomingMeetings([a, b]);
    expect(r.map((m) => `${m.meeting.date} ${m.meeting.time}`)).toEqual([
      "2026-09-23 09:00", "2026-09-23 16:30", "2026-09-25 15:00", "2026-09-30 11:00",
    ]);
  });

  it("DASH3 ✗ past, cancelled, done and 8-days-away meetings are not shown", () => {
    const l = makeLead({
      meetings: [
        meeting("2026-09-22"), meeting("2026-09-24", "10:00", "cancelled"),
        meeting("2026-09-24", "11:00", "done"), meeting("2026-10-01"),
      ],
    });
    expect(upcomingMeetings([l])).toEqual([]);
  });

  it("DASH4 hot contacts with no next step (a manual Hot counts; closed or planned don't)", () => {
    const hot = makeLead({ priorityAuto: "Hot" });
    const madeHot = makeLead({ priorityAuto: "Low", priorityOverride: "Hot" });
    const planned = makeLead({ priorityAuto: "Hot", nextFollowup: "2026-09-30" });
    const lost = makeLead({ priorityAuto: "Hot", stage: "lost" });
    const cooled = makeLead({ priorityAuto: "Hot", priorityOverride: "Nurture" });
    expect(hotWithoutNextStep([hot, madeHot, planned, lost, cooled]).map((l) => l.id)).toEqual([hot.id, madeHot.id]);
  });

  it("DASH5 not contacted yet: only 'New', newest assignment first", () => {
    const old = makeLead({ ownerSince: "2026-09-01" });
    const fresh = makeLead({ ownerSince: "2026-09-22" });
    const contacted = makeLead({ stage: "contacted" });
    expect(notContactedYet([old, fresh, contacted]).map((l) => l.id)).toEqual([fresh.id, old.id]);
  });

  it("DASH6 calls today against the target (8 when none is set)", () => {
    const called = makeLead({ assignee: "priya", stage: "contacted", stageHistory: [{ stage: "new", date: "2026-09-20" }, { stage: "contacted", date: "2026-09-23" }] });
    const yesterday = makeLead({ assignee: "priya", stage: "contacted", stageHistory: [{ stage: "contacted", date: "2026-09-22" }] });
    expect(callsToday([called, yesterday], "priya", {})).toEqual({ done: 1, target: 8 });
    expect(callsToday([called], "priya", { priya: { callsPerDay: 12 } }).target).toBe(12);
  });

  it("DASH7 my requests: waiting ones first, decisions from the last week, nobody else's", () => {
    const l = makeLead({ name: "Ananya" });
    const cr = (id: string, by: string, status: ChangeRequest["status"], decidedAt?: string): ChangeRequest => ({
      id, requestedBy: by, requestedAt: "2026-09-10", status, decidedAt, scope: "lead", leadId: l.id, changes: {},
    });
    const r = myRequests(
      [cr("a", "priya", "approved", "2026-09-21"), cr("b", "priya", "pending"), cr("c", "priya", "rejected", "2026-09-01"), cr("d", "arjun", "pending")],
      [{ id: "lv", repId: "priya", date: "2026-10-02", reason: "", status: "pending", requestedAt: "2026-09-20" }],
      [l],
      "priya"
    );
    expect(r.map((x) => x.id)).toEqual(["lv", "b", "a"]);
    expect(r.find((x) => x.id === "b")!.label).toBe("Change to Ananya");
  });

  it("DASH8 greeting follows the time of day", () => {
    expect([greeting(8), greeting(13), greeting(19)]).toEqual(["Good morning", "Good afternoon", "Good evening"]);
  });
});

describe("DASH. Dashboard: team (managers)", () => {
  it("DASH9 approvals waiting count edits and leave separately", () => {
    const cr = { id: "x", requestedBy: "priya", requestedAt: "", status: "pending", scope: "lead", leadId: "L1", changes: {} } as ChangeRequest;
    expect(approvalsWaiting([cr, { ...cr, id: "y", status: "approved" }], [
      { id: "lv", repId: "arjun", date: "2026-10-02", reason: "", status: "pending", requestedAt: "" },
    ])).toEqual({ edits: 1, leave: 1 });
  });

  it("DASH10 cities with no owner, biggest first; owned cities left out", () => {
    const leads = [
      makeLead({ account: "Reliance", city: "Pune", assignee: null, ownerSince: null }),
      makeLead({ account: "Reliance", city: "Mumbai", assignee: null, ownerSince: null }),
      makeLead({ account: "Reliance", city: "Mumbai", assignee: null, ownerSince: null }),
      makeLead({ account: "Reliance", city: "Delhi", assignee: "priya" }),
    ];
    expect(unownedCities(leads).map((c) => [c.city, c.contacts])).toEqual([["Mumbai", 2], ["Pune", 1]]);
  });

  it("DASH11 stuck: 60+ days without moving forward, longest first", () => {
    const leads = [
      makeLead({ account: "Old", ownerSince: "2026-06-01", stageHistory: [{ stage: "new", date: "2026-06-01" }] }),
      makeLead({ account: "Older", ownerSince: "2026-05-01", stageHistory: [{ stage: "new", date: "2026-05-01" }] }),
      makeLead({ account: "Fresh", ownerSince: "2026-09-01", stageHistory: [{ stage: "new", date: "2026-09-01" }] }),
    ];
    expect(stuckLocations(leads).map((s) => s.account)).toEqual(["Older", "Old"]);
  });

  it("DASH12 team today: who's away, calls against target, overdue follow-ups", () => {
    const leads = [
      makeLead({ assignee: "priya", nextFollowup: "2026-09-20" }),
      makeLead({ assignee: "arjun", meetings: [meeting("2026-09-23")] }),
    ];
    const reps = DEMO_REPS.filter((r) => r.role === "Rep");
    const rows = teamToday(leads, reps, { arjun: { callsPerDay: 5 } }, [], [{ id: "x", repId: "arjun", date: "2026-09-23", reason: "Sick" }]);
    expect(rows.map((r) => [r.rep.id, r.away, r.target, r.overdue, r.meetingsToday])).toEqual([
      ["priya", null, 8, 1, 0],
      ["arjun", "Sick", 5, 0, 1],
    ]);
  });
});

describe("PAID. Marking payments paid", () => {
  const won = () => makeLead({ assignee: "priya", stage: "won", plan: "growth", mandateDate: "2026-08-20" });

  it("PAID1 a rep marks a debit on their own account: recorded with amount, and noted on the contact", () => {
    const l = won();
    resetStore([l], "priya");
    store().markPaid(l.id, "2026-09-20");
    const p = store().payments[paymentId(l.id, "2026-09-20")];
    expect(p).toMatchObject({ leadId: l.id, billingDate: "2026-09-20", amount: 3000, markedBy: "priya" });
    expect(store().leads[0].activity[0].txt).toContain("Payment received");
  });

  it("PAID2 ✗ a rep can't mark someone else's account, and can't undo", () => {
    const l = won();
    resetStore([l], "arjun");
    store().markPaid(l.id, "2026-09-20");
    expect(store().payments).toEqual({});
    resetStore([l], "priya");
    store().markPaid(l.id, "2026-09-20");
    store().unmarkPaid(paymentId(l.id, "2026-09-20"));
    expect(Object.keys(store().payments)).toHaveLength(1);
  });

  it("PAID3 a manager can undo; marking twice keeps one record", () => {
    const l = won();
    resetStore([l], "meera");
    store().markPaid(l.id, "2026-09-20");
    store().markPaid(l.id, "2026-09-20");
    expect(Object.keys(store().payments)).toHaveLength(1);
    expect(store().leads[0].activity).toHaveLength(1);
    store().unmarkPaid(paymentId(l.id, "2026-09-20"));
    expect(store().payments).toEqual({});
  });

  it("PAID4 deleting a contact drops its payments too", () => {
    const l = won();
    resetStore([l], "meera");
    store().markPaid(l.id, "2026-09-20");
    store().deleteLead(l.id);
    expect(store().payments).toEqual({});
  });
});
