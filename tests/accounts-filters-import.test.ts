import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildAccounts } from "../lib/accounts";
import { filterLeads, applyFuDateFilter, EMPTY_FILTERS, EMPTY_FU_DATE_FILTER } from "../lib/filters";
import { stageImport, readSheet } from "../lib/import";
import { makeLead } from "./helpers";

describe("F. Account roll-up", () => {
  it("F1 furthest stage and highest priority win", () => {
    const [a] = buildAccounts([
      makeLead({ stage: "new", priorityAuto: "Low" }),
      makeLead({ stage: "proposal", priorityAuto: "Hot" }),
      makeLead({ stage: "won", priorityAuto: "Warm" }),
    ]);
    expect(a.furthest).toBe("won");
    expect(a.priority).toBe("Hot");
  });

  it("F2 domain from the first email, or — when none", () => {
    expect(buildAccounts([makeLead({ email: "a@studioweft.com" })])[0].domain).toBe("studioweft.com");
    expect(buildAccounts([makeLead({ email: "" })])[0].domain).toBe("—");
  });

  it("F3 cities listed once each", () => {
    const [a] = buildAccounts([makeLead({ city: "Pune" }), makeLead({ city: "Pune" }), makeLead({ city: "Mumbai" })]);
    expect(a.cities.sort()).toEqual(["Mumbai", "Pune"]);
  });

  it("F4 only scheduled meetings are counted", () => {
    const m = (status: "scheduled" | "done" | "cancelled") => ({ id: status, date: "2026-09-30", time: "11:00 AM", mode: "Call", notes: "", status });
    const [a] = buildAccounts([makeLead({ meetings: [m("scheduled"), m("done"), m("cancelled")] })]);
    expect(a.openMeetings).toBe(1);
  });
});

describe("G. Filters", () => {
  const leads = [
    makeLead({ id: "L003", city: "Bandra", account: "Third Aisle" }),
    makeLead({ account: "Studio Weft", assignee: null }),
    makeLead({ priorityAuto: "Low", priorityOverride: "Hot", account: "Luma Home" }),
  ];

  it("G1 search ignores case across city, ID and account", () => {
    expect(filterLeads(leads, { ...EMPTY_FILTERS, search: "bandra" })).toHaveLength(1);
    expect(filterLeads(leads, { ...EMPTY_FILTERS, search: "l003" })).toHaveLength(1);
    expect(filterLeads(leads, { ...EMPTY_FILTERS, search: "STUDIO" })).toHaveLength(1);
  });

  it("G2 unassigned filter", () => {
    expect(filterLeads(leads, { ...EMPTY_FILTERS, assignee: "__unassigned" }).map((l) => l.account)).toEqual(["Studio Weft"]);
  });

  it("G3 priority filter respects overrides", () => {
    expect(filterLeads(leads, { ...EMPTY_FILTERS, priority: "Hot" }).map((l) => l.account)).toEqual(["Luma Home"]);
  });

  it("G4 follow-up date filters", () => {
    const fu = ["2026-09-20", "2026-09-23", "2026-09-27", "2026-10-15", "2026-11-30"].map((d) => makeLead({ nextFollowup: d }));
    const dates = (preset: typeof EMPTY_FU_DATE_FILTER.preset, from: string | null = null, to: string | null = null) =>
      applyFuDateFilter(fu, { preset, from, to }).map((l) => l.nextFollowup);
    expect(dates("overdue")).toEqual(["2026-09-20"]);
    expect(dates("today")).toEqual(["2026-09-23"]);
    expect(dates("week")).toEqual(["2026-09-23", "2026-09-27"]);
    expect(dates("30d")).toEqual(["2026-09-23", "2026-09-27", "2026-10-15"]);
    expect(dates("custom", "2026-10-01", "2026-12-01")).toEqual(["2026-10-15", "2026-11-30"]);
  });
});

const row = (p: Record<string, unknown> = {}) => ({
  "Contact name": "Ananya Sharma",
  "Job title": "Marketing Head",
  "Account name": "Brand New Co",
  "Account type": "Brand",
  Email: "ananya@brandnew.com",
  ...p,
});

describe("H. Spreadsheet import", () => {
  const existing = [makeLead({ account: "Studio Weft", email: "taken@studioweft.com" })];

  it("H1 a valid row is ready", () => {
    expect(stageImport([row()], "leads.xlsx", existing).rows).toHaveLength(1);
  });

  it("H2 missing job title is rejected with the sheet row number", () => {
    const s = stageImport([row({ "Job title": "" })], "leads.xlsx", existing);
    expect(s.rejected).toBe(1);
    expect(s.issues[0]).toMatch(/^Row 2: missing Job title/);
  });

  it("H3 type case is forgiven; unknown types are rejected", () => {
    expect(stageImport([row({ "Account type": "brand" })], "x", existing).rows[0].type).toBe("Brand");
    expect(stageImport([row({ "Account type": "Retail" })], "x", existing).rejected).toBe(1);
  });

  it("H4 email already in the CRM is a duplicate", () => {
    expect(stageImport([row({ Email: "taken@studioweft.com" })], "x", existing).duplicates).toBe(1);
  });

  it("H5 the same email twice in one sheet", () => {
    const s = stageImport([row(), row({ "Contact name": "Someone Else" })], "x", existing);
    expect(s.rows).toHaveLength(1);
    expect(s.duplicates).toBe(1);
  });

  it("H6 messy header spacing and case", () => {
    const r = { "  contact NAME ": "Ananya", "JOB TITLE": "Owner", "account name": "X Co", "Account Type": "Store" };
    expect(stageImport([r], "x", existing).rows).toHaveLength(1);
  });

  it("H7 new-account count", () => {
    const s = stageImport(
      [row(), row({ Email: "b@brandnew.com" }), row({ "Account name": "Studio Weft", Email: "c@studioweft.com" })],
      "x",
      existing
    );
    expect(s.newAccounts).toBe(1);
  });

  it("H8 duplicate email check ignores case", () => {
    expect(stageImport([row({ Email: "TAKEN@StudioWeft.com" })], "x", existing).duplicates).toBe(1);
  });

  it("H9 numeric phone becomes text", () => {
    expect(stageImport([row({ Phone: 9812345678 })], "x", existing).rows[0].phone).toBe("9812345678");
  });

  it("H10 reads a real .xlsx file", async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Contact name", "Job title", "Account name", "Account type"],
      ["Ananya Sharma", "Founder", "Brand New Co", "Brand"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    const buf: ArrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const rows = await readSheet({ arrayBuffer: async () => buf } as File);
    expect(rows).toEqual([{ "Contact name": "Ananya Sharma", "Job title": "Founder", "Account name": "Brand New Co", "Account type": "Brand" }]);
  });
});
