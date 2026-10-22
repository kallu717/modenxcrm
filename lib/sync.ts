import { api, ApiError, describeError, type Bootstrap, type RecordItem, type RecordKind, type SyncBody, type Versioned } from "./api";
import { setDirectory } from "./constants";
import { useStore, type ChangeRequest } from "./store";
import type { CompanyHoliday, Lead, LeaveRequest, Rep, RepLeave } from "./types";

// Keeps the store and the server in step.
//
// The store's actions stay exactly as they were (and as the tests check them):
// they change the screen at once. After each change this module compares the
// store with the last state the server confirmed, and sends the difference as
// one all-or-nothing save. If the server refuses it, the screen goes back to
// what the server has and a toast says why. Every 30 seconds, when nothing is
// waiting to be saved, it re-reads the server to pick up other people's work.

const SAVE_DELAY_MS = 400;
const REFRESH_MS = 30_000;

type StoreSlice = ReturnType<typeof useStore.getState>;

export interface Snapshot {
  leads: Map<string, Lead>;
  records: Map<string, string>; // "kind/id" -> JSON of the record
}

// Each slice of the store maps onto one kind of server record.
export function recordsOf(s: Pick<StoreSlice, "changeRequests" | "leaveRequests" | "repLeaves" | "companyHolidays" | "paymentReminders" | "targets">): RecordItem[] {
  return [
    ...s.changeRequests.map((c) => ({ kind: "change_request" as const, id: c.id, data: c })),
    ...s.leaveRequests.map((r) => ({ kind: "leave_request" as const, id: r.id, data: r })),
    ...s.repLeaves.map((l) => ({ kind: "leave_day" as const, id: l.id, data: l })),
    ...s.companyHolidays.map((h) => ({ kind: "holiday" as const, id: h.date, data: h })),
    ...Object.entries(s.paymentReminders).map(([leadId, billingDate]) => ({
      kind: "payment_reminder" as const,
      id: leadId,
      data: { billingDate },
    })),
    ...Object.entries(s.targets).map(([repId, t]) => ({ kind: "target" as const, id: repId, data: t })),
  ];
}

export function snapshot(s: StoreSlice): Snapshot {
  return {
    leads: new Map(s.leads.map((l) => [l.id, l])),
    records: new Map(recordsOf(s).map((r) => [r.kind + "/" + r.id, JSON.stringify(r.data)])),
  };
}

// What changed since the server last confirmed. Leads are compared by
// reference (the store never mutates one in place), records by content.
// A lead the server hasn't seen is skipped: new leads are created through the
// API, never by a save.
export function diff(base: Snapshot, s: StoreSlice, versions: Map<string, number>): SyncBody {
  const leads: Versioned[] = [];
  const present = new Set<string>();
  for (const l of s.leads) {
    present.add(l.id);
    const before = base.leads.get(l.id);
    if (before && before !== l) leads.push({ version: versions.get(l.id) ?? 0, lead: l });
  }
  const deleteLeads = [...base.leads.keys()].filter((id) => !present.has(id));

  const records: RecordItem[] = [];
  const seen = new Set<string>();
  for (const r of recordsOf(s)) {
    const key = r.kind + "/" + r.id;
    seen.add(key);
    if (base.records.get(key) !== JSON.stringify(r.data)) records.push(r);
  }
  const deleteRecords = [...base.records.keys()]
    .filter((k) => !seen.has(k))
    .map((k) => {
      const i = k.indexOf("/");
      return { kind: k.slice(0, i) as RecordKind, id: k.slice(i + 1) };
    });
  return { leads, deleteLeads, records, deleteRecords };
}

export function isEmpty(d: SyncBody): boolean {
  return !d.leads.length && !d.deleteLeads.length && !d.records.length && !d.deleteRecords.length;
}

// Server payload -> store fields.
export function fromServer(b: Bootstrap) {
  const reps: Rep[] = b.users.map(({ id, name, role, color }) => ({ id, name, role, color }));
  const r = b.records;
  return {
    reps,
    currentUserId: b.me.id,
    leads: b.leads.map((x) => x.lead),
    changeRequests: r.change_request.map((x) => x.data as ChangeRequest),
    leaveRequests: r.leave_request.map((x) => x.data as LeaveRequest),
    repLeaves: r.leave_day.map((x) => x.data as RepLeave),
    companyHolidays: r.holiday.map((x) => x.data as CompanyHoliday),
    paymentReminders: Object.fromEntries(
      r.payment_reminder.map((x) => [x.id, (x.data as { billingDate: string }).billingDate])
    ),
    targets: Object.fromEntries(r.target.map((x) => [x.id, x.data as { callsPerDay: number }])),
  };
}

// ---------------------------------------------------------------- engine

let base: Snapshot = { leads: new Map(), records: new Map() };
let versions = new Map<string, number>();
let lastBoot = "";
let applying = false;
let saving = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function apply(fn: () => void) {
  applying = true;
  try {
    fn();
  } finally {
    applying = false;
  }
}

function load(b: Bootstrap) {
  const json = JSON.stringify(b);
  if (json === lastBoot) return;
  lastBoot = json;
  apply(() => {
    const fields = fromServer(b);
    setDirectory(fields.reps);
    useStore.setState(fields);
    base = snapshot(useStore.getState());
    versions = new Map(b.leads.map((x) => [x.lead.id, x.version]));
  });
}

// Full page loads on purpose: they drop everything held in memory for the
// previous session.
function toSignIn() {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/login");
}

async function reload() {
  try {
    load(await api.bootstrap());
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) toSignIn();
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void save();
  }, SAVE_DELAY_MS);
}

async function save() {
  if (saving) return; // the running save reschedules when it finishes
  const body = diff(base, useStore.getState(), versions);
  if (isEmpty(body)) return;
  saving = true;
  try {
    const res = await api.sync(body);
    lastBoot = ""; // the server has moved on; the next refresh should apply
    apply(() => {
      const state = useStore.getState();
      const sent = new Map(body.leads.map((x) => [x.lead.id, x.lead]));
      const fromServerById = new Map(res.leads.map((x) => [x.lead.id, x]));
      // The server recomputes scores, so take its copy, unless the lead was
      // changed again while this save was in flight: then keep the newer local
      // edit, which the next save sends on top of the new version.
      const leads = state.leads.map((l) => {
        const srv = fromServerById.get(l.id);
        return srv && sent.get(l.id) === l ? srv.lead : l;
      });
      useStore.setState({ leads });
      for (const [id, x] of fromServerById) {
        versions.set(id, x.version);
        const now = useStore.getState().leads.find((l) => l.id === id);
        base.leads.set(id, now === x.lead ? x.lead : sent.get(id)!);
      }
      body.deleteLeads.forEach((id) => {
        base.leads.delete(id);
        versions.delete(id);
      });
      body.records.forEach((r) => base.records.set(r.kind + "/" + r.id, JSON.stringify(r.data)));
      body.deleteRecords.forEach((r) => base.records.delete(r.kind + "/" + r.id));
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return toSignIn();
    useStore.getState().showToast(describeError(e));
    await reload();
  } finally {
    saving = false;
  }
  if (!isEmpty(diff(base, useStore.getState(), versions))) schedule();
}

async function refreshIfIdle() {
  if (document.hidden || saving || timer) return;
  if (!isEmpty(diff(base, useStore.getState(), versions))) return;
  await reload();
}

// Leads created through the API (New lead, Import) join the store as already
// saved, so they aren't sent back.
export function adoptLeads(created: Versioned[]) {
  const { isManager, currentUserId } = useStore.getState();
  // A rep's new contact at another rep's account goes to that rep, not into
  // this rep's list.
  const mine = created.filter((x) => isManager() || x.lead.assignee === currentUserId);
  apply(() => {
    useStore.getState().addLeads(mine.map((x) => x.lead));
    mine.forEach((x) => {
      base.leads.set(x.lead.id, x.lead);
      versions.set(x.lead.id, x.version);
    });
  });
}

// Called once by AuthGate. Resolves to false when nobody is signed in.
export async function startSession(): Promise<boolean> {
  if (started) return true;
  try {
    load(await api.bootstrap());
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return false;
    throw e;
  }
  started = true;
  useStore.subscribe(() => {
    if (!applying) schedule();
  });
  setInterval(() => void refreshIfIdle(), REFRESH_MS);
  window.addEventListener("beforeunload", (ev) => {
    if (saving || timer) ev.preventDefault(); // "changes may not be saved"
  });
  return true;
}

export async function signOut() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    await save();
  }
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/auth/logout"); // a server route, not a page
}
