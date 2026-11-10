import { isoToday, isoPlusDays } from "./dates";
import type { Plan, Lead, PaymentRecord } from "./types";

// A won deal is billed monthly at its plan rate through an auto-debit
// mandate, so revenue accrues per month rather than landing once.
export const PLANS: Plan[] = [
  { id: "starter", name: "Starter", mrr: 1000 },
  { id: "growth", name: "Growth", mrr: 3000 },
  { id: "professional", name: "Professional", mrr: 7500 },
];

export function fmtInr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function planById(id: string | null): Plan | null {
  return PLANS.find((p) => p.id === id) || null;
}

export function leadMrr(l: { plan: string | null }): number {
  const p = planById(l.plan);
  return p ? p.mrr : 0;
}

export function needsRevenueDetails(l: { stage: string; plan: string | null }): boolean {
  return l.stage === "won" && !l.plan;
}

// The mandate debits on the same day each month. Returns the next debit date
// on or after today, clamped for short months (a 31st mandate bills on the
// 30th in April, the 28th in February).
export const PAYMENT_WINDOW_DAYS = 7;
export function nextBillingDate(l: {
  stage: string;
  plan: string | null;
  mandateDate: string | null;
}): string | null {
  if (l.stage !== "won" || !l.plan || !l.mandateDate) return null;
  const start = new Date(l.mandateDate + "T00:00:00");
  const day = start.getDate();
  const today = new Date(isoToday() + "T00:00:00");
  const onDay = (y: number, m: number) =>
    new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
  let cand = onDay(today.getFullYear(), today.getMonth());
  if (cand < today) {
    const m = today.getMonth() + 1;
    cand = onDay(today.getFullYear() + (m > 11 ? 1 : 0), m % 12);
  }
  const isoOfCand =
    cand.getFullYear() +
    "-" +
    String(cand.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(cand.getDate()).padStart(2, "0");
  return cand < start ? l.mandateDate : isoOfCand;
}

// How far back an unpaid debit stays on the list. Older ones are taken to be
// settled outside the CRM (auto-debit mandates usually just go through).
export const PAYMENT_LOOKBACK_DAYS = 30;

const pad = (n: number) => String(n).padStart(2, "0");

// Every monthly debit date of a won deal between two dates (inclusive), on
// or after the mandate start, clamped for short months.
export function billingDatesBetween(
  l: { stage: string; plan: string | null; mandateDate: string | null },
  fromIso: string,
  toIso: string
): string[] {
  if (l.stage !== "won" || !l.plan || !l.mandateDate) return [];
  const day = Number(l.mandateDate.slice(8, 10));
  let y = Number(fromIso.slice(0, 4));
  let m = Number(fromIso.slice(5, 7)) - 1;
  const out: string[] = [];
  for (let i = 0; i < 24; i++) {
    const last = new Date(y, m + 1, 0).getDate();
    const iso = `${y}-${pad(m + 1)}-${pad(Math.min(day, last))}`;
    if (iso > toIso) break;
    if (iso >= fromIso && iso >= l.mandateDate) out.push(iso);
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}

export function paymentId(leadId: string, billingDate: string): string {
  return `${leadId}@${billingDate}`;
}

export interface DuePayment {
  id: string;
  lead: Lead;
  date: string;
  status: "overdue" | "today" | "upcoming";
  reminded: boolean; // a reminder was logged for this debit
}

// Debits due in the next 7 days, plus any from the last 30 days nobody has
// marked paid. Marking one paid takes it off; logging a reminder doesn't.
export function duePayments(
  leads: Lead[],
  payments: Record<string, PaymentRecord>,
  paymentReminders: Record<string, string> = {}
): DuePayment[] {
  const today = isoToday();
  const from = isoPlusDays(today, -PAYMENT_LOOKBACK_DAYS);
  const to = isoPlusDays(today, PAYMENT_WINDOW_DAYS);
  const out: DuePayment[] = [];
  for (const lead of leads) {
    for (const date of billingDatesBetween(lead, from, to)) {
      const id = paymentId(lead.id, date);
      if (payments[id]) continue;
      const status = date < today ? "overdue" : date === today ? "today" : "upcoming";
      out.push({ id, lead, date, status, reminded: paymentReminders[lead.id] === date });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : leadMrr(b.lead) - leadMrr(a.lead)));
}

// Money marked as received with a debit date in this calendar month.
export function collectedThisMonth(payments: Record<string, PaymentRecord>): number {
  const month = isoToday().slice(0, 7);
  return Object.values(payments)
    .filter((p) => p.billingDate.startsWith(month))
    .reduce((sum, p) => sum + (p.amount || 0), 0);
}

// What won deals bill this calendar month, paid or not.
export function billedThisMonth(leads: Lead[]): number {
  const today = isoToday();
  const first = today.slice(0, 8) + "01";
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const last = `${today.slice(0, 8)}${pad(new Date(y, m, 0).getDate())}`;
  return leads.reduce((sum, l) => sum + leadMrr(l) * billingDatesBetween(l, first, last).length, 0);
}

export const Q_MONTHS: [string, string][] = [
  ["Jan", "Mar"],
  ["Apr", "Jun"],
  ["Jul", "Sep"],
  ["Oct", "Dec"],
];

export function monthIndex(y: number, m: number): number {
  return y * 12 + m;
}

export function currentQuarter(): { y: number; q: number } {
  const d = new Date();
  return { y: d.getFullYear(), q: Math.floor(d.getMonth() / 3) + 1 };
}

export function quarterKey(y: number, q: number): string {
  return y + "-Q" + q;
}

export function quarterLabel(y: number, q: number): string {
  return `Q${q} ${y}`;
}

export function quarterRangeLabel(y: number, q: number): string {
  return `${Q_MONTHS[q - 1][0]}–${Q_MONTHS[q - 1][1]} ${y}`;
}

export function recentQuarters(count: number): { y: number; q: number }[] {
  const out: { y: number; q: number }[] = [];
  let { y, q } = currentQuarter();
  for (let i = 0; i < count; i++) {
    out.unshift({ y, q });
    q--;
    if (q === 0) {
      q = 4;
      y--;
    }
  }
  return out;
}

// Months of a quarter a mandate was actually billing — never counts months in
// the future, so the current quarter reads as revenue billed so far.
export function billedMonthsInQuarter(mandateIso: string | null, y: number, q: number): number {
  if (!mandateIso) return 0;
  const md = new Date(mandateIso + "T00:00:00");
  const startIdx = monthIndex(md.getFullYear(), md.getMonth());
  const now = new Date();
  const nowIdx = monthIndex(now.getFullYear(), now.getMonth());
  const firstMonth = (q - 1) * 3;
  let months = 0;
  for (let i = 0; i < 3; i++) {
    const idx = monthIndex(y, firstMonth + i);
    if (idx >= startIdx && idx <= nowIdx) months++;
  }
  return months;
}

export function quarterRevenue(list: Lead[], y: number, q: number): number {
  return list.reduce((sum, l) => sum + leadMrr(l) * billedMonthsInQuarter(l.mandateDate, y, q), 0);
}

// ---------- account aging ----------
// Days since the account last made forward progress: the most recent date
// any contact currently sitting at the account's furthest stage arrived
// there. If nothing's moved in a long time, this grows — that's the signal
// an account is stuck, regardless of which individual contact is "behind."
// A reassignment resets this — a rep who just picked up the account hasn't
// had a chance to move it yet, so the clock restarts from ownerSince rather
// than blaming them for stage history that predates them.
export function accountAgingDays(
  furthestStageId: string,
  contacts: Lead[]
): number | null {
  const atFurthest = contacts.filter((c) => c.stage === furthestStageId);
  if (!atFurthest.length) return null;
  const mostRecentStage = atFurthest
    .map((c) => c.stageHistory[c.stageHistory.length - 1].date)
    .sort()
    .slice(-1)[0];
  const ownerSince = contacts.find((c) => c.ownerSince)?.ownerSince || null;
  const start = ownerSince && ownerSince > mostRecentStage ? ownerSince : mostRecentStage;
  return Math.round(
    (new Date(isoToday() + "T00:00:00").getTime() - new Date(start + "T00:00:00").getTime()) /
      86400000
  );
}

export const AGING_MAX_DAYS = 90; // 3 months — past this, an account should be reassigned

export function agingBucket(days: number | null): { label: string; cls: string } | null {
  if (days == null) return null;
  if (days >= AGING_MAX_DAYS) return { label: "90+ days", cls: "crit" };
  if (days >= 60) return { label: "60–89 days", cls: "warn" };
  if (days >= 30) return { label: "30–59 days", cls: "caution" };
  return { label: "0–29 days", cls: "ok" };
}
