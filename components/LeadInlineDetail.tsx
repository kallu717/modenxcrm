"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { EDITABLE_FIELDS, STAGES, repById } from "@/lib/constants";
import { effectivePriority } from "@/lib/scoring";
import { fmtFollowup, fmtShortDate } from "@/lib/dates";
import { planById, fmtInr, leadMrr } from "@/lib/revenue";
import type { Lead } from "@/lib/types";
import type { EditableLeadField } from "@/lib/store";

export default function LeadInlineDetail({ lead }: { lead: Lead }) {
  const isManager = useStore((s) => s.isManager());
  const currentUserId = useStore((s) => s.currentUserId);
  const pendingRequestFor = useStore((s) => s.pendingRequestFor);
  const saveLeadEdit = useStore((s) => s.saveLeadEdit);
  const deleteLead = useStore((s) => s.deleteLead);
  const pending = pendingRequestFor(lead.id);
  const canEdit = isManager || lead.assignee === currentUserId;
  const rep = repById(lead.assignee);
  const stage = STAGES.find((s) => s.id === lead.stage);

  const showToast = useStore((s) => s.showToast);
  const [editing, setEditing] = useState(false);
  const currentValues = (): Record<EditableLeadField, string> => ({
    name: lead.name,
    title: lead.title,
    email: lead.email,
    phone: lead.phone,
    city: lead.city,
  });
  const [form, setForm] = useState<Record<EditableLeadField, string>>(currentValues);

  const meetings = [...lead.meetings].sort((a, b) => (a.date < b.date ? -1 : 1));

  const startEdit = () => {
    setForm(currentValues());
    setEditing(true);
  };

  const handleSave = () => {
    const changes: Record<string, { from: string; to: string }> = {};
    EDITABLE_FIELDS.forEach((f) => {
      const val = form[f.key as EditableLeadField].trim();
      if (val && val !== String(lead[f.key as EditableLeadField])) {
        changes[f.key] = { from: String(lead[f.key as EditableLeadField]), to: val };
      }
    });
    setEditing(false);
    if (!Object.keys(changes).length) {
      showToast("Nothing changed");
      return;
    }
    saveLeadEdit(lead.id, changes);
    showToast(isManager ? "Changes saved" : "Sent to manager for approval");
  };

  return (
    <div className="p-4" style={{ background: "var(--accent-soft)" }} onClick={(e) => e.stopPropagation()}>
      {pending && (
        <div
          className="rounded-md px-3 py-2 mb-3 text-[12px] flex flex-wrap items-center gap-2"
          style={{ background: "var(--warn-soft)", border: "1px solid var(--warn)" }}
        >
          <span
            className="px-1.5 py-0.5 rounded text-white font-mono"
            style={{ background: "var(--warn)", fontSize: "10px" }}
          >
            Awaiting approval
          </span>
          <span style={{ color: "var(--ink-2)" }}>
            {repById(pending.requestedBy)?.name} requested changes on {fmtShortDate(pending.requestedAt)}:
          </span>
          {Object.entries(pending.changes).map(([k, v]) => (
            <span key={k} className="font-mono">
              <span style={{ color: "var(--muted)", textDecoration: "line-through" }}>{v?.from || "—"}</span>
              {" → "}
              <span style={{ color: "var(--good)", fontWeight: 600 }}>{v?.to}</span>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10.5px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
            Contact details
          </p>
          {editing ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {EDITABLE_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="block text-[10.5px] mb-0.5" style={{ color: "var(--muted)" }}>
                      {f.label}
                    </label>
                    <input
                      value={form[f.key as EditableLeadField]}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, [f.key]: e.target.value }))
                      }
                      className="w-full px-2 py-1 rounded text-[12.5px] border"
                      style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  className="px-2.5 py-1 rounded text-[12px] text-white"
                  style={{ background: "var(--accent)" }}
                  onClick={handleSave}
                >
                  {isManager ? "Save changes" : "Send for approval"}
                </button>
                <button
                  type="button"
                  className="px-2.5 py-1 rounded text-[12px] border"
                  style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                  {isManager ? "As a manager your edits apply immediately." : "A manager has to approve this before it changes."}
                </span>
              </div>
            </>
          ) : (
            <>
              <dl className="text-[12.5px] space-y-1">
                {EDITABLE_FIELDS.map((f) => (
                  <div key={f.key} className="flex justify-between gap-3">
                    <dt style={{ color: "var(--muted)" }}>{f.label}</dt>
                    <dd style={{ color: "var(--ink)" }}>{lead[f.key as EditableLeadField]}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3">
                  <dt style={{ color: "var(--muted)" }}>Lead ID</dt>
                  <dd style={{ color: "var(--ink)" }}>{lead.id}</dd>
                </div>
              </dl>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {canEdit ? (
                  pending ? (
                    <button type="button" disabled className="px-2.5 py-1 rounded text-[12px] border opacity-50" style={{ borderColor: "var(--grid)" }}>
                      Edit locked — approval pending
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded text-[12px] border"
                      style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
                      onClick={startEdit}
                    >
                      Edit contact details
                    </button>
                  )
                ) : (
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                    View only — this lead isn&apos;t assigned to you.
                  </span>
                )}
                {isManager && (
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded text-[12px]"
                    style={{ border: "1px solid var(--crit)", color: "var(--crit)" }}
                    onClick={() => {
                      if (confirm(`Delete ${lead.name}? This can't be undone.`)) {
                        deleteLead(lead.id);
                        showToast(`${lead.name} deleted`);
                      }
                    }}
                  >
                    Delete lead
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div>
          <p className="text-[10.5px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
            Status
          </p>
          <dl className="text-[12.5px] space-y-1">
            <div className="flex justify-between gap-3">
              <dt style={{ color: "var(--muted)" }}>Priority</dt>
              <dd style={{ color: "var(--ink)" }}>{effectivePriority(lead)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt style={{ color: "var(--muted)" }}>Stage</dt>
              <dd style={{ color: "var(--ink)" }}>{stage?.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt style={{ color: "var(--muted)" }}>Owner</dt>
              <dd style={{ color: "var(--ink)" }}>
                {rep ? rep.name : "Unassigned"}
                {isManager && (
                  <>
                    {" · "}
                    <Link href={`/accounts?account=${encodeURIComponent(lead.account)}`} className="underline" style={{ color: "var(--accent-ink)" }}>
                      manage in Accounts
                    </Link>
                  </>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt style={{ color: "var(--muted)" }}>Next follow-up</dt>
              <dd style={{ color: "var(--ink)" }}>
                {lead.nextFollowup ? fmtFollowup(lead.nextFollowup) : "None scheduled"}
              </dd>
            </div>
            {lead.stage === "won" && (
              <div className="flex justify-between gap-3">
                <dt style={{ color: "var(--muted)" }}>Subscription</dt>
                <dd style={{ color: "var(--ink)" }}>
                  {lead.plan ? `${planById(lead.plan)?.name} · ${fmtInr(leadMrr(lead))}/mo` : "Not recorded"}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10.5px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
          Meetings
        </p>
        {meetings.length ? (
          <div className="space-y-2">
            {meetings.map((m) => (
              <div key={m.id} className="flex gap-3 text-[12px]">
                <span style={{ color: "var(--muted)", minWidth: 110 }}>
                  {fmtFollowup(m.date)}
                  <br />
                  {m.time}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "var(--ink)" }}>{m.mode}</span>
                    <span style={{ color: m.status === "done" ? "var(--good)" : "var(--accent-ink)" }}>
                      {m.status}
                    </span>
                  </div>
                  <div style={{ color: "var(--ink-2)" }}>{m.notes}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: "12px" }}>No meetings logged.</p>
        )}
      </div>

      <div className="mt-4">
        <p className="text-[10.5px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
          Activity
        </p>
        <div className="space-y-2">
          {lead.activity.map((a, i) => (
            <div key={i} className="text-[12px] border-l-2 pl-2" style={{ borderColor: "var(--grid)" }}>
              <div className="flex justify-between">
                <span style={{ color: "var(--ink)" }}>
                  {a.who}
                  {a.method && (
                    <span
                      className="ml-1 px-1 py-0.5 rounded font-mono"
                      style={{ fontSize: "9.5px", background: "var(--surface-2)", color: "var(--muted)" }}
                    >
                      {a.method}
                    </span>
                  )}
                </span>
                <span style={{ color: "var(--muted)" }}>{a.t}</span>
              </div>
              <div style={{ color: "var(--ink-2)" }}>{a.txt}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
