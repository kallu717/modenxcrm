import { create } from "zustand";
import { isoToday } from "./dates";
import { scoreLead, bandForScore } from "./scoring";
import { REPS, EDITABLE_FIELDS, ACCOUNT_EDITABLE_FIELDS, repById } from "./constants";
import { generateSeed } from "./seed";
import type {
  ActivityEntry,
  CompanyHoliday,
  EmailQuality,
  Lead,
  LeaveRequest,
  Rep,
  RepLeave,
  Role,
} from "./types";

export type EditableLeadField = "name" | "title" | "email" | "phone" | "city";
export type EditableAccountField = "account" | "type";

export interface ChangeRequestBase {
  id: string;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
  decidedBy?: string;
  decidedAt?: string;
}
export interface LeadChangeRequest extends ChangeRequestBase {
  scope: "lead";
  leadId: string;
  changes: Partial<Record<EditableLeadField, { from: string; to: string }>>;
}
export interface AccountChangeRequest extends ChangeRequestBase {
  scope: "account";
  accountName: string;
  changes: Partial<Record<EditableAccountField, { from: string; to: string }>>;
}
export type ChangeRequest = LeadChangeRequest | AccountChangeRequest;

function activityEntry(who: string, txt: string): ActivityEntry {
  return { who, txt, t: "just now", date: isoToday(), method: null };
}

function resolveNewContactOwner(
  leads: Lead[],
  accountName: string,
  currentUserId: string,
  isManager: boolean
): { existingOwner: string | null; assignee: string | null } {
  const existingOwner = leads.find((l) => l.account === accountName && l.assignee)?.assignee || null;
  const assignee = existingOwner || (isManager ? null : currentUserId);
  return { existingOwner, assignee };
}

export interface NewLeadInput {
  name: string;
  title: string;
  account: string;
  type: Lead["type"];
  email: string;
  phone: string;
  city: string;
  notes?: string;
  verified: boolean;
}

interface StoreState {
  reps: Rep[];
  currentUserId: string;
  leads: Lead[];
  companyHolidays: CompanyHoliday[];
  repLeaves: RepLeave[];
  leaveRequests: LeaveRequest[];
  changeRequests: ChangeRequest[];
  leaveSeq: number;
  crSeq: number;
  lrSeq: number;

  // ---- derived / role helpers ----
  currentUser: () => Rep;
  isManager: () => boolean;
  visibleLeads: () => Lead[];
  accountManageable: (accountName: string) => boolean;

  // ---- user ----
  setCurrentUser: (repId: string) => void;

  // ---- assignment ----
  assignAccount: (accountName: string, repId: string | null) => void;

  // ---- lead lifecycle ----
  setLeadStage: (leadId: string, stage: Lead["stage"]) => void;
  createLead: (input: NewLeadInput) => Lead | null;
  deleteLead: (leadId: string) => void;
  deleteAccount: (accountName: string) => void;

  // ---- change requests ----
  pendingRequestFor: (leadId: string) => LeadChangeRequest | null;
  pendingAccountRequestFor: (accountName: string) => AccountChangeRequest | null;
  pendingRequests: () => ChangeRequest[];
  saveLeadEdit: (leadId: string, changes: LeadChangeRequest["changes"]) => void;
  saveAccountEdit: (accountName: string, changes: AccountChangeRequest["changes"]) => void;
  applyChangeRequest: (crId: string, approve: boolean) => void;

  // ---- leave ----
  pendingLeaveRequests: () => LeaveRequest[];
  repLeaveOn: (repId: string, date: string) => RepLeave | null;
  submitLeaveRequest: (repId: string, date: string, reason: string) => boolean;
  decideLeaveRequest: (id: string, approve: boolean) => void;
}

const seedData = generateSeed();

export const useStore = create<StoreState>((set, get) => ({
  reps: REPS,
  currentUserId: "meera",
  leads: seedData.leads,
  companyHolidays: seedData.companyHolidays,
  repLeaves: seedData.repLeaves,
  leaveRequests: [],
  changeRequests: [],
  leaveSeq: 0,
  crSeq: 0,
  lrSeq: 0,

  currentUser: () => repById(get().currentUserId) || get().reps[0],
  isManager: () => get().currentUser().role === "Manager",

  // Reps only ever see leads a manager has assigned to them — there's no
  // self-claim pool to browse. Managers see everyone's, assigned or not.
  visibleLeads: () => {
    const { leads, isManager, currentUserId } = get();
    if (isManager()) return leads;
    return leads.filter((l) => l.assignee === currentUserId);
  },

  accountManageable: (accountName) => {
    const { leads, isManager, currentUserId } = get();
    if (isManager()) return true;
    return leads.some((l) => l.account === accountName && l.assignee === currentUserId);
  },

  setCurrentUser: (repId) => set({ currentUserId: repId }),

  // 1 account : 1 rep. Every contact at an account moves together.
  assignAccount: (accountName, repId) => {
    set((state) => {
      const contacts = state.leads.filter((l) => l.account === accountName);
      if (!contacts.length) return state;
      const prevOwnerId = contacts.find((c) => c.assignee)?.assignee || null;
      const newRep = repId ? repById(repId) : undefined;
      const prevRep = prevOwnerId ? repById(prevOwnerId) : undefined;
      const ownerChanged = (repId || null) !== prevOwnerId;
      const me = state.currentUser();
      const txt = newRep
        ? prevRep
          ? `Account reassigned from ${prevRep.name} to ${newRep.name} by ${me.name}.`
          : `Account assigned to ${newRep.name} by ${me.name}.`
        : `Account unassigned by ${me.name}.`;
      const leads = state.leads.map((l) => {
        if (l.account !== accountName) return l;
        return {
          ...l,
          assignee: repId || null,
          // A genuinely new owner hasn't had a chance to work the account yet —
          // the aging clock restarts so they aren't penalized for history before them.
          ownerSince: ownerChanged ? (repId ? isoToday() : null) : l.ownerSince,
          activity: [activityEntry(me.name, txt), ...l.activity],
        };
      });
      return { leads };
    });
  },

  setLeadStage: (leadId, stage) => {
    set((state) => ({
      leads: state.leads.map((l) => {
        if (l.id !== leadId) return l;
        const wonAt = stage === "won" ? isoToday() : l.wonAt ? null : l.wonAt;
        return {
          ...l,
          stage,
          stageHistory: [...l.stageHistory, { stage, date: isoToday() }],
          wonAt,
        };
      }),
    }));
  },

  createLead: (input) => {
    const state = get();
    const missing = (["name", "title", "account", "type", "email", "city"] as const).filter(
      (k) => !input[k]
    );
    if (missing.length) return null;
    if (!/^\S+@\S+\.\S+$/.test(input.email)) return null;
    if (state.leads.some((l) => (l.email || "").toLowerCase() === input.email.toLowerCase()))
      return null;

    const max = state.leads.reduce((m, l) => Math.max(m, Number(l.id.replace(/\D/g, "")) || 0), 0);
    const id = "L" + String(max + 1).padStart(3, "0");
    const today = isoToday();
    const me = state.currentUser();
    const { existingOwner, assignee } = resolveNewContactOwner(
      state.leads,
      input.account,
      state.currentUserId,
      state.isManager()
    );
    const noteBits = [`Added by ${me.name}.`];
    if (existingOwner && existingOwner !== state.currentUserId) {
      noteBits.push(`Account already owned by ${repById(existingOwner)?.name} — kept with them.`);
    }
    if (input.notes) noteBits.push(`Note: ${input.notes}`);

    const emailQuality: EmailQuality = !input.email ? "none" : input.verified ? "verified" : "catchall";

    const lead: Lead = {
      id,
      name: input.name,
      title: input.title,
      account: input.account,
      type: input.type,
      email: input.email || "",
      phone: input.phone || "",
      city: input.city || "—",
      emailQuality,
      multiSource: false,
      priorityOverride: null,
      priorityAuto: "Low",
      score: 0,
      scoreReasons: [],
      stage: "new",
      assignee,
      ownerSince: assignee ? today : null,
      nextFollowup: null,
      meetings: [],
      createdAt: today,
      plan: null,
      mandateDate: null,
      stageHistory: [{ stage: "new", date: today }],
      wonAt: null,
      activity: [activityEntry("System", noteBits.join(" "))],
    };
    const { score, reasons } = scoreLead(lead);
    lead.score = score;
    lead.scoreReasons = reasons;
    lead.priorityAuto = bandForScore(score);

    set((s) => ({ leads: [...s.leads, lead] }));
    return lead;
  },

  // Leads are the single source of truth — deleting the last contact at an
  // account makes that account disappear from Accounts too, since it's derived.
  deleteLead: (leadId) => {
    set((state) => ({
      leads: state.leads.filter((l) => l.id !== leadId),
      changeRequests: state.changeRequests.filter(
        (c) => !(c.scope === "lead" && c.leadId === leadId)
      ),
    }));
  },

  deleteAccount: (accountName) => {
    set((state) => ({
      leads: state.leads.filter((l) => l.account !== accountName),
      changeRequests: state.changeRequests.filter(
        (c) => !(c.scope === "account" && c.accountName === accountName)
      ),
    }));
  },

  pendingRequestFor: (leadId) => {
    const cr = get().changeRequests.find(
      (c) => c.scope === "lead" && c.leadId === leadId && c.status === "pending"
    );
    return (cr as LeadChangeRequest) || null;
  },
  pendingAccountRequestFor: (accountName) => {
    const cr = get().changeRequests.find(
      (c) => c.scope === "account" && c.accountName === accountName && c.status === "pending"
    );
    return (cr as AccountChangeRequest) || null;
  },
  pendingRequests: () => get().changeRequests.filter((c) => c.status === "pending"),

  // Reps can't edit a lead's — or an account's — details directly. Saving an
  // edit files a request; the manager approves it from Follow-ups before it
  // touches anything. A manager editing directly writes immediately.
  saveLeadEdit: (leadId, changes) => {
    const state = get();
    if (!Object.keys(changes).length) return;
    const me = state.currentUser();
    if (state.isManager()) {
      set((s) => ({
        leads: s.leads.map((l) => {
          if (l.id !== leadId) return l;
          const updated = { ...l } as Lead;
          Object.entries(changes).forEach(([k, v]) => {
            if (v) (updated as unknown as Record<string, string>)[k] = v.to;
          });
          const fields = Object.keys(changes)
            .map((k) => EDITABLE_FIELDS.find((f) => f.key === k)?.label)
            .join(", ");
          updated.activity = [activityEntry(me.name, `${fields} updated.`), ...l.activity];
          return updated;
        }),
      }));
    } else {
      state.crSeq++;
      const cr: LeadChangeRequest = {
        id: "CR" + String(state.crSeq).padStart(3, "0"),
        scope: "lead",
        leadId,
        requestedBy: state.currentUserId,
        requestedAt: isoToday(),
        changes,
        status: "pending",
      };
      const fields = Object.keys(changes)
        .map((k) => EDITABLE_FIELDS.find((f) => f.key === k)?.label)
        .join(", ");
      set((s) => ({
        changeRequests: [...s.changeRequests, cr],
        crSeq: s.crSeq + 1,
        leads: s.leads.map((l) =>
          l.id === leadId
            ? {
                ...l,
                activity: [
                  activityEntry(me.name, `Edit requested for ${fields} — awaiting manager approval.`),
                  ...l.activity,
                ],
              }
            : l
        ),
      }));
    }
  },

  saveAccountEdit: (accountName, changes) => {
    const state = get();
    if (!Object.keys(changes).length) return;
    const me = state.currentUser();
    const fields = Object.keys(changes)
      .map((k) => ACCOUNT_EDITABLE_FIELDS.find((f) => f.key === k)?.label)
      .join(", ");
    if (state.isManager()) {
      set((s) => ({
        leads: s.leads.map((l) => {
          if (l.account !== accountName) return l;
          const updated = { ...l } as Lead;
          Object.entries(changes).forEach(([k, v]) => {
            if (v) (updated as unknown as Record<string, string>)[k] = v.to;
          });
          updated.activity = [activityEntry(me.name, `${fields} updated.`), ...l.activity];
          return updated;
        }),
      }));
    } else {
      set((s) => {
        s.crSeq++;
        const cr: AccountChangeRequest = {
          id: "CR" + String(s.crSeq).padStart(3, "0"),
          scope: "account",
          accountName,
          requestedBy: s.currentUserId,
          requestedAt: isoToday(),
          changes,
          status: "pending",
        };
        return {
          changeRequests: [...s.changeRequests, cr],
          crSeq: s.crSeq,
          leads: s.leads.map((l) =>
            l.account === accountName
              ? {
                  ...l,
                  activity: [
                    activityEntry(
                      me.name,
                      `Account edit requested for ${fields} — awaiting manager approval.`
                    ),
                    ...l.activity,
                  ],
                }
              : l
          ),
        };
      });
    }
  },

  applyChangeRequest: (crId, approve) => {
    const state = get();
    const cr = state.changeRequests.find((c) => c.id === crId);
    if (!cr || cr.status !== "pending") return;
    const me = state.currentUser();

    if (cr.scope === "account") {
      const fields = Object.keys(cr.changes)
        .map((k) => ACCOUNT_EDITABLE_FIELDS.find((f) => f.key === k)?.label)
        .join(", ");
      const txt = approve
        ? `Account edit approved — ${fields} updated.`
        : `Account edit rejected — ${fields} left unchanged.`;
      set((s) => ({
        changeRequests: s.changeRequests.map((c) =>
          c.id === crId
            ? { ...c, status: approve ? "approved" : "rejected", decidedBy: s.currentUserId, decidedAt: isoToday() }
            : c
        ),
        leads: s.leads.map((l) => {
          if (l.account !== cr.accountName) return l;
          const updated = { ...l } as Lead;
          if (approve) {
            Object.entries(cr.changes).forEach(([k, v]) => {
              if (v) (updated as unknown as Record<string, string>)[k] = v.to;
            });
          }
          updated.activity = [activityEntry(me.name, txt), ...l.activity];
          return updated;
        }),
      }));
    } else {
      const fields = Object.keys(cr.changes)
        .map((k) => EDITABLE_FIELDS.find((f) => f.key === k)?.label)
        .join(", ");
      const txt = approve
        ? `Edit approved — ${fields} updated.`
        : `Edit rejected — ${fields} left unchanged.`;
      set((s) => ({
        changeRequests: s.changeRequests.map((c) =>
          c.id === crId
            ? { ...c, status: approve ? "approved" : "rejected", decidedBy: s.currentUserId, decidedAt: isoToday() }
            : c
        ),
        leads: s.leads.map((l) => {
          if (l.id !== cr.leadId) return l;
          const updated = { ...l } as Lead;
          if (approve) {
            Object.entries(cr.changes).forEach(([k, v]) => {
              if (v) (updated as unknown as Record<string, string>)[k] = v.to;
            });
          }
          updated.activity = [activityEntry(me.name, txt), ...l.activity];
          return updated;
        }),
      }));
    }
  },

  pendingLeaveRequests: () => get().leaveRequests.filter((r) => r.status === "pending"),
  repLeaveOn: (repId, date) =>
    get().repLeaves.find((l) => l.repId === repId && l.date === date) || null,

  submitLeaveRequest: (repId, date, reason) => {
    const state = get();
    if (
      state.leaveRequests.some(
        (r) => r.repId === repId && r.date === date && r.status === "pending"
      )
    ) {
      return false;
    }
    if (state.repLeaveOn(repId, date)) return false;
    const nextSeq = state.lrSeq + 1;
    const req: LeaveRequest = {
      id: "LR" + nextSeq,
      repId,
      date,
      reason,
      status: "pending",
      requestedAt: isoToday(),
    };
    set((s) => ({ leaveRequests: [...s.leaveRequests, req], lrSeq: nextSeq }));
    return true;
  },

  decideLeaveRequest: (id, approve) => {
    const state = get();
    const req = state.leaveRequests.find((r) => r.id === id);
    if (!req || req.status !== "pending") return;
    const decidedBy = state.currentUserId;
    const decidedAt = isoToday();
    set((s) => {
      const leaveRequests = s.leaveRequests.map((r) =>
        r.id === id ? { ...r, status: approve ? ("approved" as const) : ("rejected" as const), decidedBy, decidedAt } : r
      );
      if (!approve) return { leaveRequests };
      const nextSeq = s.leaveSeq + 1;
      const leave: RepLeave = { id: "LV" + nextSeq, repId: req.repId, date: req.date, reason: req.reason };
      return { leaveRequests, leaveSeq: nextSeq, repLeaves: [...s.repLeaves, leave] };
    });
  },
}));

export function currentUserRole(): Role {
  return useStore.getState().currentUser().role;
}
