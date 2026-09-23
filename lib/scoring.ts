import type { EmailQuality, Priority } from "./types";

// Reuses the ModenX Lead Desk's documented inputs: function seniority, email
// verification, flagship-location presence, multi-source corroboration.
// Bands (Hot/Warm/Nurture/Low) are cutoffs we're proposing, since the source
// dashboard never published its exact thresholds.
export const FN_TIER: Record<string, number> = {
  Founder: 15,
  Owner: 15,
  "Centre Director": 15,
  "Leasing Head": 15,
  "Marketing Head": 15,
  "Category Manager": 10,
  "Retail Ops Head": 10,
  "Franchise Lead": 10,
  "Mall Marketing Manager": 10,
  "Operations Head": 10,
  "Store Manager": 5,
};

export interface ScoreInput {
  title: string;
  emailQuality: EmailQuality;
  city: string;
  multiSource: boolean;
}

export interface ScoreResult {
  score: number;
  reasons: string[];
}

export function scoreLead(l: ScoreInput): ScoreResult {
  const tier = FN_TIER[l.title] ?? 5;
  let score = tier;
  const reasons = [`${l.title} (+${tier})`];
  if (l.emailQuality === "verified") {
    score += 12;
    reasons.push("verified email (+12)");
  } else if (l.emailQuality === "catchall") {
    score += 4;
    reasons.push("catch-all email (+4)");
  }
  // Imported sheets spell the flagship city every which way.
  const city = l.city.trim().toLowerCase();
  if (city === "bengaluru" || city === "bangalore") {
    score += 10;
    reasons.push("flagship city (+10)");
  }
  if (l.multiSource) {
    score += 5;
    reasons.push("multi-source (+5)");
  }
  return { score, reasons };
}

export function bandForScore(score: number): Priority {
  if (score >= 30) return "Hot";
  if (score >= 20) return "Warm";
  if (score >= 12) return "Nurture";
  return "Low";
}

export function effectivePriority(l: {
  priorityOverride: Priority | null;
  priorityAuto: Priority;
}): Priority {
  return l.priorityOverride || l.priorityAuto;
}

export function isClosedStage(stage: string): boolean {
  return stage === "won" || stage === "lost" || stage === "unqualified";
}
