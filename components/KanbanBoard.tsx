"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { STAGES, repById } from "@/lib/constants";
import { effectivePriority } from "@/lib/scoring";
import { fmtFollowup } from "@/lib/dates";
import { planById, fmtInr, needsRevenueDetails } from "@/lib/revenue";
import type { Lead, Stage } from "@/lib/types";
import WonModal from "./WonModal";
import LeadDrawer from "./LeadDrawer";

const CARD_CAP = 8;

const PRIORITY_STYLE: Record<string, { bg: string; fg: string }> = {
  Hot: { bg: "var(--crit-soft)", fg: "var(--p-hot)" },
  Warm: { bg: "var(--warn-soft)", fg: "var(--p-warm)" },
  Nurture: { bg: "var(--accent-soft)", fg: "var(--p-nurture)" },
  Low: { bg: "var(--surface-2)", fg: "var(--muted)" },
};

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function nextMeeting(l: Lead) {
  return (
    l.meetings.filter((m) => m.status === "scheduled").sort((a, b) => (a.date < b.date ? -1 : 1))[0] ||
    null
  );
}

function LeadCard({
  lead,
  onDragStart,
  onOpen,
}: {
  lead: Lead;
  onDragStart: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const rep = repById(lead.assignee);
  const mtg = nextMeeting(lead);
  const priority = effectivePriority(lead);
  const pStyle = PRIORITY_STYLE[priority];

  return (
    <div
      draggable
      onDragStart={(e) => {
        onDragStart(lead.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(lead.id)}
      className="rounded-lg border p-3 mb-2 cursor-pointer select-none"
      style={{ background: "var(--surface)", borderColor: "var(--grid)", boxShadow: "var(--shadow)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
            {lead.name}
          </div>
          <div className="text-[11.5px] flex items-center gap-1 mt-0.5" style={{ color: "var(--ink-2)" }}>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-mono"
              style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
            >
              {lead.type}
            </span>
            <span className="truncate">{lead.account}</span>
          </div>
        </div>
        <span
          className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono"
          style={{ background: pStyle.bg, color: pStyle.fg }}
        >
          {priority}
        </span>
      </div>
      <div className="font-mono mt-1.5" style={{ fontSize: "10.5px", color: "var(--muted)" }}>
        {lead.title} · {lead.city}
      </div>
      {mtg && (
        <div
          className="mt-1.5 rounded px-1.5 py-1 font-mono w-fit"
          style={{ fontSize: "10.5px", background: "var(--accent-soft)", color: "var(--accent-ink)" }}
        >
          {fmtFollowup(mtg.date)} · {mtg.time} · {mtg.mode}
        </div>
      )}
      {needsRevenueDetails(lead) ? (
        <div
          className="mt-1.5 rounded px-1.5 py-1 font-mono w-fit"
          style={{ fontSize: "10.5px", background: "var(--warn-soft)", color: "var(--warn)" }}
        >
          ⚠ Subscription needed
        </div>
      ) : lead.stage === "won" && lead.plan ? (
        <div
          className="mt-1.5 rounded px-1.5 py-1 font-mono w-fit"
          style={{ fontSize: "10.5px", background: "var(--good-soft)", color: "var(--good)" }}
        >
          {planById(lead.plan)?.name} · {fmtInr(lead.plan ? planById(lead.plan)!.mrr : 0)}/mo
        </div>
      ) : null}
      {rep && (
        <div className="flex items-center gap-1.5 mt-2">
          <span
            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-semibold"
            style={{ background: rep.color }}
          >
            {initials(rep.name)}
          </span>
          <span style={{ fontSize: "11px", color: "var(--ink-2)" }}>{rep.name}</span>
        </div>
      )}
    </div>
  );
}

export default function KanbanBoard({ leads }: { leads: Lead[] }) {
  const setLeadStage = useStore((s) => s.setLeadStage);
  const showToast = useStore((s) => s.showToast);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Stage | null>(null);
  const [expanded, setExpanded] = useState<Set<Stage>>(new Set());
  const [wonModalLead, setWonModalLead] = useState<Lead | null>(null);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const assigned = leads.filter((l) => l.assignee);

  return (
    <>
      <div className="grid grid-flow-col auto-cols-[260px] gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const items = assigned
            .filter((l) => l.stage === stage.id)
            .sort((a, b) => b.score - a.score);
          const isExpanded = expanded.has(stage.id);
          const visible = isExpanded ? items : items.slice(0, CARD_CAP);
          const remainder = items.length - visible.length;

          return (
            <div
              key={stage.id}
              className="rounded-lg border flex flex-col"
              style={{
                background: "var(--surface-2)",
                borderColor: dragOverStage === stage.id ? "var(--accent)" : "var(--grid)",
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage.id);
              }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStage(null);
                if (!dragId) return;
                const lead = leads.find((l) => l.id === dragId);
                if (lead && lead.stage !== stage.id) {
                  setLeadStage(lead.id, stage.id, "board");
                  if (stage.id === "won" && !lead.plan) {
                    setWonModalLead({ ...lead, stage: stage.id });
                  } else {
                    showToast(`${lead.name} → ${stage.name}`);
                  }
                }
                setDragId(null);
              }}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: stage.dot }}
                />
                <span className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
                  {stage.name}
                </span>
                <span
                  className="ml-auto font-mono"
                  style={{ fontSize: "10.5px", color: "var(--muted)" }}
                >
                  {items.length}
                </span>
              </div>
              <div className="px-2 pb-2 flex-1">
                {visible.map((l) => (
                  <LeadCard key={l.id} lead={l} onDragStart={setDragId} onOpen={setOpenLeadId} />
                ))}
                {remainder > 0 && (
                  <button
                    type="button"
                    className="w-full text-center py-1.5 text-[11.5px]"
                    style={{ color: "var(--accent-ink)" }}
                    onClick={() => setExpanded((s) => new Set(s).add(stage.id))}
                  >
                    Show {remainder} more, sorted by score ↓
                  </button>
                )}
                {isExpanded && items.length > CARD_CAP && (
                  <button
                    type="button"
                    className="w-full text-center py-1.5 text-[11.5px]"
                    style={{ color: "var(--muted)" }}
                    onClick={() =>
                      setExpanded((s) => {
                        const next = new Set(s);
                        next.delete(stage.id);
                        return next;
                      })
                    }
                  >
                    Show fewer
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {wonModalLead && <WonModal lead={wonModalLead} onClose={() => setWonModalLead(null)} />}
      {openLeadId && <LeadDrawer leadId={openLeadId} onClose={() => setOpenLeadId(null)} />}
    </>
  );
}
