"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { repsList, repById } from "@/lib/constants";
import { needsRevenueDetails } from "@/lib/revenue";
import {
  PLANS,
  fmtInr,
  leadMrr,
  planById,
  currentQuarter,
  recentQuarters,
  quarterKey,
  quarterLabel,
  quarterRangeLabel,
  quarterRevenue,
  billedMonthsInQuarter,
} from "@/lib/revenue";
import { fmtShortDate } from "@/lib/dates";
import WonModal from "@/components/WonModal";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const thStyle = { color: "var(--muted)" } as const;
const tdStyle = { color: "var(--ink)" } as const;

export default function RevenuePage() {
  const leads = useStore((s) => s.leads);
  const isManager = useStore((s) => s.isManager());
  const [revQuarter, setRevQuarter] = useState(currentQuarter());
  const [fixLead, setFixLead] = useState<string | null>(null);

  const subs = useMemo(() => leads.filter((l) => l.stage === "won" && l.plan), [leads]);
  const missing = useMemo(() => leads.filter(needsRevenueDetails), [leads]);
  const { y, q } = revQuarter;

  const quarters = useMemo(() => recentQuarters(6), []);
  const isCurrentQ = y === currentQuarter().y && q === currentQuarter().q;

  const mrr = subs.reduce((s, l) => s + leadMrr(l), 0);
  const qRevenue = quarterRevenue(subs, y, q);
  const billingInQ = subs.filter((l) => billedMonthsInQuarter(l.mandateDate, y, q) > 0).length;
  const startedInQ = subs.filter((l) => {
    if (!l.mandateDate) return false;
    const d = new Date(l.mandateDate + "T00:00:00");
    return d.getFullYear() === y && Math.floor(d.getMonth() / 3) + 1 === q;
  }).length;

  const trend = quarters.map((x) => ({ ...x, rev: quarterRevenue(subs, x.y, x.q) }));
  const maxRev = Math.max(1, ...trend.map((t) => t.rev));

  const byRep = repsList()
    .map((r) => {
      const mine = subs.filter((l) => l.assignee === r.id);
      const repMrr = mine.reduce((s, l) => s + leadMrr(l), 0);
      const repQ = quarterRevenue(mine, y, q);
      return { r, mine, repMrr, repQ, pct: qRevenue ? Math.round((repQ / qRevenue) * 100) : 0 };
    })
    .sort((a, b) => b.repQ - a.repQ);

  const planRows = PLANS.map((p) => {
    const inPlan = subs.filter((l) => l.plan === p.id);
    return { p, count: inPlan.length, mrr: inPlan.length * p.mrr };
  });
  const maxPlanMrr = Math.max(1, ...planRows.map((x) => x.mrr));

  const topSubs = [...subs].sort(
    (a, b) => leadMrr(b) - leadMrr(a) || a.account.localeCompare(b.account)
  );

  const fixLeadObj = fixLead ? leads.find((l) => l.id === fixLead) : null;

  if (!isManager) {
    return (
      <div className="py-8 text-center" style={{ color: "var(--muted)" }}>
        Revenue is visible to managers only.
      </div>
    );
  }

  return (
    <div className="py-5">
      <h1 className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
        Revenue
      </h1>
      <p className="text-[12.5px] mt-0.5 mb-4" style={{ color: "var(--muted)" }}>
        Recurring subscription revenue from every onboarded account — a live book, not a period
        total.
      </p>

      {missing.length > 0 && (
        <div
          className="flex items-center gap-3 flex-wrap rounded-lg px-3 py-2.5 mb-5"
          style={{ background: "var(--warn-soft)", border: "1px solid var(--warn)" }}
        >
          <span className="font-mono text-[12px]" style={{ color: "var(--warn)" }}>
            ⚠ {missing.length}
          </span>
          <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
            <b style={{ color: "var(--ink)" }}>
              {missing.length} won account{missing.length === 1 ? " has" : "s have"} no subscription
              recorded.
            </b>{" "}
            Their revenue isn&apos;t counted anywhere below until a plan and mandate date are added.
          </span>
          <button
            type="button"
            className="ml-auto px-2.5 py-1 rounded text-[12px] border"
            style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
            onClick={() => setFixLead(missing[0].id)}
          >
            Add details — {missing[0].account}
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap mb-1">
        {quarters.map((x) => {
          const sel = x.y === y && x.q === q;
          return (
            <button
              key={quarterKey(x.y, x.q)}
              type="button"
              className="px-2.5 py-1 rounded-md text-[12px]"
              style={{
                background: sel ? "var(--accent-soft)" : "transparent",
                color: sel ? "var(--accent-ink)" : "var(--ink-2)",
              }}
              onClick={() => setRevQuarter({ y: x.y, q: x.q })}
            >
              {quarterLabel(x.y, x.q)}
            </button>
          );
        })}
        <span className="font-mono ml-1" style={{ fontSize: "11px", color: "var(--muted)" }}>
          {quarterRangeLabel(y, q)}
          {isCurrentQ ? " · in progress" : ""}
        </span>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <div className="rounded-lg p-3" style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontSize: "10.5px", color: "var(--muted)" }}>{quarterLabel(y, q)} billed</p>
          <p className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>{fmtInr(qRevenue)}</p>
          <p style={{ fontSize: "10.5px", color: "var(--muted)" }}>
            {billingInQ} mandate{billingInQ === 1 ? "" : "s"} billing{isCurrentQ ? " · so far" : ""}
          </p>
        </div>
        <div className="rounded-lg p-3" style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontSize: "10.5px", color: "var(--muted)" }}>Current MRR</p>
          <p className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>{fmtInr(mrr)}</p>
          <p style={{ fontSize: "10.5px", color: "var(--muted)" }}>
            {subs.length} active subscription{subs.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-lg p-3" style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontSize: "10.5px", color: "var(--muted)" }}>Run rate per quarter</p>
          <p className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>{fmtInr(mrr * 3)}</p>
          <p style={{ fontSize: "10.5px", color: "var(--muted)" }}>MRR × 3 at today&apos;s book</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}>
          <p style={{ fontSize: "10.5px", color: "var(--muted)" }}>New mandates in {quarterLabel(y, q)}</p>
          <p className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>{startedInQ}</p>
          <p style={{ fontSize: "10.5px", color: "var(--muted)" }}>
            {missing.length ? `${missing.length} awaiting details` : "all won deals recorded"}
          </p>
        </div>
      </div>

      {/* Quarterly trend + plan mix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <section>
          <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Quarterly trend</p>
          <div className="space-y-2 mt-2">
            {trend.map((t) => {
              const sel = t.y === y && t.q === q;
              return (
                <div key={quarterKey(t.y, t.q)} className="flex items-center gap-2">
                  <span className="w-24 shrink-0" style={{ fontSize: "11.5px", color: "var(--ink-2)" }}>
                    {quarterLabel(t.y, t.q)}
                    <br />
                    <span style={{ color: "var(--muted)", fontSize: "10px" }}>{quarterRangeLabel(t.y, t.q)}</span>
                  </span>
                  <div className="flex-1 h-4 rounded" style={{ background: "var(--surface-2)" }}>
                    <div
                      className="h-4 rounded"
                      style={{ width: `${Math.round((t.rev / maxRev) * 100)}%`, background: "var(--accent)", opacity: sel ? 1 : 0.4 }}
                    />
                  </div>
                  <span className="text-[12px] w-20 text-right" style={{ color: "var(--ink)" }}>{fmtInr(t.rev)}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Plan mix</p>
          <div className="space-y-2 mt-2">
            {planRows.map(({ p, count, mrr: planMrr }) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="w-24 shrink-0" style={{ fontSize: "11.5px", color: "var(--ink-2)" }}>
                  {p.name}
                  <br />
                  <span style={{ color: "var(--muted)", fontSize: "10px" }}>{fmtInr(p.mrr)}/mo</span>
                </span>
                <div className="flex-1 h-4 rounded" style={{ background: "var(--surface-2)" }}>
                  <div
                    className="h-4 rounded"
                    style={{ width: `${Math.round((planMrr / maxPlanMrr) * 100)}%`, background: "var(--accent)" }}
                  />
                </div>
                <span className="text-[12px] w-28 text-right" style={{ color: "var(--ink)" }}>
                  {fmtInr(planMrr)} <span style={{ color: "var(--muted)" }}>· {count} acct</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* By rep */}
      <section className="mt-6">
        <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
          Subscription book by rep — {quarterLabel(y, q)}
        </p>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--grid)" }}>
                <th className="text-left py-1.5 px-2" style={thStyle}>Rep</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Active accounts</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>MRR</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Billed in {quarterLabel(y, q)}</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Share of quarter</th>
              </tr>
            </thead>
            <tbody>
              {byRep.map(({ r, mine, repMrr, repQ, pct }) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td className="py-1.5 px-2 flex items-center gap-1.5" style={tdStyle}>
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-semibold"
                      style={{ background: r.color }}
                    >
                      {initials(r.name)}
                    </span>
                    {r.name}
                  </td>
                  <td className="py-1.5 px-2" style={tdStyle}>{mine.length}</td>
                  <td className="py-1.5 px-2" style={tdStyle}>{fmtInr(repMrr)}</td>
                  <td className="py-1.5 px-2" style={tdStyle}>{fmtInr(repQ)}</td>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 rounded" style={{ background: "var(--surface-2)" }}>
                        <div className="h-2 rounded" style={{ width: `${pct}%`, background: "var(--accent)" }} />
                      </div>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Every subscription */}
      <section className="mt-6 mb-8">
        <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Every subscription</p>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--grid)" }}>
                <th className="text-left py-1.5 px-2" style={thStyle}>Account</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Contact</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Type</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Plan</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Owner</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Mandate from</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>MRR</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Billed in {quarterLabel(y, q)}</th>
              </tr>
            </thead>
            <tbody>
              {topSubs.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-6" style={{ color: "var(--muted)" }}>
                    No active subscriptions yet.
                  </td>
                </tr>
              )}
              {topSubs.map((l) => {
                const rep = repById(l.assignee);
                const months = billedMonthsInQuarter(l.mandateDate, y, q);
                return (
                  <tr key={l.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td className="py-1.5 px-2" style={tdStyle}>{l.account}</td>
                    <td className="py-1.5 px-2" style={tdStyle}>{l.name}</td>
                    <td className="py-1.5 px-2">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                        style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                      >
                        {l.type}
                      </span>
                    </td>
                    <td className="py-1.5 px-2" style={tdStyle}>{planById(l.plan)?.name}</td>
                    <td className="py-1.5 px-2">
                      {rep ? (
                        <span className="flex items-center gap-1.5" style={tdStyle}>
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
                    <td className="py-1.5 px-2 font-mono" style={{ color: "var(--muted)", fontSize: "11.5px" }}>
                      {fmtShortDate(l.mandateDate!)}
                    </td>
                    <td className="py-1.5 px-2" style={tdStyle}>{fmtInr(leadMrr(l))}</td>
                    <td className="py-1.5 px-2" style={tdStyle}>
                      {months ? (
                        <>
                          {fmtInr(leadMrr(l) * months)}{" "}
                          <span style={{ color: "var(--muted)", fontSize: "11px" }}>· {months} mo</span>
                        </>
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
      </section>

      {fixLeadObj && <WonModal lead={fixLeadObj} onClose={() => setFixLead(null)} />}
    </div>
  );
}
