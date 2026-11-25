// The dashboard's widget catalogue and the rules for a layout. Sizes and who
// may use each widget come from dashboard-widgets.json, which the server
// shares, so both sides agree on what a valid layout is.

import spec from "./dashboard-widgets.json";
import type { Role } from "./types";

export const GRID_COLUMNS = spec.columns;
export const MAX_ROWS = spec.maxRows;
export const MAX_WIDGETS = spec.maxWidgets;
export const ROW_HEIGHT = 64; // px per grid row

export type WidgetId = keyof typeof spec.widgets;

export interface WidgetPlacement {
  id: WidgetId;
  w: number; // columns, out of 12
  h: number; // rows
}

export interface SavedDashboard {
  widgets: WidgetPlacement[];
}

export interface WidgetInfo {
  id: WidgetId;
  title: string;
  blurb: string;
  group: "My work" | "My numbers" | "Team" | "Admin";
  roles: Role[];
  w: number;
  h: number;
  minW: number;
  minH: number;
}

const TEXT: Record<WidgetId, { title: string; blurb: string; group: WidgetInfo["group"] }> = {
  glance: { title: "Today at a glance", blurb: "Overdue, today's follow-ups, meetings and payments as numbers", group: "My numbers" },
  followups: { title: "Follow-ups", blurb: "Overdue and today's follow-ups, with a Contacted button", group: "My work" },
  meetings: { title: "Meetings · next 7 days", blurb: "Booked meetings from today to a week out", group: "My work" },
  payments: { title: "Payments due", blurb: "Debits due soon or unpaid, with Mark paid", group: "My work" },
  hot: { title: "Hot, with no next step", blurb: "Hot contacts nobody has planned a follow-up for", group: "My work" },
  fresh: { title: "New, not contacted yet", blurb: "Contacts given to you that nobody has reached", group: "My work" },
  calls: { title: "Calls today", blurb: "Calls made today against your daily target", group: "My numbers" },
  requests: { title: "Your requests", blurb: "Edits and leave you asked for, and the answers", group: "My work" },
  pipeline: { title: "My pipeline by stage", blurb: "How many of your contacts sit at each stage", group: "My numbers" },
  won: { title: "Won this month", blurb: "Deals you won this month and what they bill", group: "My numbers" },
  week: { title: "Follow-ups this week", blurb: "Everything due over the next 7 days", group: "My work" },
  nostep: { title: "No next step", blurb: "Open contacts of yours with no follow-up date at all", group: "My work" },
  recent: { title: "Recently assigned to me", blurb: "Contacts handed to you in the last 14 days", group: "My work" },
  activity: { title: "My recent activity", blurb: "The notes, calls and changes you logged lately", group: "My work" },
  leave: { title: "Leave and holidays", blurb: "Company holidays and your leave this month", group: "My numbers" },
  "team-glance": { title: "Team at a glance", blurb: "Approvals, cities with no owner, stuck, revenue this month", group: "Team" },
  "team-today": { title: "Team today", blurb: "Each person: away or not, calls vs target, overdue, meetings", group: "Team" },
  unowned: { title: "Cities with no owner", blurb: "Locations waiting to be assigned, biggest first", group: "Team" },
  stuck: { title: "Stuck 60+ days", blurb: "Locations that haven't moved forward in 60 days", group: "Team" },
  approvals: { title: "Approvals", blurb: "Edit and leave requests, approve or decline here", group: "Team" },
  leaderboard: { title: "Leaderboard", blurb: "Wins and calls this month, by person", group: "Team" },
  funnel: { title: "Team pipeline funnel", blurb: "Contacts added in the last 90 days, stage by stage", group: "Team" },
  revenue: { title: "Revenue, last 6 months", blurb: "What won deals billed each month", group: "Team" },
  "leave-week": { title: "Away this week", blurb: "Who's on leave, and holidays, in the next 7 days", group: "Team" },
  "missing-plan": { title: "Won, missing plan", blurb: "Won deals with no plan or start date yet", group: "Team" },
  access: { title: "People waiting for access", blurb: "New sign-ins that need a role", group: "Admin" },
  roster: { title: "Team by role", blurb: "How many reps, managers and admins you have", group: "Admin" },
};

export const WIDGETS: WidgetInfo[] = (Object.keys(spec.widgets) as WidgetId[]).map((id) => ({
  id,
  ...TEXT[id],
  ...(spec.widgets[id] as Omit<WidgetInfo, "id" | "title" | "blurb" | "group" | "roles"> & { roles: string[] }),
  roles: spec.widgets[id].roles as Role[],
}));

export function widgetInfo(id: string): WidgetInfo | undefined {
  return WIDGETS.find((w) => w.id === id);
}

export function widgetsForRole(role: Role): WidgetInfo[] {
  return WIDGETS.filter((w) => w.roles.includes(role));
}

const DEFAULTS: Record<Role, WidgetId[]> = {
  Rep: ["glance", "followups", "payments", "meetings", "hot", "fresh", "calls", "requests"],
  Manager: [
    "glance", "followups", "payments", "meetings", "hot", "fresh",
    "team-glance", "team-today", "unowned", "approvals", "stuck",
  ],
  Admin: ["team-glance", "team-today", "unowned", "access", "stuck", "roster"],
  Pending: [],
};

export function defaultLayout(role: Role): WidgetPlacement[] {
  return DEFAULTS[role].map((id) => {
    const info = widgetInfo(id)!;
    return { id, w: info.w, h: info.h };
  });
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

// Whatever was saved (or tampered with) comes back as a layout this person
// may use: unknown, duplicate or not-for-your-role widgets are dropped and
// sizes pulled into range. Nothing saved at all means the role's default.
export function cleanLayout(raw: unknown, role: Role): WidgetPlacement[] {
  const widgets = (raw as { widgets?: unknown } | null)?.widgets;
  if (!Array.isArray(widgets)) return defaultLayout(role);
  const seen = new Set<string>();
  const out: WidgetPlacement[] = [];
  for (const w of widgets.slice(0, MAX_WIDGETS)) {
    const info = widgetInfo((w as WidgetPlacement)?.id);
    if (!info || !info.roles.includes(role) || seen.has(info.id)) continue;
    seen.add(info.id);
    const { w: width, h } = w as WidgetPlacement;
    out.push({
      id: info.id,
      w: Number.isFinite(width) ? clamp(width, info.minW, GRID_COLUMNS) : info.w,
      h: Number.isFinite(h) ? clamp(h, info.minH, MAX_ROWS) : info.h,
    });
  }
  return out;
}

export function moveWidget(layout: WidgetPlacement[], id: WidgetId, toIndex: number): WidgetPlacement[] {
  const from = layout.findIndex((w) => w.id === id);
  if (from < 0) return layout;
  const next = layout.filter((w) => w.id !== id);
  next.splice(clamp(toIndex, 0, next.length), 0, layout[from]);
  return next;
}

export function resizeWidget(layout: WidgetPlacement[], id: WidgetId, w: number, h: number): WidgetPlacement[] {
  const info = widgetInfo(id);
  if (!info) return layout;
  return layout.map((p) =>
    p.id === id ? { id, w: clamp(w, info.minW, GRID_COLUMNS), h: clamp(h, info.minH, MAX_ROWS) } : p
  );
}

export function removeWidget(layout: WidgetPlacement[], id: WidgetId): WidgetPlacement[] {
  return layout.filter((w) => w.id !== id);
}

// New widgets go on top, where you'll see them.
export function addWidget(layout: WidgetPlacement[], id: WidgetId, role: Role): WidgetPlacement[] {
  const info = widgetInfo(id);
  if (!info || !info.roles.includes(role) || layout.some((w) => w.id === id) || layout.length >= MAX_WIDGETS) {
    return layout;
  }
  return [{ id, w: info.w, h: info.h }, ...layout];
}
