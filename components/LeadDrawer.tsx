"use client";

import { useStore } from "@/lib/store";
import { STAGES, repById } from "@/lib/constants";
import { effectivePriority } from "@/lib/scoring";
import { fmtShortDate, fmtFollowup } from "@/lib/dates";
import { planById, fmtInr } from "@/lib/revenue";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function LeadDrawer({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const lead = useStore((s) => s.leads.find((l) => l.id === leadId));
  if (!lead) return null;
  const rep = repById(lead.assignee);
  const stage = STAGES.find((s) => s.id === lead.stage);
  const priority = effectivePriority(lead);

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end"
      style={{ background: "rgba(0,0,0,.4)" }}
      onClick={onClose}
    >
      <aside
        className="w-full max-w-md h-full overflow-y-auto p-5"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          className="text-[13px] mb-3"
          style={{ color: "var(--muted)" }}
          onClick={onClose}
        >
          ✕ Close
        </button>

        <p className="text-[17px] font-semibold" style={{ color: "var(--ink)" }}>
          {lead.name}
        </p>
        <p className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
          {lead.title} · {lead.account}
        </p>

        <div className="flex items-center gap-2 mt-3">
          <span
            className="px-2 py-0.5 rounded text-[11px] font-mono"
            style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
          >
            {priority}
          </span>
          <span
            className="px-2 py-0.5 rounded text-[11px]"
            style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
          >
            {stage?.name}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-[12.5px]">
          <div>
            <div style={{ color: "var(--muted)" }}>Email</div>
            <div style={{ color: "var(--ink)" }}>{lead.email || "—"}</div>
          </div>
          <div>
            <div style={{ color: "var(--muted)" }}>Phone</div>
            <div style={{ color: "var(--ink)" }}>{lead.phone || "—"}</div>
          </div>
          <div>
            <div style={{ color: "var(--muted)" }}>City</div>
            <div style={{ color: "var(--ink)" }}>{lead.city}</div>
          </div>
          <div>
            <div style={{ color: "var(--muted)" }}>Owner</div>
            <div style={{ color: "var(--ink)" }} className="flex items-center gap-1.5">
              {rep ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-semibold"
                    style={{ background: rep.color }}
                  >
                    {initials(rep.name)}
                  </span>
                  {rep.name}
                </>
              ) : (
                <span style={{ color: "var(--muted)" }}>Unassigned</span>
              )}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--muted)" }}>Next follow-up</div>
            <div style={{ color: "var(--ink)" }}>{lead.nextFollowup ? fmtFollowup(lead.nextFollowup) : "—"}</div>
          </div>
          <div>
            <div style={{ color: "var(--muted)" }}>Created</div>
            <div style={{ color: "var(--ink)" }}>{fmtShortDate(lead.createdAt)}</div>
          </div>
        </div>

        {lead.stage === "won" && lead.plan && (
          <div
            className="mt-4 rounded-md px-3 py-2 text-[12.5px] font-mono"
            style={{ background: "var(--good-soft)", color: "var(--good)" }}
          >
            {planById(lead.plan)?.name} · {fmtInr(lead.plan ? planById(lead.plan)!.mrr : 0)}/mo
          </div>
        )}

        <div className="mt-5">
          <p
            className="text-[10.5px] uppercase tracking-wide mb-2"
            style={{ color: "var(--muted)" }}
          >
            Score reasons
          </p>
          <ul className="text-[12px] space-y-0.5" style={{ color: "var(--ink-2)" }}>
            {lead.scoreReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        <div className="mt-5">
          <p
            className="text-[10.5px] uppercase tracking-wide mb-2"
            style={{ color: "var(--muted)" }}
          >
            Activity
          </p>
          <div className="space-y-2">
            {lead.activity.slice(0, 20).map((a, i) => (
              <div key={i} className="text-[12.5px] border-l-2 pl-2" style={{ borderColor: "var(--grid)" }}>
                <div style={{ color: "var(--ink)" }}>{a.txt}</div>
                <div style={{ color: "var(--muted)", fontSize: "11px" }}>
                  {a.who} · {a.t}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
