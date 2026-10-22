import type { ImportRow } from "./import";
import type { Lead, Role } from "./types";

// The browser and the API share one address (the reverse proxy in production,
// rewrites in next.config.ts during development), so calls are plain relative
// paths and the sign-in cookie rides along on its own.

export interface ServerUser {
  id: string;
  name: string;
  role: Role;
  color: string;
  email: string;
}

export interface Versioned {
  version: number;
  lead: Lead;
}

export type RecordKind =
  | "change_request"
  | "leave_request"
  | "leave_day"
  | "holiday"
  | "payment_reminder"
  | "target";

export interface Bootstrap {
  me: ServerUser;
  users: ServerUser[];
  leads: Versioned[];
  records: Record<RecordKind, { id: string; data: unknown }[]>;
}

export interface RecordItem {
  kind: RecordKind;
  id: string;
  data: unknown;
}

export interface SyncBody {
  leads: Versioned[];
  deleteLeads: string[];
  records: RecordItem[];
  deleteRecords: { kind: RecordKind; id: string }[];
}

export interface ImportResult {
  ready: number;
  newAccounts: number;
  duplicates: number;
  rejected: number;
  issues: string[];
  created: Versioned[];
  createdCount: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown
  ) {
    super(`API ${status}`);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    // The server refuses changes without this header, which a form on another
    // site can't send — that's the cross-site request forgery guard.
    headers: { "X-Requested-With": "pipeline", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = (await res.json()).detail;
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  bootstrap: () => call<Bootstrap>("GET", "/api/bootstrap"),
  sync: (body: SyncBody) => call<{ leads: Versioned[]; records: RecordItem[] }>("POST", "/api/sync", body),
  createLead: (row: ImportRow) => call<Versioned>("POST", "/api/leads", row),
  importLeads: (rows: ImportRow[], filename: string, dryRun: boolean) =>
    call<ImportResult>("POST", `/api/leads/import${dryRun ? "?dry_run=true" : ""}`, { filename, rows }),
};

// Plain-language reasons for a refused save, shown in a toast.
export function describeError(e: unknown): string {
  if (!(e instanceof ApiError)) return "Couldn't reach the server. Check your connection.";
  const d = e.detail as { code?: string; account?: string; issues?: string[]; fields?: string[] } | string | null;
  const code = typeof d === "object" && d ? d.code : undefined;
  switch (code) {
    case "version_conflict":
      return "Someone else changed this lead a moment ago. Their version is shown now.";
    case "duplicate_email":
      return "Another lead already has that email.";
    case "account_name_taken":
      return `Another account is already named ${typeof d === "object" && d?.account}.`;
    case "account_has_two_owners":
      return "That would give one account two reps. Assign the whole account instead.";
    case "needs_manager":
      return "That change needs a manager's approval.";
    case "invalid_lead": {
      const issue = (typeof d === "object" && d?.issues?.[0]) || "";
      if (issue.includes("already exists")) return "A lead with that email already exists.";
      return issue.replace(/^Row \d+: /, "") || "That lead couldn't be saved.";
    }
    case "not_found":
      return "That lead is no longer assigned to you.";
  }
  if (e.status === 403) return "You don't have permission to do that.";
  if (e.status === 401) return "Your session has ended. Please sign in again.";
  return typeof d === "string" ? d : "The server couldn't save that change.";
}
