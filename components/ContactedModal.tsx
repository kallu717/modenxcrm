"use client";

import Modal from "@/components/Modal";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { isoToday, isoPlusDays, nextWeekday, fmtFollowup } from "@/lib/dates";
import type { Lead } from "@/lib/types";

export default function ContactedModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const markContacted = useStore((s) => s.markContacted);
  const [custom, setCustom] = useState("");

  const presets: { label: string; iso: string }[] = [
    { label: "Today", iso: isoToday() },
    { label: "Tomorrow", iso: isoPlusDays(isoToday(), 1) },
    { label: "This Fri", iso: nextWeekday(5) },
    { label: "+1 week", iso: isoPlusDays(isoToday(), 7) },
  ];

  const showToast = useStore((s) => s.showToast);

  const finish = (iso: string) => {
    markContacted(lead.id, iso);
    showToast("Next follow-up: " + fmtFollowup(iso));
    onClose();
  };

  return (
    <Modal onClose={onClose} label={`Log ${lead.name} as contacted`} width="max-w-sm">
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
          Log {lead.name} as contacted
        </h3>
        <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
          Before this clears, set the next follow-up. If there&apos;s nothing more to do here, move the stage to
          Unqualified or Lost instead of leaving it with no follow-up.
        </p>

        <div className="grid grid-cols-2 gap-2 mt-4">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className="px-2.5 py-1.5 rounded-md text-[12.5px] border text-left"
              style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
              onClick={() => finish(p.iso)}
            >
              {p.label}
              <span className="block" style={{ fontSize: "10.5px", color: "var(--muted)" }}>
                {fmtFollowup(p.iso)}
              </span>
            </button>
          ))}
          <input
            type="date"
            aria-label="Custom follow-up date"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              if (e.target.value) finish(e.target.value);
            }}
            className="col-span-2 px-2.5 py-1.5 rounded-md text-[12.5px] border"
            style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
          />
        </div>

        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-[13px] border"
            style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
    </Modal>
  );
}
