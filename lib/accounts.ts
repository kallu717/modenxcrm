import cityAliases from "./city-aliases.json";
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

// An account is split into locations by its contacts' city; each location
// has its own owner. An account in one city is simply one location, so
// handing over "the account" and handing over "its only location" are the
// same thing. Case, extra spaces and hyphens don't matter, and different
// spellings or old names of one city (Gurgaon/Gurugram, Bangalore/Bengaluru —
// city-aliases.json, shared with the server) are the same location. Blank and
// "—" count as one location of their own.
const CITY_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(cityAliases).filter(([k]) => !k.startsWith("_"))
);

function normalizeCity(city: string | null | undefined): string {
  return (city || "").toLowerCase().replace(/[\s\-_.,]+/g, " ").trim();
}

export function locationKey(city: string | null | undefined): string {
  const c = normalizeCity(city);
  if (c === "" || c === "—") return "";
  return (CITY_ALIASES[c] || c).toLowerCase();
}

// The name a location is shown under: the standard name when the city has
// one in the list, otherwise as typed.
export function cityLabel(city: string | null | undefined): string {
  const key = locationKey(city);
  if (!key) return "No city";
  return CITY_ALIASES[normalizeCity(city)] || (city || "").trim();
}

export interface LocationSummary {
  key: string;
  city: string; // display name ("No city" when unknown)
  contacts: Lead[];
  owner: string | null;
  furthest: Stage;
  agingDays: number | null;
}

export function buildLocations(contacts: Lead[]): LocationSummary[] {
  const map = new Map<string, Lead[]>();
  contacts.forEach((c) => {
    const k = locationKey(c.city);
    map.set(k, [...(map.get(k) || []), c]);
  });
  return [...map.entries()]
    .map(([key, group]) => {
      const furthest = STAGE_PROGRESS.find((s) => group.some((c) => c.stage === s)) || "new";
      return {
        key,
        city: cityLabel(group[0].city),
        contacts: group,
        owner: group.find((c) => c.assignee)?.assignee || null,
        furthest,
        agingDays: isClosedStage(furthest) ? null : accountAgingDays(furthest, group),
      };
    })
    .sort((a, b) => b.contacts.length - a.contacts.length || a.city.localeCompare(b.city));
}

export interface AccountSummary {
  name: string;
  type: AccountType;
  contacts: Lead[];
  furthest: Stage;
  priority: Priority;
  // The one owner when every assigned location has the same owner, else null.
  owner: string | null;
  // Everyone who owns at least one location of this account.
  owners: string[];
  locations: LocationSummary[];
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
      const locations = buildLocations(contacts);
      const owners = [...new Set(locations.map((l) => l.owner).filter((o): o is string => !!o))];
      const owner = owners.length === 1 ? owners[0] : null;
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
        owners,
        locations,
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

// ---------- the account page: who owns which city ----------

export interface OwnerShare {
  owner: string | null; // null = the unassigned cities
  cities: number;
  contacts: number;
}

// One entry per owner (most cities first), then the unassigned cities last.
export function ownerSummary(locations: LocationSummary[]): OwnerShare[] {
  const map = new Map<string | null, OwnerShare>();
  locations.forEach((l) => {
    const s = map.get(l.owner) || { owner: l.owner, cities: 0, contacts: 0 };
    s.cities += 1;
    s.contacts += l.contacts.length;
    map.set(l.owner, s);
  });
  const owned = [...map.values()].filter((s) => s.owner).sort((a, b) => b.cities - a.cities || b.contacts - a.contacts);
  const none = map.get(null);
  return none ? [...owned, none] : owned;
}

export type LocationStatus = "all" | "unassigned" | "assigned";
export type LocationSort = "contacts" | "city" | "days";

export function filterLocations(
  locations: LocationSummary[],
  opts: { query?: string; status?: LocationStatus; owner?: string | null; sort?: LocationSort }
): LocationSummary[] {
  const q = (opts.query || "").trim().toLowerCase();
  const rows = locations.filter((l) => {
    if (q && !l.city.toLowerCase().includes(q)) return false;
    if (opts.status === "unassigned" && l.owner) return false;
    if (opts.status === "assigned" && !l.owner) return false;
    if (opts.owner !== undefined && opts.owner !== null && l.owner !== opts.owner) return false;
    return true;
  });
  const sort = opts.sort || "contacts";
  return rows.sort((a, b) =>
    sort === "city"
      ? a.city.localeCompare(b.city)
      : sort === "days"
        ? (b.agingDays ?? -1) - (a.agingDays ?? -1) || a.city.localeCompare(b.city)
        : b.contacts.length - a.contacts.length || a.city.localeCompare(b.city)
  );
}

export function accountHref(name: string): string {
  return `/accounts/view?name=${encodeURIComponent(name)}`;
}

// Spreadsheet apps run a cell starting with = + - @ as a formula, so an
// imported value like "=HYPERLINK(...)" could do something on open. Such
// cells get a leading apostrophe, which shows as plain text.
function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// Every contact of the given accounts, one row each, for a spreadsheet.
export function accountsCsv(accounts: AccountSummary[], ownerName: (id: string | null) => string): string {
  const header = ["Account", "Account type", "Contact name", "Job title", "City", "Email", "Phone", "Stage", "Priority", "Owner"];
  const rows = accounts.flatMap((a) =>
    a.contacts.map((c) => [
      a.name, c.type, c.name, c.title, c.city, c.email, c.phone, c.stage,
      c.priorityOverride || c.priorityAuto, ownerName(c.assignee),
    ])
  );
  return [header, ...rows].map((r) => r.map((v) => csvCell(String(v ?? ""))).join(",")).join("\r\n");
}
