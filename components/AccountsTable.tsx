"use client";

import { useStore } from "@/lib/store";
import { STAGES, repById } from "@/lib/constants";
import { planById, fmtInr, leadMrr, agingBucket } from "@/lib/revenue";
import type { AccountSummary } from "@/lib/accounts";

const PRIORITY_STYLE: Record<string, { bg: string; fg: string }> = {
  Hot: { bg: "var(--crit-soft)", fg: "var(--p-hot)" },
  Warm: { bg: "var(--warn-soft)", fg: "var(--p-warm)" },
  Nurture: { bg: "var(--accent-soft)", fg: "var(--p-nurture)" },
  Low: { bg: "var(--surface-2)", fg: "var(--muted)" },
};

const AGING_STYLE: Record<string, { bg: string; fg: string }> = {
  ok: { bg: "var(--good-soft)", fg: "var(--good)" },
  caution: { bg: "var(--accent-soft)", fg: "var(--accent-ink)" },
  warn: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  crit: { bg: "var(--crit-soft)", fg: "var(--crit)" },
};

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function AccountsTable({
  accounts,
  onOpen,
}: {
  accounts: AccountSummary[];
  onOpen: (name: string) => void;
}) {
  const pendingAccountRequestFor = useStore((s) => s.pendingAccountRequestFor);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--grid)" }}>
            <th className="text-left py-2 px-2" style={{ color: "var(--muted)" }}>Account</th>
            <th className="text-left py-2 px-2" style={{ color: "var(--muted)" }}>Contacts</th>
            <th className="text-left py-2 px-2" style={{ color: "var(--muted)" }}>Functions covered</th>
            <th className="text-left py-2 px-2" style={{ color: "var(--muted)" }}>Furthest stage</th>
            <th className="text-left py-2 px-2" style={{ color: "var(--muted)" }}>Priority</th>
            <th className="text-left py-2 px-2" style={{ color: "var(--muted)" }}>Owner</th>
            <th className="text-left py-2 px-2" style={{ color: "var(--muted)" }}>Stuck for</th>
            <th className="text-left py-2 px-2" style={{ color: "var(--muted)" }}>Subscription</th>
          </tr>
        </thead>
        <tbody>
          {accounts.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center py-8" style={{ color: "var(--muted)" }}>
                No accounts match these filters.
              </td>
            </tr>
          )}
          {accounts.map((a) => {
            const stage = STAGES.find((s) => s.id === a.furthest);
            const owner = repById(a.owner);
            const pStyle = PRIORITY_STYLE[a.priority];
            const bucket = agingBucket(a.agingDays);
            const aStyle = bucket ? AGING_STYLE[bucket.cls] : null;
            const pending = pendingAccountRequestFor(a.name);
            return (
              <tr
                key={a.name}
                className="cursor-pointer"
                style={{ borderBottom: "1px solid var(--grid)" }}
                onClick={() => onOpen(a.name)}
              >
                <td className="py-2 px-2">
                  <div style={{ color: "var(--ink)" }}>
                    {a.name}
                    {pending && (
                      <span
                        className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono"
                        style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
                      >
                        edit pending
                      </span>
                    )}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: "11px" }}>
                    {a.domain} · {a.cities.join(", ")}
                  </div>
                </td>
                <td className="py-2 px-2" style={{ color: "var(--ink-2)" }}>{a.contacts.length}</td>
                <td className="py-2 px-2">
                  <div className="flex flex-wrap gap-1">
                    {a.functions.slice(0, 3).map((f) => (
                      <span
                        key={f}
                        className="px-1.5 py-0.5 rounded text-[10.5px]"
                        style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
                      >
                        {f}
                      </span>
                    ))}
                    {a.functions.length > 3 && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10.5px]"
                        style={{ background: "var(--surface-2)", color: "var(--muted)" }}
                      >
                        +{a.functions.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10.5px]"
                    style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                  >
                    {stage?.name}
                  </span>
                </td>
                <td className="py-2 px-2">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10.5px] font-mono"
                    style={{ background: pStyle.bg, color: pStyle.fg }}
                  >
                    {a.priority}
                  </span>
                </td>
                <td className="py-2 px-2">
                  {owner ? (
                    <span className="flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-semibold"
                        style={{ background: owner.color }}
                      >
                        {initials(owner.name)}
                      </span>
                      {owner.name}
                    </span>
                  ) : (
                    <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Unassigned</span>
                  )}
                </td>
                <td className="py-2 px-2">
                  {bucket && aStyle ? (
                    <span
                      className="px-1.5 py-0.5 rounded text-[10.5px] font-mono"
                      style={{ background: aStyle.bg, color: aStyle.fg }}
                    >
                      {a.agingDays}d
                    </span>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  )}
                </td>
                <td className="py-2 px-2">
                  {a.subscription ? (
                    <span className="font-mono" style={{ color: "var(--good)" }}>
                      {planById(a.subscription.plan)?.name} · {fmtInr(leadMrr(a.subscription))}/mo
                    </span>
                  ) : a.needsSub ? (
                    <span style={{ color: "var(--warn)" }}>⚠ Needed</span>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
