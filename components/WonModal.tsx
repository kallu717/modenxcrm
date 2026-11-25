"use client";

import Modal from "@/components/Modal";
import { celebrate, originOf } from "@/lib/confetti";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PLANS, PILOT_PLAN_ID, fmtInr } from "@/lib/revenue";
import { isoToday, isoPlusDays, fmtShortDate } from "@/lib/dates";
import type { Lead } from "@/lib/types";

const DEFAULT_PILOT_DAYS = 30;

export default function WonModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const setLeadPlan = useStore((s) => s.setLeadPlan);
  const setLeadPilot = useStore((s) => s.setLeadPilot);
  const showToast = useStore((s) => s.showToast);
  const [chosen, setChosen] = useState<string | null>(lead.plan);
  const [mandateDate, setMandateDate] = useState(lead.mandateDate || isoToday());
  const [pilotStart, setPilotStart] = useState(lead.pilotStartDate || isoToday());
  const [pilotEnd, setPilotEnd] = useState(lead.pilotEndDate || isoPlusDays(isoToday(), DEFAULT_PILOT_DAYS));

  const isPilot = chosen === PILOT_PLAN_ID;
  const pilotDatesOk = !!pilotStart && !!pilotEnd && pilotEnd > pilotStart;
  const canSave = isPilot ? pilotDatesOk : !!chosen;

  const save = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!canSave) return;
    celebrate(originOf(e.currentTarget));
    if (isPilot) {
      setLeadPilot(lead.id, pilotStart, pilotEnd);
      showToast(`Pilot started — a follow-up is set for ${fmtShortDate(pilotEnd)} to add the real subscription`);
    } else if (chosen) {
      setLeadPlan(lead.id, chosen, mandateDate || isoToday());
      const p = PLANS.find((x) => x.id === chosen);
      if (p) showToast(`${p.name} · ${fmtInr(p.mrr)}/mo mandate created`);
    }
    onClose();
  };

  return (
    <Modal onClose={onClose} label={`${lead.account}: subscription details`} width="max-w-md">
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
          {lead.account} — subscription details
        </h3>
        <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
          {lead.name} is marked Won. Pick the plan they signed up on, or start a pilot first; a
          monthly auto-debit mandate starts from the date below.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <button
            type="button"
            className="flex flex-col items-start gap-1 rounded-lg border p-3 text-left"
            style={{
              borderColor: isPilot ? "var(--accent)" : "var(--grid)",
              background: isPilot ? "var(--accent-soft)" : "transparent",
            }}
            onClick={() => setChosen(PILOT_PLAN_ID)}
          >
            <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
              Pilot
            </span>
            <span className="text-[13px] font-mono" style={{ color: "var(--muted)" }}>
              Not billed
            </span>
            <span className="text-[10.5px]" style={{ color: "var(--muted)" }}>
              Trial period
            </span>
          </button>
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

        {isPilot ? (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <label className="block">
              <span className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>
                Pilot start date
              </span>
              <input
                type="date"
                value={pilotStart}
                onChange={(e) => setPilotStart(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md text-[13px] border"
                style={{ borderColor: "var(--grid)", color: "var(--ink)", background: "var(--surface)" }}
              />
            </label>
            <label className="block">
              <span className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>
                Pilot end date
              </span>
              <input
                type="date"
                value={pilotEnd}
                onChange={(e) => setPilotEnd(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md text-[13px] border"
                style={{ borderColor: "var(--grid)", color: "var(--ink)", background: "var(--surface)" }}
              />
            </label>
            {!pilotDatesOk && (
              <p className="col-span-2 text-[11.5px]" style={{ color: "var(--crit)" }}>
                The end date must be after the start date.
              </p>
            )}
            <p className="col-span-2 text-[11.5px]" style={{ color: "var(--muted)" }}>
              When the pilot ends, {lead.name} comes up as a follow-up for{" "}
              {lead.assignee ? "the assigned rep" : "whoever owns this account"} to add real subscription details.
            </p>
          </div>
        ) : (
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
        )}

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
            disabled={!canSave}
            className="px-3 py-1.5 rounded-md text-[13px] text-white disabled:opacity-40"
            style={{ background: "var(--accent)" }}
            onClick={save}
          >
            Save subscription
          </button>
        </div>
    </Modal>
  );
}
