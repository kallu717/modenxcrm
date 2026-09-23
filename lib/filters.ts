import { effectivePriority } from "./scoring";
import type { Lead, Priority } from "./types";

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
