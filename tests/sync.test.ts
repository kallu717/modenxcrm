import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../lib/store";
import { diff, fromServer, isEmpty, snapshot } from "../lib/sync";
import type { Bootstrap } from "../lib/api";
import { makeLead, resetStore, store } from "./helpers";

const as = (userId: string) => useStore.setState({ currentUserId: userId });
const versions = (n = 3) => new Map(store().leads.map((l) => [l.id, n]));

describe("S. Saving to the server", () => {
  const a = makeLead({ account: "Luma Home", assignee: "priya" });
  const b = makeLead({ account: "Luma Home", assignee: "priya" });
  const c = makeLead({ account: "Arden Living", assignee: "arjun" });
  beforeEach(() => resetStore([a, b, c]));

  it("S1 nothing to send when nothing changed", () => {
    expect(isEmpty(diff(snapshot(store()), store(), versions()))).toBe(true);
  });

  it("S2 a stage move sends only that lead, with the version the server gave", () => {
    const base = snapshot(store());
    store().setLeadStage(a.id, "contacted");
    const d = diff(base, store(), versions(7));
    expect(d.leads.map((x) => [x.lead.id, x.version, x.lead.stage])).toEqual([[a.id, 7, "contacted"]]);
    expect(d.records).toEqual([]);
  });

  it("S3 assigning an account sends every contact in one save", () => {
    const base = snapshot(store());
    store().assignAccount("Luma Home", "arjun");
    expect(diff(base, store(), versions()).leads.map((x) => x.lead.id)).toEqual([a.id, b.id]);
  });

  it("S4 a rep's edit request goes up as a record, plus the note on the lead", () => {
    as("priya");
    const base = snapshot(store());
    store().saveLeadEdit(a.id, { phone: { from: "", to: "+91 90000 00000" } });
    const d = diff(base, store(), versions());
    expect(d.records).toHaveLength(1);
    expect(d.records[0]).toMatchObject({ kind: "change_request", data: { status: "pending", requestedBy: "priya" } });
    // the lead itself is unchanged apart from the activity note
    expect(d.leads[0].lead.phone).toBe(a.phone);
  });

  it("S5 approving sends the edit and the decision together", () => {
    as("priya");
    store().saveLeadEdit(a.id, { phone: { from: "", to: "+91 90000 00000" } });
    as("meera");
    const base = snapshot(store());
    store().applyChangeRequest(store().changeRequests[0].id, true);
    const d = diff(base, store(), versions());
    expect(d.leads.map((x) => x.lead.phone)).toEqual(["+91 90000 00000"]);
    expect(d.records.map((r) => (r.data as { status: string }).status)).toEqual(["approved"]);
  });

  it("S6 deleting an account deletes its leads and their reminders", () => {
    store().logPaymentReminder(a.id, "2026-10-01");
    const base = snapshot(store());
    store().deleteAccount("Luma Home");
    const d = diff(base, store(), versions());
    expect(d.deleteLeads).toEqual([a.id, b.id]);
    expect(d.deleteRecords).toEqual([{ kind: "payment_reminder", id: a.id }]);
  });

  it("S7 holidays, targets and leave map to their own record kinds", () => {
    const base = snapshot(store());
    store().addHoliday("2026-12-25", "Christmas");
    store().setRepTarget("priya", 10);
    store().submitLeaveRequest("priya", "2026-10-05", "Family function");
    const kinds = diff(base, store(), versions()).records.map((r) => [r.kind, r.id]);
    expect(kinds).toEqual([
      ["leave_request", store().leaveRequests[0].id],
      ["holiday", "2026-12-25"],
      ["target", "priya"],
    ]);
  });

  it("S8 a lead the server hasn't created yet is never sent as an edit", () => {
    const base = snapshot(store());
    store().addLeads([makeLead({ account: "Fresh Co" })]);
    expect(isEmpty(diff(base, store(), versions()))).toBe(true);
  });
});

describe("T. Loading from the server", () => {
  it("T1 the signed-in user, the team and the records come from the server", () => {
    const lead = makeLead({ assignee: "7" });
    const boot: Bootstrap = {
      me: { id: "7", name: "Priya Nair", role: "Rep", color: "#1f6f5c", email: "priya@modenx.in" },
      users: [
        { id: "7", name: "Priya Nair", role: "Rep", color: "#1f6f5c", email: "priya@modenx.in" },
        { id: "9", name: "Meera Iyer", role: "Manager", color: "#c23b3b", email: "meera@modenx.in" },
      ],
      leads: [{ version: 4, lead }],
      records: {
        change_request: [],
        leave_request: [],
        leave_day: [],
        holiday: [{ id: "2026-12-25", data: { date: "2026-12-25", name: "Christmas" } }],
        payment_reminder: [{ id: lead.id, data: { billingDate: "2026-10-01" } }],
        target: [{ id: "7", data: { callsPerDay: 10 } }],
      },
    };
    const f = fromServer(boot);
    expect(f.currentUserId).toBe("7");
    expect(f.reps.map((r) => r.role)).toEqual(["Rep", "Manager"]);
    expect(f.reps[0]).not.toHaveProperty("email");
    expect(f.paymentReminders).toEqual({ [lead.id]: "2026-10-01" });
    expect(f.targets).toEqual({ "7": { callsPerDay: 10 } });
    expect(f.companyHolidays).toEqual([{ date: "2026-12-25", name: "Christmas" }]);
  });

  it("T2 what was loaded round-trips: saving straight after a load sends nothing", () => {
    resetStore([makeLead()]);
    store().addHoliday("2026-12-25", "Christmas");
    store().setRepTarget("priya", 10);
    store().logPaymentReminder(store().leads[0].id, "2026-10-01");
    const base = snapshot(store());
    useStore.setState({ ...store() });
    expect(isEmpty(diff(base, store(), versions()))).toBe(true);
  });
});
