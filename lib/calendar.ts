import { isoPlusDays, isoToday, daysBetweenInclusive } from "./dates";
import type { CompanyHoliday, RepLeave, RangePreset, DateRange, WorkingRange } from "./types";

// Weekends + company holidays apply to everyone; leave is per rep. Revenue/
// billing never uses this — mandates debit on their calendar date regardless
// of whether that's a Sunday or someone's day off.

export const RANGE_PRESETS: RangePreset[] = [
  { id: "today", label: "Today", days: 1 },
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "quarter", label: "Quarterly", days: 90 },
  { id: "half", label: "Half-yearly", days: 182 },
  { id: "year", label: "Yearly", days: 365 },
  { id: "custom", label: "Custom range", days: null },
];

export function isWeekend(iso: string): boolean {
  const dow = new Date(iso + "T00:00:00").getDay();
  return dow === 0 || dow === 6;
}

export function isCompanyHoliday(iso: string, holidays: CompanyHoliday[]): boolean {
  return holidays.some((h) => h.date === iso);
}

export function repLeaveOn(
  repId: string,
  iso: string,
  leaves: RepLeave[]
): RepLeave | null {
  return leaves.find((l) => l.repId === repId && l.date === iso) || null;
}

export function isWorkingDay(
  iso: string,
  repId: string | null,
  holidays: CompanyHoliday[],
  leaves: RepLeave[]
): boolean {
  if (isWeekend(iso)) return false;
  if (isCompanyHoliday(iso, holidays)) return false;
  if (repId && repLeaveOn(repId, iso, leaves)) return false;
  return true;
}

export function nonWorkingReason(
  iso: string,
  repId: string | null,
  holidays: CompanyHoliday[],
  leaves: RepLeave[]
): string | null {
  if (isWeekend(iso)) return "Weekend";
  const h = holidays.find((x) => x.date === iso);
  if (h) return h.name;
  const l = repId && repLeaveOn(repId, iso, leaves);
  if (l) return l.reason || "Leave";
  return null;
}

// Walks backward from `end` counting only working days for this rep, until
// `n` are found. Returns the resulting span — this is what "last N days"
// actually means once weekends/holidays/leave are excluded.
export function lastNWorkingDays(
  repId: string | null,
  n: number,
  end: string | undefined,
  holidays: CompanyHoliday[],
  leaves: RepLeave[]
): { from: string; to: string; workingDays: number } {
  const endIso = end || isoToday();
  let cursor = endIso;
  let from = endIso;
  let count = 0;
  let guard = 0;
  while (count < n && guard < 1000) {
    if (isWorkingDay(cursor, repId, holidays, leaves)) {
      count++;
      from = cursor;
    }
    cursor = isoPlusDays(cursor, -1);
    guard++;
  }
  return { from, to: endIso, workingDays: count };
}

export function countWorkingDays(
  repId: string | null,
  from: string,
  to: string,
  holidays: CompanyHoliday[],
  leaves: RepLeave[]
): number {
  if (!from || !to) return 0;
  let n = 0;
  let cur = from;
  while (cur <= to) {
    if (isWorkingDay(cur, repId, holidays, leaves)) n++;
    cur = isoPlusDays(cur, 1);
  }
  return n;
}

export function rangeForPreset(
  preset: string,
  customFrom: string | null,
  customTo: string | null
): DateRange {
  const today = isoToday();
  if (preset === "custom") {
    const to = customTo || today;
    const from = customFrom || null;
    return {
      from,
      to,
      days: from ? Math.max(1, daysBetweenInclusive(from, to)) : null,
    };
  }
  const p = RANGE_PRESETS.find((r) => r.id === preset) || RANGE_PRESETS[1];
  return { from: isoPlusDays(today, -(p.days! - 1)), to: today, days: p.days };
}

// The Targets table's own range: "last 7 days" becomes that rep's last 7
// WORKING days, a different calendar span per rep since leave differs. A
// custom range is the manager's explicit dates, so it's used as-is — only
// the working-day count within it changes per rep.
export function workingRangeForRep(
  repId: string | null,
  preset: string,
  customFrom: string | null,
  customTo: string | null,
  holidays: CompanyHoliday[],
  leaves: RepLeave[]
): WorkingRange {
  if (preset === "custom") {
    const r = rangeForPreset(preset, customFrom, customTo);
    return {
      ...r,
      workingDays: r.from ? countWorkingDays(repId, r.from, r.to, holidays, leaves) : null,
    };
  }
  const p = RANGE_PRESETS.find((x) => x.id === preset);
  if (!p || p.days == null) return { from: null, to: isoToday(), workingDays: null };
  const { from, to, workingDays } = lastNWorkingDays(repId, p.days, isoToday(), holidays, leaves);
  return { from, to, workingDays };
}
