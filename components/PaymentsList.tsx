"use client";

import { useStore } from "@/lib/store";
import { repById } from "@/lib/constants";
import { daysUntil, fmtDueIn } from "@/lib/dates";
import { fmtInr, leadMrr, planById, type DuePayment } from "@/lib/revenue";
import { initials } from "@/components/OwnerSelect";

// One row per monthly debit: when, which account, how much, whose. "Mark
// paid" takes it off every list; "Log reminder" only notes the nudge.
export default function PaymentsList({
  due,
  onOpenLead,
  limit,
}: {
  due: DuePayment[];
  onOpenLead: (id: string) => void;
  limit?: number;
}) {
  const markPaid = useStore((s) => s.markPaid);
  const logPaymentReminder = useStore((s) => s.logPaymentReminder);
  const showToast = useStore((s) => s.showToast);
  const shown = limit ? due.slice(0, limit) : due;
  const btn = "px-2.5 py-1 rounded text-[12px] border shrink-0";

  return (
    <div className="space-y-2">
      {shown.map(({ id, lead, date, status, reminded }) => {
        const rep = repById(lead.assignee);
        const urgent = status !== "upcoming" || daysUntil(date) <= 1;
        return (
          <div
            key={id}
            className="flex items-center gap-3 rounded-lg p-3 cursor-pointer flex-wrap"
            style={{
              background: "var(--surface)",
              boxShadow: "var(--shadow)",
              borderLeft: urgent ? "3px solid var(--crit)" : "3px solid transparent",
            }}
            onClick={() => onOpenLead(lead.id)}
          >
            <span
              className="font-mono text-[11.5px] w-32 shrink-0"
              style={{ color: urgent ? "var(--crit)" : "var(--muted)" }}
            >
              {fmtDueIn(date)}
            </span>
            <div className="flex-1 min-w-[180px] flex items-center gap-2 flex-wrap text-[12.5px]">
              <span style={{ color: "var(--ink)" }}>{lead.account}</span>
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
              {reminded && (
                <span className="px-1.5 py-0.5 rounded text-[10.5px]" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
                  Reminder sent
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {!reminded && (
                <button
                  type="button"
                  className={btn}
                  style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    logPaymentReminder(lead.id, date);
                    showToast("Reminder logged for " + lead.account);
                  }}
                >
                  Log reminder
                </button>
              )}
              <button
                type="button"
                className={btn}
                style={{ borderColor: "var(--good)", color: "var(--good)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  markPaid(lead.id, date);
                  showToast(`${lead.account}: ${fmtInr(leadMrr(lead))} marked paid`);
                }}
              >
                Mark paid
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
