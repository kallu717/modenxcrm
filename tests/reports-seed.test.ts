import { describe, expect, it } from "vitest";
import { computeRepStats, computeFunnel, computeStageAging } from "../lib/reports";
import { generateSeed } from "../lib/seed";
import type { Stage } from "../lib/types";
import { makeLead } from "./helpers";

const range = { from: "2026-09-17", to: "2026-09-23" };
const hist = (...steps: [Stage, string][]) => steps.map(([stage, date]) => ({ stage, date }));

describe("P. Reports", () => {
  it("P1 only first contacts inside the range count as calls", () => {
    const leads = [
      makeLead({ stageHistory: hist(["new", "2026-09-01"], ["contacted", "2026-09-20"]) }),
      makeLead({ stageHistory: hist(["new", "2026-07-01"], ["contacted", "2026-08-01"]) }),
    ];
    expect(computeRepStats(leads, "priya", range).calls).toBe(1);
  });

  it("P2 a lead contacted twice counts once", () => {
    const leads = [
      makeLead({
        stageHistory: hist(["new", "2026-09-01"], ["contacted", "2026-09-18"], ["new", "2026-09-19"], ["contacted", "2026-09-21"]),
      }),
    ];
    expect(computeRepStats(leads, "priya", range).calls).toBe(1);
  });

  it("P3 onboardings are per rep", () => {
    const leads = [
      makeLead({ assignee: "priya", wonAt: "2026-09-20" }),
      makeLead({ assignee: "arjun", wonAt: "2026-09-20" }),
      makeLead({ assignee: "priya", wonAt: "2026-08-01" }),
    ];
    expect(computeRepStats(leads, "priya", range).onboardings).toBe(1);
  });

  it("P4 another rep's messages aren't counted", () => {
    const leads = [
      makeLead({ activity: [{ who: "Arjun Mehta", txt: "hi", t: "", date: "2026-09-20", method: "WhatsApp" }] }),
    ];
    expect(computeRepStats(leads, "priya", range).whatsapp).toBe(0);
  });

  it("P5 funnel counts and conversion", () => {
    const c = (...s: Stage[]) => makeLead({ createdAt: "2026-09-18", stageHistory: s.map((stage) => ({ stage, date: "2026-09-18" })) });
    const rows = computeFunnel(
      [c("new"), c("new", "contacted"), c("new", "contacted", "qualified"), c("new", "contacted", "qualified", "proposal", "won")],
      { ...range, days: 7 }
    );
    expect(rows.map((r) => r.count)).toEqual([4, 3, 2, 1, 1]);
    expect(rows.map((r) => r.convPct)).toEqual([null, 75, 67, 50, 100]);
  });

  it("P6 an empty funnel is all zeros, no errors", () => {
    const rows = computeFunnel([], { ...range, days: 7 });
    expect(rows.map((r) => r.count)).toEqual([0, 0, 0, 0, 0]);
    expect(rows.every((r) => Number.isFinite(r.pct))).toBe(true);
  });

  it("P7 time in stage", () => {
    const leads = [
      makeLead({ stage: "contacted", stageHistory: hist(["new", "2026-09-01"], ["contacted", "2026-09-13"]) }),
      makeLead({ stage: "contacted", stageHistory: hist(["new", "2026-08-01"], ["contacted", "2026-09-03"]) }),
    ];
    const row = computeStageAging(leads).find((r) => r.stage.id === "contacted")!;
    expect(row).toMatchObject({ count: 2, avg: 15, max: 20 });
  });
});

describe("R. Demo data", () => {
  const seed = generateSeed();

  it("R1 118 leads", () => {
    expect(seed.leads).toHaveLength(118);
  });

  it("R2 every account has at most one owner", () => {
    const owners = new Map<string, Set<string | null>>();
    seed.leads.forEach((l) => owners.set(l.account, (owners.get(l.account) || new Set()).add(l.assignee)));
    for (const [account, set] of owners) expect(set.size, account).toBe(1);
  });

  it("R3 anything past New has an owner", () => {
    expect(seed.leads.filter((l) => l.stage !== "new" && !l.assignee)).toHaveLength(0);
  });

  it("R4 generating twice gives identical data", () => {
    expect(generateSeed()).toEqual(seed);
  });
});
