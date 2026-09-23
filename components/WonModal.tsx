"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { PLANS, fmtInr } from "@/lib/revenue";
import { isoToday } from "@/lib/dates";
import type { Lead } from "@/lib/types";

export default function WonModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const setLeadPlan = useStore((s) => s.setLeadPlan);
  const showToast = useStore((s) => s.showToast);
  const [chosen, setChosen] = useState<string | null>(lead.plan);
  const [mandateDate, setMandateDate] = useState(lead.mandateDate || isoToday());

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl p-5"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
          {lead.account} — subscription details
        </h3>
        <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
          {lead.name} is marked Won. Pick the plan they signed up on; a monthly auto-debit mandate
          starts from the date below.
        </p>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex flex-col items-start gap-1 rounded-lg border p-3 text-left"
              style={{
                borderColor: chosen === p.id ? "var(--accent)" : "var(--grid)",
                background: chosen === p.id ? "var(--accent-soft)" : "transparent",
              }}
              onClick={() => setChosen(p.id)}
            >
              <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                {p.name}
              </span>
              <span className="text-[13px] font-mono" style={{ color: "var(--accent-ink)" }}>
                {fmtInr(p.mrr)}
                <small style={{ color: "var(--muted)" }}>/mo</small>
              </span>
              <span className="text-[10.5px]" style={{ color: "var(--muted)" }}>
                {fmtInr(p.mrr * 3)}/quarter
              </span>
            </button>
          ))}
        </div>

        <label className="block mt-4">
          <span className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>
            Mandate start date
          </span>
          <input
            type="date"
            value={mandateDate}
            onChange={(e) => setMandateDate(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-md text-[13px] border"
            style={{ borderColor: "var(--grid)", color: "var(--ink)", background: "var(--surface)" }}
          />
        </label>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-[13px] border"
            style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
            onClick={onClose}
          >
            Add later
          </button>
          <button
            type="button"
            disabled={!chosen}
            className="px-3 py-1.5 rounded-md text-[13px] text-white disabled:opacity-40"
            style={{ background: "var(--accent)" }}
            onClick={() => {
              if (!chosen) return;
              setLeadPlan(lead.id, chosen, mandateDate || isoToday());
              const p = PLANS.find((x) => x.id === chosen);
              if (p) showToast(`${p.name} · ${fmtInr(p.mrr)}/mo mandate created`);
              onClose();
            }}
          >
            Save subscription
          </button>
        </div>
      </div>
    </div>
  );
}
