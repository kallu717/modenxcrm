// "Filter leads by field": pick any number of fields, each with its own
// comparison, and every contact matching all of them is kept — after Zoho
// CRM's "Filter Leads by" panel. Unlike the quick filters in FilterBar (one
// value per dropdown), this lets several conditions stack on the same field
// shown in different ways (e.g. Score > 50 and Score < 80), each with its own
// operator chosen for how that field works (text, a fixed list, a number or a
// date).

import { effectivePriority } from "./scoring";
import type { Lead } from "./types";

export type FieldType = "text" | "select" | "number" | "date" | "boolean";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterFieldDef {
  key: string;
  label: string;
  group: string;
  type: FieldType;
  options?: FilterOption[];
  managerOnly?: boolean;
}

export const TEXT_OPERATORS: FilterOption[] = [
  { value: "is", label: "is" },
  { value: "isNot", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "notContains", label: "doesn't contain" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
  { value: "isEmpty", label: "is empty" },
  { value: "isNotEmpty", label: "is not empty" },
];

export const SELECT_OPERATORS: FilterOption[] = [
  { value: "is", label: "is" },
  { value: "isNot", label: "is not" },
];

export const NUMBER_OPERATORS: FilterOption[] = [
  { value: "eq", label: "=" },
  { value: "neq", label: "≠" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "between", label: "between" },
];

export const DATE_OPERATORS: FilterOption[] = [
  { value: "on", label: "on" },
  { value: "before", label: "before" },
  { value: "after", label: "after" },
  { value: "between", label: "between" },
  { value: "isEmpty", label: "is empty" },
  { value: "isNotEmpty", label: "is not empty" },
];

export const BOOLEAN_OPERATORS: FilterOption[] = [{ value: "is", label: "is" }];

export const OPERATORS_BY_TYPE: Record<FieldType, FilterOption[]> = {
  text: TEXT_OPERATORS,
  select: SELECT_OPERATORS,
  number: NUMBER_OPERATORS,
  date: DATE_OPERATORS,
  boolean: BOOLEAN_OPERATORS,
};

export function defaultOperatorFor(type: FieldType): string {
  return OPERATORS_BY_TYPE[type][0].value;
}

// No value box needed for these — the operator says it all.
export const NO_VALUE_OPERATORS = new Set(["isEmpty", "isNotEmpty"]);
export const TWO_VALUE_OPERATORS = new Set(["between"]);

export const PRIORITY_OPTIONS: FilterOption[] = ["Hot", "Warm", "Nurture", "Low"].map((p) => ({ value: p, label: p }));
export const ACCOUNT_TYPE_OPTIONS: FilterOption[] = ["Brand", "Mall", "Store"].map((t) => ({ value: t, label: t }));
export const EMAIL_QUALITY_OPTIONS: FilterOption[] = [
  { value: "verified", label: "Verified" },
  { value: "catchall", label: "Catch-all" },
  { value: "none", label: "No email" },
];
export const BOOLEAN_OPTIONS: FilterOption[] = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

export function stageOptions(stages: { id: string; name: string }[]): FilterOption[] {
  return stages.map((s) => ({ value: s.id, label: s.name }));
}

export function ownerOptions(reps: { id: string; name: string }[]): FilterOption[] {
  return [{ value: "__unassigned", label: "Unassigned" }, ...reps.map((r) => ({ value: r.id, label: r.name }))];
}

export function peopleOptions(people: { id: string; name: string }[]): FilterOption[] {
  return people.map((p) => ({ value: p.id, label: p.name }));
}

// The catalog is built per page (stages and people vary with the live data /
// who's signed in), not kept as one static constant. `reps` is who a lead can
// be owned by (reps and managers); `allUsers` is everyone who can sign in, for
// "who added this" — any role can add or import a contact.
export function buildFilterFields(
  stages: { id: string; name: string }[],
  reps: { id: string; name: string }[],
  allUsers: { id: string; name: string }[] = reps
): FilterFieldDef[] {
  return [
    { key: "name", label: "Contact name", group: "Contact", type: "text" },
    { key: "title", label: "Job title", group: "Contact", type: "text" },
    { key: "email", label: "Email", group: "Contact", type: "text" },
    { key: "phone", label: "Phone", group: "Contact", type: "text" },
    { key: "city", label: "City", group: "Contact", type: "text" },
    { key: "emailQuality", label: "Email quality", group: "Contact", type: "select", options: EMAIL_QUALITY_OPTIONS },
    { key: "account", label: "Account name", group: "Account", type: "text" },
    { key: "type", label: "Account type", group: "Account", type: "select", options: ACCOUNT_TYPE_OPTIONS },
    { key: "multiSource", label: "Multiple sources", group: "Account", type: "boolean" },
    { key: "stage", label: "Stage", group: "Pipeline", type: "select", options: stageOptions(stages) },
    { key: "priority", label: "Priority", group: "Pipeline", type: "select", options: PRIORITY_OPTIONS },
    { key: "score", label: "Score", group: "Pipeline", type: "number" },
    { key: "assignee", label: "Owner", group: "Pipeline", type: "select", options: ownerOptions(reps), managerOnly: true },
    { key: "createdBy", label: "Created by", group: "Pipeline", type: "select", options: peopleOptions(allUsers) },
    { key: "createdAt", label: "Created on", group: "Dates", type: "date" },
    { key: "ownerSince", label: "Owner since", group: "Dates", type: "date" },
    { key: "nextFollowup", label: "Next follow-up", group: "Dates", type: "date" },
    { key: "wonAt", label: "Won on", group: "Dates", type: "date" },
  ];
}

export interface FieldCriterion {
  field: string;
  operator: string;
  value: string;
  value2?: string;
}

// What a lead actually holds for a field — some are stored directly, a few
// (priority, owner) are worked out first.
function rawValue(lead: Lead, key: string): string | number | boolean | null {
  switch (key) {
    case "priority":
      return effectivePriority(lead);
    case "assignee":
      return lead.assignee ?? "__unassigned";
    default:
      return (lead as unknown as Record<string, string | number | boolean | null>)[key] ?? null;
  }
}

function asText(v: string | number | boolean | null): string {
  return v === null || v === undefined ? "" : String(v).toLowerCase();
}

function matchText(v: string | number | boolean | null, op: string, value: string): boolean {
  const s = asText(v);
  const q = value.trim().toLowerCase();
  switch (op) {
    case "is":
      return s === q;
    case "isNot":
      return s !== q;
    case "contains":
      return s.includes(q);
    case "notContains":
      return !s.includes(q);
    case "startsWith":
      return s.startsWith(q);
    case "endsWith":
      return s.endsWith(q);
    case "isEmpty":
      return s === "";
    case "isNotEmpty":
      return s !== "";
    default:
      return true;
  }
}

function matchSelect(v: string | number | boolean | null, op: string, value: string): boolean {
  const s = asText(v);
  const q = value.trim().toLowerCase();
  if (op === "isNot") return s !== q;
  return s === q; // "is"
}

function matchNumber(v: string | number | boolean | null, op: string, value: string, value2?: string): boolean {
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return false;
  const a = Number(value);
  switch (op) {
    case "eq":
      return n === a;
    case "neq":
      return n !== a;
    case "gt":
      return n > a;
    case "lt":
      return n < a;
    case "between": {
      const b = Number(value2);
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      return n >= lo && n <= hi;
    }
    default:
      return true;
  }
}

function matchDate(v: string | number | boolean | null, op: string, value: string, value2?: string): boolean {
  const s = v == null ? "" : String(v); // ISO "YYYY-MM-DD" sorts lexically
  if (op === "isEmpty") return s === "";
  if (op === "isNotEmpty") return s !== "";
  if (s === "") return false;
  switch (op) {
    case "on":
      return s === value;
    case "before":
      return s < value;
    case "after":
      return s > value;
    case "between": {
      const [lo, hi] = value <= (value2 || "") ? [value, value2 || value] : [value2 || value, value];
      return s >= lo && s <= hi;
    }
    default:
      return true;
  }
}

function matchBoolean(v: string | number | boolean | null, value: string): boolean {
  return Boolean(v) === (value === "true");
}

export function matchesCriterion(lead: Lead, c: FieldCriterion, field: FilterFieldDef): boolean {
  const v = rawValue(lead, c.field);
  switch (field.type) {
    case "text":
      return matchText(v, c.operator, c.value);
    case "select":
      return matchSelect(v, c.operator, c.value);
    case "number":
      return matchNumber(v, c.operator, c.value, c.value2);
    case "date":
      return matchDate(v, c.operator, c.value, c.value2);
    case "boolean":
      return matchBoolean(v, c.value);
    default:
      return true;
  }
}

// Every criterion must match (an AND across fields) — rows with nothing
// useful to compare (no value, and not an empty/not-empty check) are ignored
// rather than rejecting everything.
export function applyFieldCriteria(leads: Lead[], criteria: FieldCriterion[], fieldsByKey: Map<string, FilterFieldDef>): Lead[] {
  const active = criteria.filter((c) => {
    const field = fieldsByKey.get(c.field);
    if (!field) return false;
    if (NO_VALUE_OPERATORS.has(c.operator)) return true;
    if (field.type === "boolean") return true;
    if (!c.value.trim()) return false;
    if (TWO_VALUE_OPERATORS.has(c.operator) && !(c.value2 || "").trim()) return false;
    return true;
  });
  if (!active.length) return leads;
  return leads.filter((lead) => active.every((c) => matchesCriterion(lead, c, fieldsByKey.get(c.field)!)));
}

export function fieldsByKeyMap(fields: FilterFieldDef[]): Map<string, FilterFieldDef> {
  return new Map(fields.map((f) => [f.key, f]));
}

export function emptyCriterion(fieldKey: string, type: FieldType): FieldCriterion {
  return { field: fieldKey, operator: defaultOperatorFor(type), value: type === "boolean" ? "true" : "" };
}

// What's remembered for the session comes back through here: anything that
// isn't shaped like a criterion is dropped rather than breaking the page.
export function parseFieldCriteria(raw: unknown): FieldCriterion[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: FieldCriterion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.field !== "string" || typeof r.operator !== "string" || typeof r.value !== "string") continue;
    out.push({ field: r.field, operator: r.operator, value: r.value, ...(typeof r.value2 === "string" ? { value2: r.value2 } : {}) });
  }
  return out;
}
