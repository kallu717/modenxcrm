"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { STAGES, repsList, repById } from "@/lib/constants";
import { RANGE_PRESETS, rangeForPreset, workingRangeForRep } from "@/lib/calendar";
import { computeRepStats, computeFunnel, computeStageAging } from "@/lib/reports";
import { buildAccounts } from "@/lib/accounts";
import { fmtShortDate } from "@/lib/dates";
import { agingBucket, AGING_MAX_DAYS } from "@/lib/revenue";
import type { DateRange } from "@/lib/types";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const AGING_STYLE: Record<string, { bg: string; fg: string }> = {
  ok: { bg: "var(--good-soft)", fg: "var(--good)" },
  caution: { bg: "var(--accent-soft)", fg: "var(--accent-ink)" },
  warn: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  crit: { bg: "var(--crit-soft)", fg: "var(--crit)" },
};

const thStyle = { color: "var(--muted)" } as const;
const tdStyle = { color: "var(--ink)" } as const;

export default function ReportsPage() {
  const leads = useStore((s) => s.leads);
  const isManager = useStore((s) => s.isManager());
  const companyHolidays = useStore((s) => s.companyHolidays);
  const repLeaves = useStore((s) => s.repLeaves);
  const targets = useStore((s) => s.targets);
  const setRepTarget = useStore((s) => s.setRepTarget);
  const assignAccount = useStore((s) => s.assignAccount);

  const [rangePreset, setRangePreset] = useState("30d");
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);
  const [pipelineMode, setPipelineMode] = useState<"snapshot" | "entered">("snapshot");
  const [agingFilter, setAgingFilter] = useState<"stuck" | "all">("stuck");

  const range: DateRange = useMemo(
    () => rangeForPreset(rangePreset, customFrom, customTo),
    [rangePreset, customFrom, customTo]
  );
  const reps = repsList();

  const rangeLabelLower = useMemo(() => {
    const p = RANGE_PRESETS.find((x) => x.id === rangePreset);
    return rangePreset === "custom" ? "the selected range" : "the " + (p?.label || "").toLowerCase();
  }, [rangePreset]);

  const repStats = useMemo(
    () => reps.map((r) => ({ rep: r, stats: computeRepStats(leads, r.id, range) })),
    [reps, leads, range]
  );

  const funnel = useMemo(() => computeFunnel(leads, range), [leads, range]);
  const stageAging = useMemo(() => computeStageAging(leads), [leads]);

  const leaderboard = useMemo(
    () =>
      [...repStats].sort(
        (a, b) => b.stats.onboardings - a.stats.onboardings || b.stats.calls - a.stats.calls
      ),
    [repStats]
  );

  const accountAging = useMemo(() => {
    return buildAccounts(leads)
      .filter((a) => a.agingDays != null)
      .filter((a) => agingFilter === "all" || (a.agingDays ?? 0) >= 60)
      .sort((a, b) => (b.agingDays ?? 0) - (a.agingDays ?? 0));
  }, [leads, agingFilter]);

  if (!isManager) {
    return (
      <div className="py-8 text-center" style={{ color: "var(--muted)" }}>
        Reports are visible to managers only.
      </div>
    );
  }

  return (
    <div className="py-5">
      <h1 className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
        Reports
      </h1>
      <p className="text-[12.5px] mt-0.5 mb-4" style={{ color: "var(--muted)" }}>
        Manager view — pipeline performance and rep targets. Not visible to reps.
      </p>

      <div className="flex items-center gap-1 flex-wrap mb-1">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="px-2.5 py-1 rounded-md text-[12px]"
            style={{
              background: rangePreset === p.id ? "var(--accent-soft)" : "transparent",
              color: rangePreset === p.id ? "var(--accent-ink)" : "var(--ink-2)",
            }}
            onClick={() => setRangePreset(p.id)}
          >
            {p.label}
          </button>
        ))}
        {rangePreset === "custom" && (
          <>
            <input
              type="date"
              value={customFrom || ""}
              onChange={(e) => setCustomFrom(e.target.value || null)}
              className="px-2 py-1 rounded-md text-[12px] border"
              style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
            />
            <input
              type="date"
              value={customTo || ""}
              onChange={(e) => setCustomTo(e.target.value || null)}
              className="px-2 py-1 rounded-md text-[12px] border"
              style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
            />
          </>
        )}
        <span className="font-mono ml-1" style={{ fontSize: "11px", color: "var(--muted)" }}>
          {range.days ? `${range.days} day${range.days === 1 ? "" : "s"} · ${fmtShortDate(range.from!)} – ${fmtShortDate(range.to)}` : "Pick a start date"}
        </span>
      </div>

      {/* Pipeline snapshot/entered */}
      <section className="mt-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
            Pipeline by rep
          </p>
          <div className="flex gap-1">
            {(["snapshot", "entered"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className="px-2.5 py-1 rounded-md text-[12px]"
                style={{
                  background: pipelineMode === m ? "var(--accent-soft)" : "transparent",
                  color: pipelineMode === m ? "var(--accent-ink)" : "var(--ink-2)",
                }}
                onClick={() => setPipelineMode(m)}
              >
                {m === "snapshot" ? "Snapshot" : "Entered in range"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11.5px] mt-0.5 mb-2" style={{ color: "var(--muted)" }}>
          {pipelineMode === "snapshot"
            ? "How many of each rep's leads sit in each stage right now — not affected by the range above."
            : "How many of each rep's leads entered each stage during the selected range."}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--grid)" }}>
                <th className="text-left py-1.5 px-2" style={thStyle}>Rep</th>
                {STAGES.map((s) => (
                  <th key={s.id} className="text-left py-1.5 px-2" style={thStyle}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {repStats.map(({ rep, stats }) => {
                const counts = pipelineMode === "snapshot" ? stats.stageSnapshot : stats.stageEntered;
                return (
                  <tr key={rep.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td className="py-1.5 px-2 flex items-center gap-1.5" style={tdStyle}>
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-semibold"
                        style={{ background: rep.color }}
                      >
                        {initials(rep.name)}
                      </span>
                      {rep.name}
                    </td>
                    {STAGES.map((s) => (
                      <td key={s.id} className="py-1.5 px-2" style={tdStyle}>{counts[s.id]}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Targets & activity */}
      <section className="mt-6">
        <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Targets &amp; activity</p>
        <p className="text-[11.5px] mt-0.5 mb-2" style={{ color: "var(--muted)" }}>
          Uses each rep&apos;s working days — weekends, company holidays, and their approved leave are excluded.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--grid)" }}>
                <th className="text-left py-1.5 px-2" style={thStyle}>Rep</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Target / day</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Target for range</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Calls made</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>WhatsApp</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Email</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Onboardings</th>
              </tr>
            </thead>
            <tbody>
              {reps.map((r) => {
                const wRange = workingRangeForRep(r.id, rangePreset, customFrom, customTo, companyHolidays, repLeaves);
                const stats = computeRepStats(leads, r.id, wRange);
                const perDay = targets[r.id]?.callsPerDay ?? 8;
                const periodTarget = wRange.workingDays != null ? perDay * wRange.workingDays : null;
                const callPct = periodTarget ? Math.round((stats.calls / periodTarget) * 100) : 0;
                return (
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
                    <td className="py-1.5 px-2">
                      <input
                        type="number"
                        min={0}
                        value={perDay}
                        onChange={(e) => setRepTarget(r.id, Number(e.target.value))}
                        className="w-14 px-1.5 py-0.5 rounded border text-[12px]"
                        style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
                      />
                      <span className="ml-1" style={{ color: "var(--muted)", fontSize: "11px" }}>/ day</span>
                    </td>
                    <td className="py-1.5 px-2" style={tdStyle}>
                      {periodTarget != null ? (
                        <>
                          {periodTarget}
                          <div style={{ color: "var(--muted)", fontSize: "10.5px" }}>
                            {perDay} × {wRange.workingDays} working day{wRange.workingDays === 1 ? "" : "s"}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2" style={tdStyle}>
                      {stats.calls}
                      {periodTarget ? (
                        <span className="ml-1.5 font-mono" style={{ fontSize: "10.5px", color: callPct >= 100 ? "var(--good)" : "var(--muted)" }}>
                          {callPct}%
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 px-2" style={tdStyle}>{stats.whatsapp}</td>
                    <td className="py-1.5 px-2" style={tdStyle}>{stats.email}</td>
                    <td className="py-1.5 px-2" style={tdStyle}>{stats.onboardings}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Leaderboard + Funnel side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <section>
          <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Leaderboard</p>
          <p className="text-[11.5px] mt-0.5 mb-2" style={{ color: "var(--muted)" }}>
            Ranked by onboardings — {rangeLabelLower}. Recurring revenue lives on the Revenue tab.
          </p>
          <div className="space-y-2">
            {leaderboard.map(({ rep, stats }, i) => (
              <div
                key={rep.id}
                className="flex items-center gap-3 rounded-lg p-3"
                style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}
              >
                <span
                  className="font-mono text-[13px] font-semibold w-6"
                  style={{ color: i === 0 ? "var(--warn)" : "var(--muted)" }}
                >
                  #{i + 1}
                </span>
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                  style={{ background: rep.color }}
                >
                  {initials(rep.name)}
                </span>
                <span className="text-[13px]" style={{ color: "var(--ink)" }}>{rep.name}</span>
                <div className="ml-auto flex gap-4 text-center">
                  <div>
                    <b className="block text-[13px]" style={{ color: "var(--ink)" }}>{stats.onboardings}</b>
                    <span style={{ fontSize: "9.5px", color: "var(--muted)" }}>Onboardings</span>
                  </div>
                  <div>
                    <b className="block text-[13px]" style={{ color: "var(--ink)" }}>{stats.calls}</b>
                    <span style={{ fontSize: "9.5px", color: "var(--muted)" }}>Calls</span>
                  </div>
                  <div>
                    <b className="block text-[13px]" style={{ color: "var(--ink)" }}>{stats.whatsapp + stats.email}</b>
                    <span style={{ fontSize: "9.5px", color: "var(--muted)" }}>Msgs</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Funnel</p>
          <p className="text-[11.5px] mt-0.5 mb-2" style={{ color: "var(--muted)" }}>
            Cohort view — assigned leads created in {rangeLabelLower}, and how far each has progressed since.
          </p>
          <div className="space-y-2">
            {funnel.map((row, i) => (
              <div key={row.stage.id}>
                <div className="flex items-center gap-2">
                  <span className="w-24 text-[12px] shrink-0" style={{ color: "var(--ink-2)" }}>{row.stage.name}</span>
                  <div className="flex-1 h-4 rounded" style={{ background: "var(--surface-2)" }}>
                    <div
                      className="h-4 rounded"
                      style={{ width: `${row.pct}%`, background: row.stage.dot }}
                    />
                  </div>
                  <span className="text-[12px] w-16 text-right" style={{ color: "var(--ink)" }}>
                    {row.count} <span style={{ color: "var(--muted)" }}>of {funnel[0].count}</span>
                  </span>
                </div>
                {i > 0 && row.convPct != null && (
                  <div className="text-[10.5px] ml-[104px] mt-0.5" style={{ color: "var(--muted)" }}>
                    {row.convPct}% converted from {funnel[i - 1].stage.name}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Stage aging (lead-level, open pipeline only) */}
      <section className="mt-6">
        <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Time in stage</p>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--grid)" }}>
                <th className="text-left py-1.5 px-2" style={thStyle}>Stage</th>
                <th className="text-left py-1.5 px-2" style={thStyle}># Leads</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Avg days in stage</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Oldest (days)</th>
              </tr>
            </thead>
            <tbody>
              {stageAging.map((r) => (
                <tr key={r.stage.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td className="py-1.5 px-2 flex items-center gap-1.5" style={tdStyle}>
                    <span className="w-2 h-2 rounded-full" style={{ background: r.stage.dot }} />
                    {r.stage.name}
                  </td>
                  <td className="py-1.5 px-2" style={tdStyle}>{r.count}</td>
                  <td className="py-1.5 px-2" style={tdStyle}>{r.avg}</td>
                  <td className="py-1.5 px-2" style={tdStyle}>{r.max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Account aging */}
      <section className="mt-6 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Account aging</p>
          <div className="flex gap-1">
            {(["stuck", "all"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className="px-2.5 py-1 rounded-md text-[12px]"
                style={{
                  background: agingFilter === f ? "var(--accent-soft)" : "transparent",
                  color: agingFilter === f ? "var(--accent-ink)" : "var(--ink-2)",
                }}
                onClick={() => setAgingFilter(f)}
              >
                {f === "stuck" ? "Stuck 60+ days" : "All open accounts"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--grid)" }}>
                <th className="text-left py-1.5 px-2" style={thStyle}>Account</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Owner — reassign here</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Stage stuck at</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Days</th>
                <th className="text-left py-1.5 px-2" style={thStyle}>Bucket</th>
              </tr>
            </thead>
            <tbody>
              {accountAging.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6" style={{ color: "var(--muted)" }}>
                    {agingFilter === "stuck" ? "Nothing stuck 60+ days right now." : "No open accounts."}
                  </td>
                </tr>
              )}
              {accountAging.map((a) => {
                const bucket = agingBucket(a.agingDays);
                const style = bucket ? AGING_STYLE[bucket.cls] : null;
                const stage = STAGES.find((s) => s.id === a.furthest);
                return (
                  <tr key={a.name} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td className="py-1.5 px-2" style={tdStyle}>{a.name}</td>
                    <td className="py-1.5 px-2">
                      <select
                        aria-label={`Reassign ${a.name}`}
                        value={a.owner || ""}
                        onChange={(e) => assignAccount(a.name, e.target.value || null)}
                        className="px-2 py-1 rounded-md text-[12px] border"
                        style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
                      >
                        <option value="">Unassigned</option>
                        {reps.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10.5px]"
                        style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                      >
                        {stage?.name}
                      </span>
                    </td>
                    <td className="py-1.5 px-2" style={tdStyle}>{a.agingDays}d</td>
                    <td className="py-1.5 px-2">
                      {style && bucket && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10.5px] font-mono"
                          style={{ background: style.bg, color: style.fg }}
                        >
                          {bucket.label}
                          {(a.agingDays ?? 0) >= AGING_MAX_DAYS ? " · reassign" : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
