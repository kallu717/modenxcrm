import { effectivePriority, isClosedStage } from "./scoring";
import { followupBucket } from "./dates";
import { accountAgingDays, needsRevenueDetails } from "./revenue";
import type { AccountType, Lead, Priority, Stage } from "./types";

export const STAGE_PROGRESS: Stage[] = [
  "won",
  "proposal",
  "qualified",
  "contacted",
  "new",
  "unqualified",
  "lost",
];
export const PRIORITY_ORDER: Priority[] = ["Hot", "Warm", "Nurture", "Low"];

export interface AccountSummary {
  name: string;
  type: AccountType;
  contacts: Lead[];
  furthest: Stage;
  priority: Priority;
  owner: string | null;
  functions: string[];
  cities: string[];
  domain: string;
  subscription: Lead | null;
  needsSub: boolean;
  dueFollowups: number;
  openMeetings: number;
  agingDays: number | null;
  firstSeen: string;
}

export function buildAccounts(leadPool: Lead[]): AccountSummary[] {
  const map = new Map<string, Lead[]>();
  leadPool.forEach((l) => {
    const group = map.get(l.account) || [];
    group.push(l);
    map.set(l.account, group);
  });

  return [...map.entries()]
    .map(([name, contacts]) => {
      const furthest = STAGE_PROGRESS.find((s) => contacts.some((c) => c.stage === s)) || "new";
      const priority = PRIORITY_ORDER.find((p) => contacts.some((c) => effectivePriority(c) === p)) || "Low";
      // One rep per account is the rule — every contact here shares one assignee.
      const owner = contacts.find((c) => c.assignee)?.assignee || null;
      const functions = [...new Set(contacts.map((c) => c.title))];
      const cities = [...new Set(contacts.map((c) => c.city))];
      const domain = (contacts.find((c) => c.email)?.email || "").split("@")[1] || "—";
      const subscription = contacts.find((c) => c.stage === "won" && c.plan) || null;
      const needsSub = contacts.some(needsRevenueDetails);
      const dueFollowups = contacts.filter(
        (c) => c.nextFollowup && ["overdue", "today"].includes(followupBucket(c.nextFollowup) || "")
      ).length;
      const openMeetings = contacts.reduce(
        (n, c) => n + c.meetings.filter((m) => m.status === "scheduled").length,
        0
      );
      const agingDays = isClosedStage(furthest) ? null : accountAgingDays(furthest, contacts);
      return {
        name,
        type: contacts[0].type,
        contacts,
        furthest,
        priority,
        owner,
        functions,
        cities,
        domain,
        subscription,
        needsSub,
        dueFollowups,
        openMeetings,
        agingDays,
        firstSeen: contacts.map((c) => c.createdAt).sort()[0],
      };
    })
    .sort((a, b) => b.contacts.length - a.contacts.length || a.name.localeCompare(b.name));
}
