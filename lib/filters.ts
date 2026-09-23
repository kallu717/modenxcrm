import { effectivePriority } from "./scoring";
import { isoToday, isoPlusDays } from "./dates";
import type { Lead, Priority } from "./types";

export type FuDatePreset = "all" | "overdue" | "today" | "week" | "30d" | "custom";
export interface FuDateFilter {
  preset: FuDatePreset;
  from: string | null;
  to: string | null;
}
export const EMPTY_FU_DATE_FILTER: FuDateFilter = { preset: "all", from: null, to: null };

export function applyFuDateFilter(items: Lead[], f: FuDateFilter): Lead[] {
  const today = isoToday();
  switch (f.preset) {
    case "overdue":
      return items.filter((l) => l.nextFollowup! < today);
    case "today":
      return items.filter((l) => l.nextFollowup === today);
    case "week":
      return items.filter((l) => l.nextFollowup! >= today && l.nextFollowup! <= isoPlusDays(today, 7));
    case "30d":
      return items.filter((l) => l.nextFollowup! >= today && l.nextFollowup! <= isoPlusDays(today, 30));
    case "custom":
      return items.filter((l) => {
        if (f.from && l.nextFollowup! < f.from) return false;
        if (f.to && l.nextFollowup! > f.to) return false;
        return true;
      });
    default:
      return items;
  }
}

export interface FilterState {
  search: string;
  priority: Priority | "";
  type: Lead["type"] | "";
  stage: Lead["stage"] | "";
  city: string;
  assignee: string; // rep id, "__unassigned", or ""
}

export const EMPTY_FILTERS: FilterState = {
  search: "",
  priority: "",
  type: "",
  stage: "",
  city: "",
  assignee: "",
};

export function filterLeads(leads: Lead[], f: FilterState): Lead[] {
  const q = f.search.trim().toLowerCase();
  return leads.filter((l) => {
    if (
      q &&
      !(
        l.name.toLowerCase().includes(q) ||
        l.account.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
      )
    )
      return false;
    if (f.priority && effectivePriority(l) !== f.priority) return false;
    if (f.type && l.type !== f.type) return false;
    if (f.stage && l.stage !== f.stage) return false;
    if (f.city && l.city !== f.city) return false;
    if (f.assignee === "__unassigned" && l.assignee) return false;
    if (f.assignee && f.assignee !== "__unassigned" && l.assignee !== f.assignee) return false;
    return true;
  });
}
