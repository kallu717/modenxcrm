import { describe, expect, it } from "vitest";
import {
  isoToday, isoPlusDays, daysUntil, fmtFollowup, followupBucket, nextWeekday, to12h, inRange,
} from "../lib/dates";
import { at } from "./helpers";

describe("A. Dates (India timezone)", () => {
  it("runs in IST", () => {
    expect(new Date().getTimezoneOffset()).toBe(-330);
  });

  it("A1 00:30 IST is still today in India, even though it's yesterday in UTC", () => {
    at("2026-09-23T00:30:00+05:30");
    expect(isoToday()).toBe("2026-09-23");
  });

  it("A2 23:50 IST is still the same day", () => {
    at("2026-09-23T23:50:00+05:30");
    expect(isoToday()).toBe("2026-09-23");
  });

  it("A3 adding days across month end and a leap day", () => {
    expect(isoPlusDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(isoPlusDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("A4 days until today / tomorrow / 3 days ago", () => {
    expect(daysUntil("2026-09-23")).toBe(0);
    expect(daysUntil("2026-09-24")).toBe(1);
    expect(daysUntil("2026-09-20")).toBe(-3);
  });

  it("A5 follow-up labels", () => {
    expect(fmtFollowup("2026-09-23")).toMatch(/^Today · /);
    expect(fmtFollowup("2026-09-24")).toMatch(/^Tomorrow · /);
    expect(fmtFollowup("2026-09-22")).toMatch(/^Yesterday · /);
    expect(fmtFollowup("2026-09-20")).toMatch(/^3d overdue · /);
  });

  it("A6 follow-up buckets", () => {
    expect(followupBucket("2026-09-01")).toBe("overdue");
    expect(followupBucket("2026-09-23")).toBe("today");
    expect(followupBucket("2026-10-01")).toBe("upcoming");
    expect(followupBucket(null)).toBeNull();
  });

  it("A7 'This Fri' on a Friday and on a Saturday", () => {
    at("2026-09-25T10:00:00+05:30");
    expect(nextWeekday(5)).toBe("2026-09-25");
    at("2026-09-26T10:00:00+05:30");
    expect(nextWeekday(5)).toBe("2026-10-02");
  });

  it("A8 12-hour meeting times", () => {
    expect(to12h("00:30")).toBe("12:30 AM");
    expect(to12h("12:00")).toBe("12:00 PM");
    expect(to12h("15:05")).toBe("3:05 PM");
  });

  it("A9 open-ended ranges", () => {
    expect(inRange("2026-09-10", "2026-09-01", null)).toBe(true);
    expect(inRange("2026-08-10", "2026-09-01", null)).toBe(false);
    expect(inRange("2026-09-10", null, "2026-09-05")).toBe(false);
    expect(inRange("2026-09-10", null, null)).toBe(true);
    expect(inRange(null, null, null)).toBe(false);
  });
});
