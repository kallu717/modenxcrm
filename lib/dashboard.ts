// What the Dashboard shows: today's work for the signed-in person, and for
// managers a picture of the team. Pure functions so they can be tested.

import { isoPlusDays, isoToday } from "./dates";
import { effectivePriority, isClosedStage } from "./scoring";
import { computeRepStats } from "./reports";
import { nonWorkingReason } from "./calendar";
import { buildAccounts } from "./accounts";
import type { ChangeRequest } from "./store";
import type { CompanyHoliday, Lead, LeaveRequest, Meeting, Rep, RepLeave } from "./types";

export const MEETING_WINDOW_DAYS = 7;
export const DEFAULT_CALLS_PER_DAY = 8; // the same default Reports uses
export const STUCK_DAYS = 60; // Reports' "stuck" filter
export const RECENT_DECISION_DAYS = 7;

const byDate = (a: Lead, b: Lead) => ((a.nextFollowup || "") < (b.nextFollowup || "") ? -1 : 1);

// Follow-ups that are late, and the ones for today. Closed deals don't count.
export function followupsDue(leads: Lead[]): { overdue: Lead[]; today: Lead[] } {
  const today = isoToday();
  const open = leads.filter((l) => l.nextFollowup && !isClosedStage(l.stage));
  return {
    overdue: open.filter((l) => l.nextFollowup! < today).sort(byDate),
    today: open.filter((l) => l.nextFollowup === today),
  };
}

export interface UpcomingMeeting {
  lead: Lead;
  meeting: Meeting;
}

// Scheduled meetings from today through the next 7 days, soonest first.
export function upcomingMeetings(leads: Lead[], days = MEETING_WINDOW_DAYS): UpcomingMeeting[] {
  const from = isoToday();
  const to = isoPlusDays(from, days);
  return leads
    .flatMap((lead) => lead.meetings.map((meeting) => ({ lead, meeting })))
    .filter(({ meeting }) => meeting.status === "scheduled" && meeting.date >= from && meeting.date <= to)
    .sort((a, b) =>
      a.meeting.date !== b.meeting.date
        ? a.meeting.date < b.meeting.date ? -1 : 1
        : (a.meeting.time || "") < (b.meeting.time || "") ? -1 : 1
    );
}

// Hot contacts nobody has planned a next step for: easy to forget.
export function hotWithoutNextStep(leads: Lead[]): Lead[] {
  return leads.filter(
    (l) => !isClosedStage(l.stage) && effectivePriority(l) === "Hot" && !l.nextFollowup
  );
}

// Contacts given to this person that nobody has reached yet, newest first.
export function notContactedYet(leads: Lead[]): Lead[] {
  return leads
    .filter((l) => l.stage === "new")
    .sort((a, b) => ((a.ownerSince || a.createdAt) > (b.ownerSince || b.createdAt) ? -1 : 1));
}

export function callsToday(
  leads: Lead[],
  repId: string,
  targets: Record<string, { callsPerDay: number }>
): { done: number; target: number } {
  const today = isoToday();
  return {
    done: computeRepStats(leads, repId, { from: today, to: today }).calls,
    target: targets[repId]?.callsPerDay ?? DEFAULT_CALLS_PER_DAY,
  };
}

export interface MyRequest {
  id: string;
  kind: "edit" | "leave";
  label: string;
  status: "pending" | "approved" | "rejected";
  date: string;
}

// This person's requests: everything still waiting, plus decisions from the
// last week so they see the answer.
export function myRequests(
  changeRequests: ChangeRequest[],
  leaveRequests: LeaveRequest[],
  leads: Lead[],
  userId: string
): MyRequest[] {
  const since = isoPlusDays(isoToday(), -RECENT_DECISION_DAYS);
  const recent = (r: { status: string; decidedAt?: string }) =>
    r.status === "pending" || (r.decidedAt || "").slice(0, 10) >= since;
  const edits: MyRequest[] = changeRequests
    .filter((c) => c.requestedBy === userId && recent(c))
    .map((c) => ({
      id: c.id,
      kind: "edit",
      label:
        c.scope === "account"
          ? `Change to ${c.accountName}`
          : `Change to ${leads.find((l) => l.id === c.leadId)?.name || "a contact"}`,
      status: c.status,
      date: (c.decidedAt || c.requestedAt).slice(0, 10),
    }));
  const leave: MyRequest[] = leaveRequests
    .filter((r) => r.repId === userId && recent(r))
    .map((r) => ({ id: r.id, kind: "leave", label: `Leave on ${r.date}`, status: r.status, date: r.date }));
  return [...edits, ...leave].sort((a, b) =>
    a.status === "pending" && b.status !== "pending" ? -1 : b.status === "pending" && a.status !== "pending" ? 1 : a.date < b.date ? 1 : -1
  );
}

// ---------------------------------------------------------------- managers

export function approvalsWaiting(changeRequests: ChangeRequest[], leaveRequests: LeaveRequest[]) {
  return {
    edits: changeRequests.filter((c) => c.status === "pending").length,
    leave: leaveRequests.filter((r) => r.status === "pending").length,
  };
}

export interface UnownedCity {
  account: string;
  city: string;
  cityKey: string;
  contacts: number;
}

// Cities (of an account) where no one owns the contacts, biggest first.
export function unownedCities(leads: Lead[]): UnownedCity[] {
  return buildAccounts(leads)
    .flatMap((a) =>
      a.locations
        .filter((l) => !l.owner)
        .map((l) => ({ account: a.name, city: l.city, cityKey: l.key, contacts: l.contacts.length }))
    )
    .sort((a, b) => b.contacts - a.contacts || a.account.localeCompare(b.account));
}

export interface StuckLocation {
  account: string;
  city: string | null; // null for one-city accounts
  owner: string | null;
  days: number;
}

// Same rule as Reports: a location that hasn't moved forward in 60+ days.
export function stuckLocations(leads: Lead[]): StuckLocation[] {
  return buildAccounts(leads)
    .flatMap((a) =>
      a.locations
        .filter((l) => (l.agingDays ?? 0) >= STUCK_DAYS)
        .map((l) => ({
          account: a.name,
          city: a.locations.length > 1 ? l.city : null,
          owner: l.owner,
          days: l.agingDays!,
        }))
    )
    .sort((a, b) => b.days - a.days);
}

export interface TeamRow {
  rep: Rep;
  away: string | null; // why they're not working today (leave, holiday, weekend)
  calls: number;
  target: number;
  overdue: number;
  meetingsToday: number;
}

export function teamToday(
  leads: Lead[],
  sellers: Rep[],
  targets: Record<string, { callsPerDay: number }>,
  holidays: CompanyHoliday[],
  leaves: RepLeave[]
): TeamRow[] {
  const today = isoToday();
  return sellers.map((rep) => {
    const mine = leads.filter((l) => l.assignee === rep.id);
    const { done, target } = callsToday(leads, rep.id, targets);
    return {
      rep,
      away: nonWorkingReason(today, rep.id, holidays, leaves),
      calls: done,
      target,
      overdue: followupsDue(mine).overdue.length,
      meetingsToday: upcomingMeetings(mine, 0).length,
    };
  });
}

export function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
