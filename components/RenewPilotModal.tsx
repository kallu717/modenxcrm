"use client";

// Extends a pilot that's running out (or already over) without reopening
// the whole subscription window — just a new end date.

import Modal from "@/components/Modal";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { isoPlusDays, fmtShortDate } from "@/lib/dates";
import type { Lead } from "@/lib/types";

const DEFAULT_EXTENSION_DAYS = 30;

export default function RenewPilotModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const renewPilot = useStore((s) => s.renewPilot);
  const showToast = useStore((s) => s.showToast);
  const [newEnd, setNewEnd] = useState(isoPlusDays(lead.pilotEndDate, DEFAULT_EXTENSION_DAYS));
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal onClose={onClose} label={`Renew ${lead.account}'s pilot`} width="max-w-sm">
      <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
        Renew {lead.account}&apos;s pilot
      </h3>
      <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
        Started {lead.pilotStartDate ? fmtShortDate(lead.pilotStartDate) : "—"}, currently set to end{" "}
        {lead.pilotEndDate ? fmtShortDate(lead.pilotEndDate) : "—"}. Pick a new end date to keep it going; the
        follow-up moves with it.
      </p>

      <label className="block mt-4">
        <span className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>
          New pilot end date
        </span>
        <input
          type="date"
          value={newEnd}
          onChange={(e) => {
            setNewEnd(e.target.value);
            setError(null);
          }}
          className="w-full px-2.5 py-1.5 rounded-md text-[13px] border"
          style={{ borderColor: "var(--grid)", color: "var(--ink)", background: "var(--surface)" }}
        />
      </label>

      {error && (
        <p className="text-[12px] mt-2" style={{ color: "var(--crit)" }}>
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 mt-5">
        <button
          type="button"
          className="px-3 py-1.5 rounded-md text-[13px] border"
          style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded-md text-[13px] text-white"
          style={{ background: "var(--accent)" }}
          onClick={() => {
            const err = renewPilot(lead.id, newEnd);
            if (err) {
              setError(err);
              return;
            }
            showToast(`Pilot renewed — now ends ${fmtShortDate(newEnd)}`);
            onClose();
          }}
        >
          Renew pilot
        </button>
      </div>
    </Modal>
  );
}
