// Quick search (press /): one box that finds pages, accounts and
// contacts. Built from the vibecodecomponents.com "Command Palette" and
// "Search Autocomplete" prompts. Only searches what the person can already
// see (their visible leads), so it never reveals anything new.

import type { Lead } from "./types";

export type HitKind = "page" | "account" | "lead";

export interface Hit {
  kind: HitKind;
  id: string; // page href, account name, or lead id
  title: string;
  detail: string;
}

export interface PageItem {
  href: string;
  label: string;
}

const MAX_LEADS = 8;
const MAX_ACCOUNTS = 6;

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();
}

// 0 = no match; higher is better. Whole-field and starts-with beat contains.
function rank(field: string, q: string): number {
  const f = norm(field);
  if (!f || !q) return 0;
  if (f === q) return 4;
  if (f.startsWith(q)) return 3;
  if (f.split(/[\s@.\-·,]+/).some((w) => w.startsWith(q))) return 2;
  return f.includes(q) ? 1 : 0;
}

export function quickSearch(query: string, leads: Lead[], pages: PageItem[]): Hit[] {
  const q = norm(query);
  if (!q) return [];
  const digits = q.replace(/\D/g, "");

  const pageHits = pages
    .map((p) => ({ p, r: rank(p.label, q) }))
    .filter((x) => x.r > 0)
    .sort((a, b) => b.r - a.r)
    .map(({ p }) => ({ kind: "page" as const, id: p.href, title: p.label, detail: "Go to page" }));

  const accounts = new Map<string, { name: string; contacts: number; cities: Set<string>; r: number }>();
  for (const l of leads) {
    const key = norm(l.account);
    const a = accounts.get(key) ?? { name: l.account, contacts: 0, cities: new Set<string>(), r: rank(l.account, q) };
    a.contacts++;
    if (l.city && l.city !== "—") a.cities.add(l.city);
    accounts.set(key, a);
  }
  const accountHits = [...accounts.values()]
    .filter((a) => a.r > 0)
    .sort((a, b) => b.r - a.r || b.contacts - a.contacts || a.name.localeCompare(b.name))
    .slice(0, MAX_ACCOUNTS)
    .map((a) => ({
      kind: "account" as const,
      id: a.name,
      title: a.name,
      detail: `${a.contacts} contact${a.contacts === 1 ? "" : "s"}${a.cities.size ? ` · ${a.cities.size} cit${a.cities.size === 1 ? "y" : "ies"}` : ""}`,
    }));

  const leadHits = leads
    .map((l) => {
      const byName = rank(l.name, q);
      const r = Math.max(
        byName ? byName + 1 : 0, // a person's name is the likeliest thing typed
        norm(l.id) === q ? 6 : 0,
        rank(l.email, q),
        digits.length >= 4 && (l.phone || "").replace(/\D/g, "").includes(digits) ? 3 : 0,
        rank(l.account, q) || rank(l.city, q) ? 1 : 0,
      );
      return { l, r };
    })
    .filter((x) => x.r > 0)
    .sort((a, b) => b.r - a.r || a.l.name.localeCompare(b.l.name))
    .slice(0, MAX_LEADS)
    .map(({ l }) => ({
      kind: "lead" as const,
      id: l.id,
      title: l.name,
      detail: [l.title, l.account, l.city !== "—" ? l.city : ""].filter(Boolean).join(" · "),
    }));

  return [...pageHits, ...accountHits, ...leadHits];
}

// Recently opened results, newest first, kept in this browser only.
const RECENT_KEY = "bdcrm:recent-search";
const MAX_RECENT = 5;

export function readRecent(): Hit[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((h) => h && h.kind && h.id && h.title).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function rememberRecent(hit: Hit): void {
  try {
    const next = [hit, ...readRecent().filter((h) => !(h.kind === hit.kind && h.id === hit.id))].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: recent list just isn't kept */
  }
}
