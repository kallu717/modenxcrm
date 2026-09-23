"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { EDITABLE_FIELDS, ACCOUNT_EDITABLE_FIELDS, repById } from "@/lib/constants";
import { fmtShortDate, fmtFollowup, fmtDueIn, followupBucket, daysUntil } from "@/lib/dates";
import { duePayments, planById, fmtInr, leadMrr } from "@/lib/revenue";
import { effectivePriority } from "@/lib/scoring";
import { applyFuDateFilter, EMPTY_FU_DATE_FILTER, type FuDateFilter } from "@/lib/filters";
import LeadDrawer from "@/components/LeadDrawer";
import ContactedModal from "@/components/ContactedModal";
import type { Lead } from "@/lib/types";
import type { ChangeRequest } from "@/lib/store";

const FU_PRESETS: { id: FuDateFilter["preset"]; label: string }[] = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "30d", label: "Next 30 days" },
  { id: "custom", label: "Custom" },
];

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function Approvals({ onOpenLead }: { onOpenLead: (id: string) => void }) {
  const isManager = useStore((s) => s.isManager());
  const currentUserId = useStore((s) => s.currentUserId);
  const changeRequests = useStore((s) => s.changeRequests);
  const applyChangeRequest = useStore((s) => s.applyChangeRequest);
  const showToast = useStore((s) => s.showToast);
  const leads = useStore((s) => s.leads);

  const mine = useMemo(() => {
    const pending = changeRequests.filter((c) => c.status === "pending");
    return isManager ? pending : pending.filter((c) => c.requestedBy === currentUserId);
  }, [changeRequests, isManager, currentUserId]);

  if (!mine.length) return null;

  return (
    <section className="mb-6">
      <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
        {isManager ? `Pending approvals (${mine.length})` : `Your pending edit requests (${mine.length})`}
      </p>
      <p className="text-[12px] mt-0.5 mb-3" style={{ color: "var(--muted)" }}>
        {isManager
          ? "Reps can't change contact or account details directly — approve a request and it's applied straight away."
          : "Waiting on your manager. Nothing changes until these are approved."}
      </p>
      <div className="space-y-2">
        {mine.map((cr: ChangeRequest) => {
          const isAcct = cr.scope === "account";
          const lead = isAcct ? null : leads.find((l) => l.id === cr.leadId);
          const who = repById(cr.requestedBy);
          const fieldSet = isAcct ? ACCOUNT_EDITABLE_FIELDS : EDITABLE_FIELDS;
          return (
            <div
              key={cr.id}
              className="rounded-lg p-3 cursor-pointer"
              style={{ background: "var(--surface)", borderLeft: "3px solid var(--warn)", boxShadow: "var(--shadow)" }}
              onClick={() => lead && onOpenLead(lead.id)}
            >
              <div className="flex items-center gap-2 text-[12.5px]">
                {who && (
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-semibold"
                    style={{ background: who.color }}
                  >
                    {initials(who.name)}
                  </span>
                )}
                <span style={{ color: "var(--ink)" }}>
                  <b>{who?.name}</b> wants to update{" "}
                  {isAcct ? (
                    <b>{cr.accountName}</b>
                  ) : (
                    <>
                      <b>{lead?.name}</b> · {lead?.account}
                    </>
                  )}
                </span>
                <span className="ml-auto font-mono" style={{ fontSize: "10.5px", color: "var(--muted)" }}>
                  {fmtShortDate(cr.requestedAt)}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {Object.entries(cr.changes).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-[11.5px]">
                    <span
                      className="uppercase tracking-wide"
                      style={{ color: "var(--muted)", fontSize: "10px" }}
                    >
                      {fieldSet.find((f) => f.key === k)?.label}
                    </span>
                    <span style={{ color: "var(--muted)", textDecoration: "line-through" }}>{v?.from || "—"}</span>
                    <span style={{ color: "var(--ink-2)" }}>→</span>
                    <span style={{ color: "var(--good)", fontWeight: 600 }}>{v?.to}</span>
                  </div>
                ))}
              </div>
              {isManager ? (
                <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded text-[12px] text-white"
                    style={{ background: "var(--accent)" }}
                    onClick={() => {
                      applyChangeRequest(cr.id, true);
                      if (useStore.getState().changeRequests.find((c) => c.id === cr.id)?.status === "approved") {
                        showToast("Change approved and applied");
                      }
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded text-[12px] border"
                    style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
                    onClick={() => {
                      applyChangeRequest(cr.id, false);
                      showToast("Change rejected — nothing was modified");
                    }}
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <span className="block mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                  Awaiting manager approval
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Payments({ visibleLeads, onOpenLead }: { visibleLeads: Lead[]; onOpenLead: (id: string) => void }) {
  const isManager = useStore((s) => s.isManager());
  const paymentReminders = useStore((s) => s.paymentReminders);
  const logPaymentReminder = useStore((s) => s.logPaymentReminder);
  const showToast = useStore((s) => s.showToast);

  const due = useMemo(() => duePayments(visibleLeads, paymentReminders), [visibleLeads, paymentReminders]);
  if (!due.length) return null;

  const total = due.reduce((s, x) => s + leadMrr(x.lead), 0);

  return (
    <section className="mb-6">
      <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
        Payments due ({due.length})
      </p>
      <p className="text-[12px] mt-0.5 mb-3" style={{ color: "var(--muted)" }}>
        {isManager
          ? `${fmtInr(total)} debiting in the next 7 days across ${due.length} mandate${due.length === 1 ? "" : "s"}.`
          : `${fmtInr(total)} debiting from your accounts in the next 7 days — worth a heads-up before the mandate runs.`}
      </p>
      <div className="space-y-2">
        {due.map(({ lead, date }) => {
          const rep = repById(lead.assignee);
          const soon = daysUntil(date) <= 1;
          return (
            <div
              key={lead.id}
              className="flex items-center gap-3 rounded-lg p-3 cursor-pointer"
              style={{
                background: "var(--surface)",
                boxShadow: "var(--shadow)",
                borderLeft: soon ? "3px solid var(--crit)" : "3px solid transparent",
              }}
              onClick={() => onOpenLead(lead.id)}
            >
              <span className="font-mono text-[11.5px] w-24 shrink-0" style={{ color: soon ? "var(--crit)" : "var(--muted)" }}>
                {fmtDueIn(date)}
              </span>
              <div className="flex-1 flex items-center gap-2 flex-wrap text-[12.5px]">
                <span style={{ color: "var(--ink)" }}>{lead.account}</span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                >
                  {lead.type}
                </span>
                <span style={{ color: "var(--ink-2)" }}>{lead.name}</span>
                <span className="font-mono" style={{ color: "var(--good)" }}>
                  {planById(lead.plan)?.name} · {fmtInr(leadMrr(lead))}
                </span>
                {rep && (
                  <span className="flex items-center gap-1" style={{ color: "var(--ink-2)" }}>
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-semibold"
                      style={{ background: rep.color }}
                    >
                      {initials(rep.name)}
                    </span>
                    {rep.name}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="px-2.5 py-1 rounded text-[12px] border shrink-0"
                style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  logPaymentReminder(lead.id, date);
                  showToast("Reminder logged for " + lead.account);
                }}
              >
                Log reminder sent
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const GROUPS: { key: "overdue" | "today" | "upcoming"; label: string; color: string }[] = [
  { key: "overdue", label: "Overdue", color: "var(--crit)" },
  { key: "today", label: "Today", color: "var(--warn)" },
  { key: "upcoming", label: "Upcoming", color: "var(--accent)" },
];

export default function FollowupsPage() {
  const leads = useStore((s) => s.leads);
  const isManager = useStore((s) => s.isManager());
  const currentUserId = useStore((s) => s.currentUserId);
  const snoozeFollowup = useStore((s) => s.snoozeFollowup);
  const showToast = useStore((s) => s.showToast);
  const visibleLeads = useMemo(
    () => (isManager ? leads : leads.filter((l) => l.assignee === currentUserId)),
    [leads, isManager, currentUserId]
  );

  const [dateFilter, setDateFilter] = useState<FuDateFilter>(EMPTY_FU_DATE_FILTER);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [contactedLead, setContactedLead] = useState<Lead | null>(null);

  const withFollowup = useMemo(() => {
    const base = visibleLeads
      .filter((l) => l.nextFollowup)
      .sort((a, b) => (a.nextFollowup! < b.nextFollowup! ? -1 : 1));
    return applyFuDateFilter(base, dateFilter);
  }, [visibleLeads, dateFilter]);

  return (
    <div className="py-5">
      <h1 className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
        Follow-ups
      </h1>
      <p className="text-[12.5px] mt-0.5 mb-5" style={{ color: "var(--muted)" }}>
        Every lead with a scheduled next-contact date, soonest first — set one from a lead&apos;s
        detail panel.
      </p>

      <Approvals onOpenLead={setOpenLeadId} />
      <Payments visibleLeads={visibleLeads} onOpenLead={setOpenLeadId} />

      <section>
        <div className="flex items-center gap-1 flex-wrap mb-3">
          {FU_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="px-2.5 py-1 rounded-md text-[12px]"
              style={{
                background: dateFilter.preset === p.id ? "var(--accent-soft)" : "transparent",
                color: dateFilter.preset === p.id ? "var(--accent-ink)" : "var(--ink-2)",
              }}
              onClick={() => setDateFilter({ ...dateFilter, preset: p.id })}
            >
              {p.label}
            </button>
          ))}
          {dateFilter.preset === "custom" && (
            <>
              <input
                type="date"
                value={dateFilter.from || ""}
                onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value || null })}
                className="px-2 py-1 rounded-md text-[12px] border"
                style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
              />
              <input
                type="date"
                value={dateFilter.to || ""}
                onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value || null })}
                className="px-2 py-1 rounded-md text-[12px] border"
                style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
              />
            </>
          )}
        </div>

        {!withFollowup.length ? (
          <p className="text-[12.5px] py-8 text-center" style={{ color: "var(--muted)" }}>
            No leads match these filters with a follow-up date set.
          </p>
        ) : (
          GROUPS.map((g) => {
            const items = withFollowup.filter((l) => followupBucket(l.nextFollowup) === g.key);
            if (!items.length) return null;
            return (
              <div key={g.key} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[12px] font-semibold" style={{ color: g.color }}>
                    {g.label}
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((l) => {
                    const rep = repById(l.assignee);
                    return (
                      <div
                        key={l.id}
                        className="flex items-center gap-3 rounded-lg p-3 cursor-pointer"
                        style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}
                        onClick={() => setOpenLeadId(l.id)}
                      >
                        <span className="font-mono text-[11.5px] w-28 shrink-0" style={{ color: "var(--muted)" }}>
                          {fmtFollowup(l.nextFollowup)}
                        </span>
                        <div className="flex-1 flex items-center gap-2 flex-wrap text-[12.5px]">
                          <span style={{ color: "var(--ink)" }}>{l.name}</span>
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                            style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                          >
                            {l.type}
                          </span>
                          <span style={{ color: "var(--ink-2)" }}>{l.account}</span>
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                            style={{ background: "var(--crit-soft)", color: "var(--p-hot)" }}
                          >
                            {effectivePriority(l)}
                          </span>
                          {rep ? (
                            <span className="flex items-center gap-1" style={{ color: "var(--ink-2)" }}>
                              <span
                                className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-semibold"
                                style={{ background: rep.color }}
                              >
                                {initials(rep.name)}
                              </span>
                              {rep.name}
                            </span>
                          ) : (
                            <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Unassigned</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded text-[12px] border"
                            style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
                            onClick={() => {
                              snoozeFollowup(l.id, 7);
                              showToast(`Snoozed ${l.name} by a week`);
                            }}
                          >
                            Snooze 1wk
                          </button>
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded text-[12px] text-white"
                            style={{ background: "var(--accent)" }}
                            onClick={() => setContactedLead(l)}
                          >
                            Contacted
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </section>

      {openLeadId && <LeadDrawer leadId={openLeadId} onClose={() => setOpenLeadId(null)} />}
      {contactedLead && <ContactedModal lead={contactedLead} onClose={() => setContactedLead(null)} />}
    </div>
  );
}
