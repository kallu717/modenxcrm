"use client";

// Hover card (after the shadcn/ui "Hover Card"): rest the mouse on, or tab to,
// a person's name to see what they own: contacts, accounts and cities. Only
// counts what the viewer can already see.

import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { repById } from "@/lib/constants";
import { ROLE_LABELS } from "@/lib/types";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function OwnerHoverCard({ repId, children }: { repId: string | null; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leads = useStore((s) => s.leads);
  const rep = repById(repId);

  const stats = useMemo(() => {
    if (!open || !rep) return null;
    const mine = leads.filter((l) => l.assignee === rep.id);
    const accounts = new Set(mine.map((l) => l.account.toLowerCase()));
    const cities = [...new Set(mine.map((l) => l.city).filter((c) => c && c !== "—"))].sort();
    const won = mine.filter((l) => l.stage === "won").length;
    return { contacts: mine.length, accounts: accounts.size, cities, won };
  }, [open, rep, leads]);

  if (!rep) return <>{children}</>;

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 250);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {open && stats && (
        <span
          role="tooltip"
          className="fx-hovercard absolute left-0 top-[calc(100%+6px)] z-50 w-[240px] rounded-lg border p-3 text-left"
          style={{ background: "var(--surface)", borderColor: "var(--grid)", boxShadow: "var(--shadow-lg)", pointerEvents: "none" }}
        >
          <span className="flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0"
              style={{ background: rep.color }}
            >
              {initials(rep.name)}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                {rep.name}
              </span>
              <span className="block text-[11px]" style={{ color: "var(--muted)" }}>
                {ROLE_LABELS[rep.role]}
              </span>
            </span>
          </span>
          <span className="grid grid-cols-3 gap-1 mt-3 text-center">
            {[
              [stats.contacts, "contacts"],
              [stats.accounts, "accounts"],
              [stats.won, "won"],
            ].map(([n, label]) => (
              <span key={label} className="rounded-md py-1.5" style={{ background: "var(--surface-2)" }}>
                <span className="block text-[14px] font-semibold tabular-nums" style={{ color: "var(--ink)" }}>
                  {n}
                </span>
                <span className="block text-[10px]" style={{ color: "var(--muted)" }}>
                  {label}
                </span>
              </span>
            ))}
          </span>
          {stats.cities.length > 0 && (
            <span className="block mt-2.5 text-[11px] leading-snug" style={{ color: "var(--ink-2)" }}>
              {stats.cities.slice(0, 6).join(", ")}
              {stats.cities.length > 6 ? ` +${stats.cities.length - 6} more` : ""}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
