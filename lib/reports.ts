import { inRange, isoToday } from "./dates";
import { STAGES, repById } from "./constants";
import { isClosedStage } from "./scoring";
import type { DateRange, Lead, Stage } from "./types";

function firstContactedDate(l: Lead): string | null {
  const h = l.stageHistory.find((x) => x.stage === "contacted");
  return h ? h.date : null;
}

export interface RepStats {
  stageSnapshot: Record<string, number>;
  stageEntered: Record<string, number>;
  calls: number;
  whatsapp: number;
  email: number;
  na: number;
  onboardings: number;
}

// Call targets are set per DAY and scaled to whatever range the manager picks.
export function computeRepStats(
  leads: Lead[],
  repId: string,
  range: { from: string | null; to: string | null }
): RepStats {
  const { from, to } = range;
  const repName = repById(repId)?.name || "";
  const ownedNow = leads.filter((l) => l.assignee === repId);

  const stageSnapshot: Record<string, number> = {};
  STAGES.forEach((s) => (stageSnapshot[s.id] = 0));
  ownedNow.forEach((l) => stageSnapshot[l.stage]++);

  const stageEntered: Record<string, number> = {};
  STAGES.forEach((s) => (stageEntered[s.id] = 0));
  leads.forEach((l) => {
    if (l.assignee !== repId) return;
    l.stageHistory.forEach((h) => {
      if (inRange(h.date, from, to)) stageEntered[h.stage]++;
    });
  });

  // "Calls made" = leads this rep moved from New to Contacted for the first
  // time (the pipeline event that stands in for "we called them"), not a
  // note-log count.
  const calls = ownedNow.filter((l) => {
    const d = firstContactedDate(l);
    return d && inRange(d, from, to);
  }).length;

  let whatsapp = 0;
  let email = 0;
  let na = 0;
  leads.forEach((l) => {
    l.activity.forEach((a) => {
      if (!a.method || a.who !== repName) return;
      if (!inRange(a.date, from, to)) return;
      if (a.method === "WhatsApp") whatsapp++;
      else if (a.method === "Email") email++;
      else if (a.method === "NA") na++;
    });
  });

  const onboardings = leads.filter(
    (l) => l.assignee === repId && l.wonAt && inRange(l.wonAt, from, to)
  ).length;

  return { stageSnapshot, stageEntered, calls, whatsapp, email, na, onboardings };
}

export const FUNNEL_STAGE_IDS: Stage[] = ["new", "contacted", "qualified", "proposal", "won"];

export interface FunnelRow {
  stage: (typeof STAGES)[number];
  count: number;
  pct: number;
  convPct: number | null;
}

// Cohort = assigned leads CREATED in the range. Each is checked for whether
// it ever reached a given stage — avoids comparing "entered stage" counts
// that belong to different, non-overlapping cohorts across a narrow window.
export function computeFunnel(leads: Lead[], range: DateRange): FunnelRow[] {
  const { from, to } = range;
  const cohort = leads.filter((l) => l.assignee && inRange(l.createdAt, from, to));
  const counts: Record<string, number> = {};
  FUNNEL_STAGE_IDS.forEach((id) => {
    counts[id] = cohort.filter((l) => l.stageHistory.some((h) => h.stage === id)).length;
  });
  const maxCount = Math.max(1, counts.new);
  return FUNNEL_STAGE_IDS.map((id, i) => {
    const stage = STAGES.find((s) => s.id === id)!;
    const prev = i > 0 ? counts[FUNNEL_STAGE_IDS[i - 1]] : null;
    return {
      stage,
      count: counts[id],
      pct: Math.round((counts[id] / maxCount) * 100),
      convPct: prev != null ? (prev > 0 ? Math.round((counts[id] / prev) * 100) : 0) : null,
    };
  });
}

export interface StageAgingRow {
  stage: (typeof STAGES)[number];
  count: number;
  avg: number;
  max: number;
}

export function computeStageAging(leads: Lead[]): StageAgingRow[] {
  const openStages = STAGES.filter((s) => !isClosedStage(s.id));
  const todayD = new Date(isoToday() + "T00:00:00");
  return openStages.map((s) => {
    const inStage = leads.filter((l) => l.assignee && l.stage === s.id);
    const days = inStage.map((l) => {
      const lastDate = l.stageHistory[l.stageHistory.length - 1].date;
      return Math.round((todayD.getTime() - new Date(lastDate + "T00:00:00").getTime()) / 86400000);
    });
    const avg = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
    const max = days.length ? Math.max(...days) : 0;
    return { stage: s, count: inStage.length, avg, max };
  });
}
