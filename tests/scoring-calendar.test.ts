import { describe, expect, it } from "vitest";
import { scoreLead, bandForScore } from "../lib/scoring";
import {
  isWeekend, lastNWorkingDays, countWorkingDays, workingRangeForRep, rangeForPreset, nonWorkingReason,
} from "../lib/calendar";
import type { CompanyHoliday, RepLeave } from "../lib/types";
import { makeLead, resetStore, store, leadById } from "./helpers";

describe("B. Priority scoring", () => {
  it("B1 Bengaluru Leasing Head, verified, multi-source → 42 Hot", () => {
    const r = scoreLead({ title: "Leasing Head", emailQuality: "verified", city: "Bengaluru", multiSource: true });
    expect(r.score).toBe(42);
    expect(bandForScore(r.score)).toBe("Hot");
  });

  it("B2 Mumbai Store Manager, no email → 5 Low", () => {
    const r = scoreLead({ title: "Store Manager", emailQuality: "none", city: "Mumbai", multiSource: false });
    expect(r.score).toBe(5);
    expect(bandForScore(r.score)).toBe("Low");
  });

  it("B3 Chennai Category Manager, catch-all → 14 Nurture", () => {
    const r = scoreLead({ title: "Category Manager", emailQuality: "catchall", city: "Chennai", multiSource: false });
    expect(r.score).toBe(14);
    expect(bandForScore(r.score)).toBe("Nurture");
  });

  it("B4 unknown job title defaults to +5", () => {
    const r = scoreLead({ title: "Intern", emailQuality: "none", city: "Pune", multiSource: false });
    expect(r.score).toBe(5);
    expect(r.reasons[0]).toBe("Intern (+5)");
  });

  it("B5 band edges", () => {
    expect([30, 29, 20, 19, 12, 11].map(bandForScore)).toEqual(["Hot", "Warm", "Warm", "Nurture", "Nurture", "Low"]);
  });

  it("B6 'bengaluru' and 'Bangalore' still count as the flagship city", () => {
    for (const city of ["bengaluru", "Bangalore", " Bengaluru "]) {
      const r = scoreLead({ title: "Founder", emailQuality: "none", city, multiSource: false });
      expect(r.score, city).toBe(25);
    }
  });

  it("B7 override, then picking the auto band clears it", () => {
    const l = makeLead({ priorityAuto: "Nurture" });
    resetStore([l]);
    store().setPriority(l.id, "Hot");
    expect(leadById(l.id).priorityOverride).toBe("Hot");
    store().setPriority(l.id, "Nurture");
    expect(leadById(l.id).priorityOverride).toBeNull();
  });
});

const noHolidays: CompanyHoliday[] = [];
const noLeave: RepLeave[] = [];

describe("C. Working days", () => {
  it("C1 weekends", () => {
    expect(isWeekend("2026-09-19")).toBe(true);
    expect(isWeekend("2026-09-20")).toBe(true);
    expect(isWeekend("2026-09-21")).toBe(false);
  });

  it("C2 last 7 working days ending Wed 23 Sep", () => {
    expect(lastNWorkingDays("priya", 7, "2026-09-23", noHolidays, noLeave).from).toBe("2026-09-15");
  });

  it("C3 a holiday inside the span pushes the start back a day", () => {
    const hol = [{ date: "2026-09-18", name: "Test holiday" }];
    expect(lastNWorkingDays("priya", 7, "2026-09-23", hol, noLeave).from).toBe("2026-09-14");
  });

  it("C4 leave only affects that rep", () => {
    const leave = [{ id: "LV1", repId: "priya", date: "2026-09-21", reason: "Sick leave" }];
    expect(lastNWorkingDays("priya", 7, "2026-09-23", noHolidays, leave).from).toBe("2026-09-14");
    expect(lastNWorkingDays("arjun", 7, "2026-09-23", noHolidays, leave).from).toBe("2026-09-15");
  });

  it("C5 custom range counts only true working days", () => {
    const hol = [{ date: "2026-09-16", name: "Holiday" }];
    const leave = [{ id: "LV1", repId: "priya", date: "2026-09-17", reason: "Leave" }];
    expect(countWorkingDays("priya", "2026-09-14", "2026-09-20", hol, leave)).toBe(3);
    expect(countWorkingDays("arjun", "2026-09-14", "2026-09-20", hol, leave)).toBe(4);
  });

  it("C6 custom range without a start date", () => {
    expect(workingRangeForRep("priya", "custom", null, null, noHolidays, noLeave).workingDays).toBeNull();
  });

  it("C7 last 7 calendar days", () => {
    expect(rangeForPreset("7d", null, null)).toEqual({ from: "2026-09-17", to: "2026-09-23", days: 7 });
  });

  it("C8 a Sunday holiday is reported as Weekend", () => {
    expect(nonWorkingReason("2026-09-20", "priya", [{ date: "2026-09-20", name: "Festival" }], noLeave)).toBe("Weekend");
  });
});
