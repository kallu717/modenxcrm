import { describe, expect, it } from "vitest";
import {
  fmtInr, nextBillingDate, billedMonthsInQuarter, quarterRevenue, recentQuarters, duePayments,
  needsRevenueDetails, accountAgingDays, agingBucket,
} from "../lib/revenue";
import { buildAccounts } from "../lib/accounts";
import { makeLead, at } from "./helpers";

const won = (mandateDate: string, plan = "growth") => ({ stage: "won", plan, mandateDate });

describe("D. Subscription billing", () => {
  it("D1 Indian digit grouping", () => {
    expect(fmtInr(106000)).toBe("₹1,06,000");
  });

  it("D2 a 31st mandate debits on 28 Feb", () => {
    at("2026-02-10T10:00:00+05:30");
    expect(nextBillingDate(won("2026-01-31"))).toBe("2026-02-28");
  });

  it("D3 mandate on the 15th, today the 16th → next month", () => {
    at("2026-09-16T10:00:00+05:30");
    expect(nextBillingDate(won("2026-06-15"))).toBe("2026-10-15");
  });

  it("D4 December rolls into January of next year", () => {
    at("2026-12-20T10:00:00+05:30");
    expect(nextBillingDate(won("2025-03-05"))).toBe("2027-01-05");
  });

  it("D5 a future mandate's first debit is the mandate date", () => {
    expect(nextBillingDate(won("2026-10-03"))).toBe("2026-10-03");
  });

  it("D6 not Won, or Won with no plan → no billing date", () => {
    expect(nextBillingDate({ stage: "proposal", plan: "growth", mandateDate: "2026-08-01" })).toBeNull();
    expect(nextBillingDate({ stage: "won", plan: null, mandateDate: "2026-08-01" })).toBeNull();
  });

  it("D7 current quarter counts only months already billed", () => {
    expect(billedMonthsInQuarter("2026-08-14", 2026, 3)).toBe(2);
  });

  it("D8 future quarter bills nothing yet", () => {
    expect(billedMonthsInQuarter("2026-08-14", 2026, 4)).toBe(0);
  });

  it("D9 a fully past quarter bills all 3 months", () => {
    expect(billedMonthsInQuarter("2026-01-10", 2026, 2)).toBe(3);
  });

  it("D10 quarter revenue", () => {
    const leads = [
      makeLead({ stage: "won", plan: "growth", mandateDate: "2026-08-14" }),
      makeLead({ stage: "won", plan: "starter", mandateDate: "2026-01-01" }),
    ];
    expect(quarterRevenue(leads, 2026, 3)).toBe(9000);
  });

  it("D11 six recent quarters cross the year boundary", () => {
    const q = recentQuarters(6);
    expect(q[0]).toEqual({ y: 2025, q: 2 });
    expect(q[5]).toEqual({ y: 2026, q: 3 });
  });

  it("D12–D15 payments-due window and reminders", () => {
    const soon = makeLead({ stage: "won", plan: "growth", mandateDate: "2026-08-26" }); // due 26 Sep
    const later = makeLead({ stage: "won", plan: "growth", mandateDate: "2026-08-01" }); // due 1 Oct (8 days)
    const due = duePayments([soon, later], {});
    expect(due.map((d) => d.lead.id)).toEqual([soon.id]); // D12 + D15
    expect(duePayments([soon], { [soon.id]: "2026-09-26" })).toHaveLength(0); // D13
    at("2026-10-23T10:00:00+05:30");
    expect(duePayments([soon], { [soon.id]: "2026-09-26" })).toHaveLength(1); // D14
  });

  it("D16 Won without a plan needs revenue details", () => {
    expect(needsRevenueDetails({ stage: "won", plan: null })).toBe(true);
    expect(needsRevenueDetails({ stage: "won", plan: "starter" })).toBe(false);
  });
});

describe("E. Account aging", () => {
  const atQualified = (ownerSince: string) =>
    makeLead({
      stage: "qualified",
      stageHistory: [{ stage: "new", date: "2026-06-01" }, { stage: "qualified", date: "2026-08-14" }],
      ownerSince,
    });

  it("E1 aging counts from the last forward move", () => {
    expect(accountAgingDays("qualified", [atQualified("2026-06-15")])).toBe(40);
  });

  it("E2 a recent reassignment restarts the clock", () => {
    expect(accountAgingDays("qualified", [atQualified("2026-09-18")])).toBe(5);
  });

  it("E3 aging buckets", () => {
    expect([29, 30, 59, 60, 89, 90].map((d) => agingBucket(d)?.cls)).toEqual([
      "ok", "caution", "caution", "warn", "warn", "crit",
    ]);
  });

  it("E4 a Won account shows no aging", () => {
    const [acct] = buildAccounts([makeLead({ stage: "won", stageHistory: [{ stage: "won", date: "2026-01-01" }] })]);
    expect(acct.agingDays).toBeNull();
  });
});
