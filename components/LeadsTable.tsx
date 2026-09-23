"use client";

import { Fragment, useState } from "react";
import { useStore } from "@/lib/store";
import { STAGES, repById } from "@/lib/constants";
import { effectivePriority } from "@/lib/scoring";
import type { Lead } from "@/lib/types";
import LeadInlineDetail from "./LeadInlineDetail";

const PRIORITY_STYLE: Record<string, { bg: string; fg: string }> = {
  Hot: { bg: "var(--crit-soft)", fg: "var(--p-hot)" },
  Warm: { bg: "var(--warn-soft)", fg: "var(--p-warm)" },
  Nurture: { bg: "var(--accent-soft)", fg: "var(--p-nurture)" },
  Low: { bg: "var(--surface-2)", fg: "var(--muted)" },
};

const STAGE_STYLE: Record<string, { bg: string; fg: string }> = {
  won: { bg: "var(--good-soft)", fg: "var(--good)" },
  lost: { bg: "var(--crit-soft)", fg: "var(--crit)" },
  unqualified: { bg: "var(--surface-2)", fg: "var(--muted)" },
};

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function LeadsTable({ leads }: { leads: Lead[] }) {
  const pendingRequestFor = useStore((s) => s.pendingRequestFor);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--grid)" }}>
            <th className="w-6" />
            <th className="text-left py-2 px-2" style={{ color: "var(--muted)" }}>Priority</th>
            <th className="text-left py-2 px-2" style={{ color: "var(--muted)" }}>Contact</th>
            <th className="text-left py-2 px-2" style={{ color: "var(--muted)" }}>Account</th>
            <th className="text-left py-2 px-2" style={{ color: "var(--muted)" }}>Function</th>
            <th className="text-left py-2 px-2" style={{ color: "var(--muted)" }}>Location</th>
            <th className="text-left py-2 px-2" style={{ color: "var(--muted)" }}>Stage</th>
            <th className="text-left py-2 px-2" style={{ color: "var(--muted)" }}>Assigned to</th>
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center py-8" style={{ color: "var(--muted)" }}>
                No leads match these filters.
              </td>
            </tr>
          )}
          {leads.map((l) => {
            const rep = repById(l.assignee);
            const stage = STAGES.find((s) => s.id === l.stage);
            const open = expandedId === l.id;
            const priority = effectivePriority(l);
            const pStyle = PRIORITY_STYLE[priority];
            const sStyle = STAGE_STYLE[l.stage] || { bg: "var(--accent-soft)", fg: "var(--accent-ink)" };
            const pending = pendingRequestFor(l.id);
            return (
              <Fragment key={l.id}>
                <tr
                  className="cursor-pointer"
                  style={{
                    borderBottom: open ? "none" : "1px solid var(--grid)",
                    background: open ? "var(--accent-soft)" : "transparent",
                  }}
                  onClick={() => setExpandedId(open ? null : l.id)}
                >
                  <td className="py-2 px-2 text-center" style={{ color: "var(--muted)" }}>
                    {open ? "▼" : "▶"}
                  </td>
                  <td className="py-2 px-2">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10.5px] font-mono"
                      style={{ background: pStyle.bg, color: pStyle.fg }}
                    >
                      {priority}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <div style={{ color: "var(--ink)" }}>
                      {l.name}
                      {pending && (
                        <span
                          className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono"
                          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
                        >
                          edit pending
                        </span>
                      )}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "11px" }}>{l.title}</div>
                  </td>
                  <td className="py-2 px-2">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono mr-1"
                      style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                    >
                      {l.type}
                    </span>
                    <span style={{ color: "var(--ink)" }}>{l.account}</span>
                  </td>
                  <td className="py-2 px-2" style={{ color: "var(--ink-2)" }}>{l.title}</td>
                  <td className="py-2 px-2" style={{ color: "var(--ink-2)" }}>{l.city}</td>
                  <td className="py-2 px-2">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10.5px]"
                      style={{ background: sStyle.bg, color: sStyle.fg }}
                    >
                      {stage?.name}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    {rep ? (
                      <span className="flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
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
                  </td>
                </tr>
                {open && (
                  <tr style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td colSpan={8} className="p-0">
                      <LeadInlineDetail lead={l} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
