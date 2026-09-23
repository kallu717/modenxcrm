import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../lib/store";
import { computeRepStats } from "../lib/reports";
import { countWorkingDays } from "../lib/calendar";
import type { ImportRow } from "../lib/import";
import { makeLead, resetStore, store, leadById } from "./helpers";

const as = (userId: string) => useStore.setState({ currentUserId: userId });
const pending = () => store().changeRequests.filter((c) => c.status === "pending");
const importRow = (p: Partial<ImportRow>): ImportRow => ({
  name: "Imported Person", title: "Founder", account: "Fresh Co", type: "Brand",
  email: "", verified: "", phone: "", city: "Pune", notes: "", ...p,
});

describe("I. Account assignment (1 account = 1 rep)", () => {
  const a = makeLead({ account: "Luma Home", ownerSince: "2026-06-01" });
  const b = makeLead({ account: "Luma Home", ownerSince: "2026-06-01" });
  beforeEach(() => resetStore([a, b]));

  it("I1 every contact moves to the new rep", () => {
    store().assignAccount("Luma Home", "arjun");
    expect(store().leads.map((l) => l.assignee)).toEqual(["arjun", "arjun"]);
  });

  it("I2 a real reassignment restarts aging", () => {
    store().assignAccount("Luma Home", "arjun");
    expect(store().leads.map((l) => l.ownerSince)).toEqual(["2026-09-23", "2026-09-23"]);
  });

  it("I3 re-assigning to the same rep keeps the aging clock", () => {
    store().assignAccount("Luma Home", "priya");
    expect(store().leads.map((l) => l.ownerSince)).toEqual(["2026-06-01", "2026-06-01"]);
  });

  it("I4 unassigning clears owner and owner-since", () => {
    store().assignAccount("Luma Home", null);
    expect(store().leads.map((l) => [l.assignee, l.ownerSince])).toEqual([[null, null], [null, null]]);
  });

  it("I5 activity names who did it", () => {
    store().assignAccount("Luma Home", "arjun");
    expect(leadById(a.id).activity[0].txt).toBe("Account reassigned from Priya Nair to Arjun Mehta by Meera Iyer.");
  });
});

describe("J. Role visibility", () => {
  const mine = makeLead({ account: "Priya Co", assignee: "priya" });
  const his = makeLead({ account: "Arjun Co", assignee: "arjun" });
  const nobody = makeLead({ account: "Open Co", assignee: null, ownerSince: null });
  beforeEach(() => resetStore([mine, his, nobody]));

  it("J1 a rep sees only her own leads", () => {
    as("priya");
    expect(store().visibleLeads().map((l) => l.id)).toEqual([mine.id]);
  });

  it("J2 the manager sees everything", () => {
    expect(store().visibleLeads()).toHaveLength(3);
  });

  it("J3 a rep can manage only her own account", () => {
    as("priya");
    expect(store().accountManageable("Arjun Co")).toBe(false);
    expect(store().accountManageable("Priya Co")).toBe(true);
  });
});

describe("K. Adding leads", () => {
  const owned = makeLead({ account: "Luma Home", assignee: "arjun", email: "exists@luma.com" });
  const studio = makeLead({ account: "Studio Weft", type: "Brand", assignee: "arjun" });
  beforeEach(() => resetStore([owned, studio]));
  const input = (p = {}) => ({
    name: "New Person", title: "Founder", account: "Fresh Co", type: "Brand" as const,
    email: "new@fresh.com", phone: "", city: "Pune", verified: false, ...p,
  });

  it("K1 rep adding at a new account owns it", () => {
    as("priya");
    expect(store().createLead(input())?.assignee).toBe("priya");
  });

  it("K2 rep adding at Arjun's account — it stays with Arjun", () => {
    as("priya");
    const l = store().createLead(input({ account: "Luma Home" }))!;
    expect(l.assignee).toBe("arjun");
    expect(l.activity[0].txt).toContain("Account already owned by Arjun Mehta");
  });

  it("K3 manager adding at a new account leaves it unassigned", () => {
    expect(store().createLead(input())?.assignee).toBeNull();
  });

  it("K4 an email already in use (any case) is refused", () => {
    expect(store().createLead(input({ email: "EXISTS@Luma.com" }))).toBeNull();
    expect(store().leads).toHaveLength(2);
  });

  it("K5 phone optional, city required", () => {
    expect(store().createLead(input({ phone: "" }))).not.toBeNull();
    expect(store().createLead(input({ email: "other@fresh.com", city: "" }))).toBeNull();
  });

  it("K6 verified email gets the +12 bonus", () => {
    const l = store().createLead(input({ verified: true }))!;
    expect(l.emailQuality).toBe("verified");
    expect(l.scoreReasons).toContain("verified email (+12)");
  });

  it("K7 rep imports two contacts for one new account", () => {
    as("priya");
    const maxBefore = Math.max(...store().leads.map((l) => Number(l.id.slice(1))));
    store().importLeads([importRow({ name: "One" }), importRow({ name: "Two" })], "sheet.xlsx");
    const added = store().leads.filter((l) => l.account === "Fresh Co");
    expect(added.map((l) => l.assignee)).toEqual(["priya", "priya"]);
    expect(added.map((l) => Number(l.id.slice(1)))).toEqual([maxBefore + 1, maxBefore + 2]);
  });

  it("K8 a contact joining an existing account takes that account's type", () => {
    store().importLeads([importRow({ account: "Studio Weft", type: "Mall" })], "sheet.xlsx");
    const added = store().leads.find((l) => l.name === "Imported Person")!;
    expect(added.type).toBe("Brand");
  });

  it("K9 'studio weft' joins the existing 'Studio Weft' and its owner", () => {
    as("priya");
    store().importLeads([importRow({ account: "studio weft" })], "sheet.xlsx");
    const added = store().leads.find((l) => l.name === "Imported Person")!;
    expect(added.account).toBe("Studio Weft");
    expect(added.assignee).toBe("arjun");
  });
});

describe("L. Stage changes", () => {
  const l = makeLead();
  beforeEach(() => resetStore([l]));

  it("L1 a change is recorded once; the same stage again is a no-op", () => {
    store().setLeadStage(l.id, "contacted");
    store().setLeadStage(l.id, "contacted");
    expect(leadById(l.id).stageHistory).toHaveLength(2);
    expect(leadById(l.id).activity).toHaveLength(1);
  });

  it("L2 won sets wonAt; moving off Won clears it", () => {
    store().setLeadStage(l.id, "won");
    expect(leadById(l.id).wonAt).toBe("2026-09-23");
    store().setLeadStage(l.id, "proposal");
    expect(leadById(l.id).wonAt).toBeNull();
  });

  it("L3 a board drag logs the move", () => {
    store().setLeadStage(l.id, "contacted", "board");
    expect(leadById(l.id).activity[0].txt).toBe("Moved from New to Contacted.");
  });

  it("L4 subscription recorded", () => {
    store().setLeadPlan(l.id, "growth", "2026-09-23");
    expect(leadById(l.id)).toMatchObject({ plan: "growth", mandateDate: "2026-09-23" });
    expect(leadById(l.id).activity[0].txt).toContain("Growth");
  });
});

describe("M. Edit approvals", () => {
  const a = makeLead({ account: "Studio Weft", phone: "+91 90000 00000", email: "a@studioweft.com" });
  const b = makeLead({ account: "Studio Weft" });
  const other = makeLead({ account: "Luma Home", assignee: "arjun", email: "used@luma.com" });
  beforeEach(() => resetStore([a, b, other]));
  const phoneChange = { phone: { from: "+91 90000 00000", to: "+91 98765 43210" } };

  it("M1 a rep's edit waits for approval", () => {
    as("priya");
    store().saveLeadEdit(a.id, phoneChange);
    expect(pending()).toHaveLength(1);
    expect(leadById(a.id).phone).toBe("+91 90000 00000");
  });

  it("M2 approval applies it", () => {
    as("priya");
    store().saveLeadEdit(a.id, phoneChange);
    as("meera");
    store().applyChangeRequest(pending()[0].id, true);
    expect(leadById(a.id).phone).toBe("+91 98765 43210");
    expect(store().changeRequests[0].status).toBe("approved");
  });

  it("M3 rejection leaves the lead alone", () => {
    as("priya");
    store().saveLeadEdit(a.id, phoneChange);
    as("meera");
    store().applyChangeRequest(pending()[0].id, false);
    expect(leadById(a.id).phone).toBe("+91 90000 00000");
  });

  it("M4 a manager's edit applies immediately", () => {
    store().saveLeadEdit(a.id, phoneChange);
    expect(leadById(a.id).phone).toBe("+91 98765 43210");
    expect(store().changeRequests).toHaveLength(0);
  });

  it("M5 request IDs have no gaps", () => {
    as("priya");
    store().saveLeadEdit(a.id, phoneChange);
    store().saveAccountEdit("Studio Weft", { type: { from: "Brand", to: "Store" } });
    expect(store().changeRequests.map((c) => c.id)).toEqual(["CR001", "CR002"]);
  });

  it("M6 an approved account rename applies to every contact", () => {
    as("priya");
    store().saveAccountEdit("Studio Weft", { account: { from: "Studio Weft", to: "Studio Weft India" } });
    as("meera");
    store().applyChangeRequest(pending()[0].id, true);
    expect([leadById(a.id).account, leadById(b.id).account]).toEqual(["Studio Weft India", "Studio Weft India"]);
  });

  it("M7 renaming onto an existing account is refused", () => {
    const err = store().saveAccountEdit("Studio Weft", { account: { from: "Studio Weft", to: "luma home" } });
    expect(err).toBeTruthy();
    expect(leadById(a.id).account).toBe("Studio Weft");
  });

  it("M8 approval refused if the name was taken in the meantime", () => {
    as("priya");
    store().saveAccountEdit("Studio Weft", { account: { from: "Studio Weft", to: "New Name" } });
    as("meera");
    store().saveAccountEdit("Luma Home", { account: { from: "Luma Home", to: "New Name" } });
    store().applyChangeRequest(pending()[0].id, true);
    expect(leadById(a.id).account).toBe("Studio Weft");
    expect(pending()).toHaveLength(1);
  });

  it("M9 changing an email to one another lead already uses is refused", () => {
    store().saveLeadEdit(a.id, { email: { from: "a@studioweft.com", to: "USED@luma.com" } });
    expect(leadById(a.id).email).toBe("a@studioweft.com");
    as("priya");
    store().saveLeadEdit(a.id, { email: { from: "a@studioweft.com", to: "used@luma.com" } });
    expect(pending()).toHaveLength(0);
  });

  it("M10 deleting a lead removes its pending request", () => {
    as("priya");
    store().saveLeadEdit(a.id, phoneChange);
    store().deleteLead(a.id);
    expect(store().changeRequests).toHaveLength(0);
  });

  it("M11 deleting an account cleans up requests and reminders", () => {
    as("priya");
    store().saveLeadEdit(a.id, phoneChange);
    store().saveAccountEdit("Studio Weft", { type: { from: "Brand", to: "Store" } });
    useStore.setState({ paymentReminders: { [a.id]: "2026-09-26", [other.id]: "2026-09-28" } });
    as("meera");
    store().deleteAccount("Studio Weft");
    expect(store().changeRequests).toHaveLength(0);
    expect(store().paymentReminders).toEqual({ [other.id]: "2026-09-28" });
  });
});

describe("N. Follow-ups, notes and meetings", () => {
  const l = makeLead();
  beforeEach(() => resetStore([l]));

  it("N1 set then clear a follow-up", () => {
    store().setNextFollowup(l.id, "2026-09-30");
    expect(leadById(l.id).nextFollowup).toBe("2026-09-30");
    store().setNextFollowup(l.id, null);
    expect(leadById(l.id).nextFollowup).toBeNull();
    expect(leadById(l.id).activity).toHaveLength(2);
  });

  it("N2 snoozing an upcoming follow-up adds a week to it", () => {
    useStore.setState({ leads: [{ ...l, nextFollowup: "2026-09-25" }] });
    store().snoozeFollowup(l.id, 7);
    expect(leadById(l.id).nextFollowup).toBe("2026-10-02");
  });

  it("N3 snoozing a 10-day-overdue follow-up lands in the future", () => {
    useStore.setState({ leads: [{ ...l, nextFollowup: "2026-09-13" }] });
    store().snoozeFollowup(l.id, 7);
    expect(leadById(l.id).nextFollowup).toBe("2026-09-30");
  });

  it("N4 marked contacted, with and without a next date", () => {
    store().markContacted(l.id, "2026-09-28");
    expect(leadById(l.id).nextFollowup).toBe("2026-09-28");
    store().markContacted(l.id, null);
    expect(leadById(l.id).nextFollowup).toBeNull();
  });

  it("N5 Priya's WhatsApp note shows up in her report stats", () => {
    as("priya");
    store().addNote(l.id, "Shared the catalog", "WhatsApp");
    const stats = computeRepStats(store().leads, "priya", { from: "2026-09-23", to: "2026-09-23" });
    expect(stats.whatsapp).toBe(1);
  });

  it("N6 meeting time and status", () => {
    store().addMeeting(l.id, { date: "2026-09-30", time: "15:30", mode: "Video", notes: "" });
    const m = leadById(l.id).meetings[0];
    expect(m.time).toBe("3:30 PM");
    store().setMeetingStatus(l.id, m.id, "done");
    expect(leadById(l.id).meetings[0].status).toBe("done");
  });
});

describe("O. Leave and holidays", () => {
  beforeEach(() => resetStore([]));

  it("O1–O2 request, then a duplicate request", () => {
    expect(store().submitLeaveRequest("priya", "2026-10-05", "Family function")).toBe(true);
    expect(store().leaveRequests[0].status).toBe("pending");
    expect(store().submitLeaveRequest("priya", "2026-10-05", "Again")).toBe(false);
  });

  it("O3 approval records leave and removes the working day", () => {
    store().submitLeaveRequest("priya", "2026-10-05", "");
    store().decideLeaveRequest(store().leaveRequests[0].id, true);
    const { companyHolidays, repLeaves } = store();
    expect(countWorkingDays("priya", "2026-10-05", "2026-10-05", companyHolidays, repLeaves)).toBe(0);
  });

  it("O4 rejection records nothing", () => {
    store().submitLeaveRequest("priya", "2026-10-05", "");
    store().decideLeaveRequest(store().leaveRequests[0].id, false);
    expect(store().repLeaveOn("priya", "2026-10-05")).toBeNull();
  });

  it("O5 a day already approved can't be requested again", () => {
    store().submitLeaveRequest("priya", "2026-10-05", "");
    store().decideLeaveRequest(store().leaveRequests[0].id, true);
    expect(store().submitLeaveRequest("priya", "2026-10-05", "")).toBe(false);
  });

  it("O6 a second holiday on the same date is refused", () => {
    expect(store().addHoliday("2026-11-01", "Test")).toBe(true);
    expect(store().addHoliday("2026-11-01", "Test again")).toBe(false);
  });
});

describe("Q. Sign-in placeholder", () => {
  beforeEach(() => resetStore([]));

  it("Q1 signing in survives a refresh", () => {
    store().login();
    expect(store()).toMatchObject({ isAuthenticated: true, currentUserId: "meera" });
    useStore.setState({ isAuthenticated: false });
    store().hydrateAuth();
    expect(store().isAuthenticated).toBe(true);
  });

  it("Q2 logging out survives a refresh", () => {
    store().login();
    store().logout();
    store().hydrateAuth();
    expect(store().isAuthenticated).toBe(false);
  });
});
