"use client";

// Every dashboard widget. Each one reads what it needs from the store and
// renders inside a <Frame>, which adds the title and the edit controls.
// Widgets only ever show what the person can already see elsewhere: the
// store holds just their own leads (reps) or everyone's (managers).

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { STAGES, repById, sellersList } from "@/lib/constants";
import { fmtFollowup, fmtShortDate, isoPlusDays, isoToday, to12h } from "@/lib/dates";
import { accountHref } from "@/lib/accounts";
import {
  billedThisMonth, collectedThisMonth, duePayments, fmtInr, leadMrr, planById, revenueByMonth,
} from "@/lib/revenue";
import { computeFunnel } from "@/lib/reports";
import { effectivePriority } from "@/lib/scoring";
import {
  approvalsWaiting, callsToday, daysOff, followupsDue, followupsThisWeek, hotWithoutNextStep, leaderboard,
  monthBounds, myActivity, myRequests, noNextStep, notContactedYet, pipelineByStage, recentlyAssigned,
  rosterCounts, stuckLocations, teamToday, unownedCities, upcomingMeetings, wonMissingPlan, wonThisMonth,
} from "@/lib/dashboard";
import { initials } from "@/components/OwnerSelect";
import PaymentsList from "@/components/PaymentsList";
import type { Lead } from "@/lib/types";
import type { WidgetId } from "@/lib/widgets";
import Frame from "./Frame";

// Opening a contact or logging a call happens on the page, not in a widget.
export const DashboardActions = createContext<{ openLead: (id: string) => void; contacted: (l: Lead) => void }>({
  openLead: () => {},
  contacted: () => {},
});

const PRIORITY_STYLE: Record<string, { bg: string; fg: string }> = {
  Hot: { bg: "var(--crit-soft)", fg: "var(--p-hot)" },
  Warm: { bg: "var(--warn-soft)", fg: "var(--p-warm)" },
  Nurture: { bg: "var(--accent-soft)", fg: "var(--p-nurture)" },
  Low: { bg: "var(--surface-2)", fg: "var(--p-low)" },
};

const rowCls = "flex items-center gap-3 py-2 border-t first:border-t-0";
const rowStyle = { borderColor: "var(--grid)" };

function useMine() {
  const leads = useStore((s) => s.leads);
  const me = useStore((s) => s.currentUserId);
  return useMemo(() => leads.filter((l) => l.assignee === me), [leads, me]);
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12.5px] py-2" style={{ color: "var(--muted)" }}>
      {children}
    </p>
  );
}

function Tile({ label, value, sub, tone, href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "crit" | "warn" | "good"; href?: string }) {
  const body = (
    <div className="rounded-lg p-3 h-full" style={{ background: "var(--surface-2)", borderTop: `3px solid ${tone ? `var(--${tone})` : "var(--grid)"}` }}>
      <p className="text-[11px] uppercase tracking-wide font-mono" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <p className="text-[22px] font-semibold mt-1 leading-none" style={{ color: tone ? `var(--${tone})` : "var(--ink)" }}>
        {value}
      </p>
      {sub && (
        <div className="text-[11.5px] mt-1" style={{ color: "var(--ink-2)" }}>
          {sub}
        </div>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

function Tiles({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2 h-full" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>{children}</div>;
}

function Progress({ done, target }: { done: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: done >= target ? "var(--good)" : "var(--accent)" }} />
    </div>
  );
}

function Bar({ value, max, color = "var(--accent)" }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-2 rounded-full overflow-hidden flex-1" style={{ background: "var(--surface-2)" }}>
      <div className="h-full rounded-full" style={{ width: `${max ? Math.round((value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

function Avatar({ id }: { id: string | null }) {
  const rep = repById(id);
  if (!rep) return null;
  return (
    <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-semibold shrink-0" style={{ background: rep.color }}>
      {initials(rep.name)}
    </span>
  );
}

function LeadRow({ lead, when, late, action }: { lead: Lead; when?: string; late?: boolean; action?: React.ReactNode }) {
  const { openLead } = useContext(DashboardActions);
  const p = effectivePriority(lead);
  const ps = PRIORITY_STYLE[p];
  return (
    <div className={rowCls + " cursor-pointer"} style={rowStyle} onClick={() => openLead(lead.id)}>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] truncate" style={{ color: "var(--ink)" }}>
          {lead.name} <span style={{ color: "var(--muted)" }}>· {lead.account}</span>
        </p>
        <p className="text-[11.5px] truncate" style={{ color: late ? "var(--crit)" : "var(--ink-2)" }}>
          {when ? when + " · " : ""}
          {lead.title}
          {lead.city ? ` · ${lead.city}` : ""}
        </p>
      </div>
      <span className="px-1.5 py-0.5 rounded text-[10.5px] font-mono shrink-0" style={{ background: ps.bg, color: ps.fg }}>
        {p}
      </span>
      {action}
    </div>
  );
}

function LeadList({ leads, when, empty, late }: { leads: Lead[]; when?: (l: Lead) => string | undefined; empty: string; late?: (l: Lead) => boolean }) {
  if (!leads.length) return <Empty>{empty}</Empty>;
  return (
    <>
      {leads.map((l) => (
        <LeadRow key={l.id} lead={l} when={when?.(l)} late={late?.(l)} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------- my work

function Glance() {
  const mine = useMine();
  const isManager = useStore((s) => s.isManager());
  const leads = useStore((s) => s.leads);
  const payments = useStore((s) => s.payments);
  const reminders = useStore((s) => s.paymentReminders);
  const fu = useMemo(() => followupsDue(mine), [mine]);
  const meetings = useMemo(() => upcomingMeetings(mine), [mine]);
  const due = useMemo(() => duePayments(isManager ? leads : mine, payments, reminders), [isManager, leads, mine, payments, reminders]);
  const total = due.reduce((s, d) => s + leadMrr(d.lead), 0);
  return (
    <Frame>
      <Tiles>
        <Tile label="Overdue" value={fu.overdue.length} sub="follow-ups late" tone={fu.overdue.length ? "crit" : undefined} href="/followups" />
        <Tile label="Today" value={fu.today.length} sub="follow-ups due" tone={fu.today.length ? "warn" : undefined} href="/followups" />
        <Tile label="Meetings" value={meetings.length} sub="next 7 days" href="/calendar" />
        <Tile
          label="Payments due"
          value={due.length}
          sub={due.length ? fmtInr(total) : "nothing to collect"}
          tone={due.some((d) => d.status === "overdue") ? "crit" : undefined}
          href="/followups"
        />
      </Tiles>
    </Frame>
  );
}

function Followups() {
  const mine = useMine();
  const { contacted } = useContext(DashboardActions);
  const fu = useMemo(() => followupsDue(mine), [mine]);
  const rows = [...fu.overdue, ...fu.today];
  return (
    <Frame count={rows.length} more={{ href: "/followups", label: "All follow-ups" }}>
      {rows.length ? (
        rows.map((l) => (
          <LeadRow
            key={l.id}
            lead={l}
            when={fmtFollowup(l.nextFollowup)}
            late={fu.overdue.includes(l)}
            action={
              <button
                type="button"
                className="px-2.5 py-1 rounded text-[12px] border shrink-0"
                style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  contacted(l);
                }}
              >
                Contacted
              </button>
            }
          />
        ))
      ) : (
        <Empty>Nothing overdue or due today. Nice.</Empty>
      )}
    </Frame>
  );
}

function Meetings() {
  const mine = useMine();
  const { openLead } = useContext(DashboardActions);
  const meetings = useMemo(() => upcomingMeetings(mine), [mine]);
  return (
    <Frame count={meetings.length} more={{ href: "/calendar", label: "Calendar" }}>
      {meetings.length ? (
        meetings.map(({ lead, meeting }) => (
          <div key={lead.id + meeting.id} className={rowCls + " cursor-pointer"} style={rowStyle} onClick={() => openLead(lead.id)}>
            <div className="w-[88px] shrink-0">
              <p className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
                {fmtFollowup(meeting.date).split(" · ")[0]}
              </p>
              <p className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>
                {meeting.time ? to12h(meeting.time) : "—"}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] truncate" style={{ color: "var(--ink)" }}>
                {lead.name} <span style={{ color: "var(--muted)" }}>· {lead.account}</span>
              </p>
              <p className="text-[11.5px] truncate" style={{ color: "var(--ink-2)" }}>
                {meeting.mode}
                {meeting.notes ? ` · ${meeting.notes}` : ""}
              </p>
            </div>
          </div>
        ))
      ) : (
        <Empty>No meetings booked for the next 7 days.</Empty>
      )}
    </Frame>
  );
}

function Payments() {
  const mine = useMine();
  const isManager = useStore((s) => s.isManager());
  const leads = useStore((s) => s.leads);
  const payments = useStore((s) => s.payments);
  const reminders = useStore((s) => s.paymentReminders);
  const { openLead } = useContext(DashboardActions);
  const due = useMemo(() => duePayments(isManager ? leads : mine, payments, reminders), [isManager, leads, mine, payments, reminders]);
  return (
    <Frame count={due.length} subtitle={isManager ? "whole team" : undefined} more={{ href: "/followups", label: "Follow-ups" }}>
      {due.length ? <PaymentsList due={due} onOpenLead={openLead} /> : <Empty>No debits due in the next 7 days, and nothing left unpaid.</Empty>}
    </Frame>
  );
}

function Hot() {
  const mine = useMine();
  const rows = useMemo(() => hotWithoutNextStep(mine), [mine]);
  return (
    <Frame count={rows.length}>
      <LeadList leads={rows} when={() => "No follow-up set"} empty="Every hot contact has a next step planned." />
    </Frame>
  );
}

function Fresh() {
  const mine = useMine();
  const rows = useMemo(() => notContactedYet(mine), [mine]);
  return (
    <Frame count={rows.length} more={{ href: "/leads", label: "Leads" }}>
      <LeadList
        leads={rows}
        when={(l) => (l.ownerSince ? `Yours since ${fmtShortDate(l.ownerSince)}` : undefined)}
        empty="You've reached everyone you were given."
      />
    </Frame>
  );
}

function Calls() {
  const leads = useStore((s) => s.leads);
  const me = useStore((s) => s.currentUserId);
  const targets = useStore((s) => s.targets);
  const c = useMemo(() => callsToday(leads, me, targets), [leads, me, targets]);
  return (
    <Frame>
      <p className="text-[26px] font-semibold leading-none" style={{ color: c.done >= c.target ? "var(--good)" : "var(--ink)" }}>
        {c.done}
        <span className="text-[14px] font-normal" style={{ color: "var(--muted)" }}>
          {" "}/ {c.target} calls
        </span>
      </p>
      <div className="mt-2">
        <Progress done={c.done} target={c.target} />
      </div>
    </Frame>
  );
}

const STATUS_STYLE = {
  pending: { bg: "var(--warn-soft)", fg: "var(--warn)", label: "Waiting" },
  approved: { bg: "var(--good-soft)", fg: "var(--good)", label: "Approved" },
  rejected: { bg: "var(--crit-soft)", fg: "var(--crit)", label: "Declined" },
};

function Requests() {
  const leads = useStore((s) => s.leads);
  const me = useStore((s) => s.currentUserId);
  const cr = useStore((s) => s.changeRequests);
  const lr = useStore((s) => s.leaveRequests);
  const rows = useMemo(() => myRequests(cr, lr, leads, me), [cr, lr, leads, me]);
  return (
    <Frame count={rows.length}>
      {rows.length ? (
        rows.map((r) => {
          const st = STATUS_STYLE[r.status];
          return (
            <div key={r.kind + r.id} className={rowCls + " text-[13px]"} style={{ ...rowStyle, color: "var(--ink)" }}>
              <span className="flex-1 truncate">{r.label}</span>
              <span className="px-1.5 py-0.5 rounded text-[10.5px]" style={{ background: st.bg, color: st.fg }}>
                {st.label}
              </span>
            </div>
          );
        })
      ) : (
        <Empty>No requests waiting, and no recent answers.</Empty>
      )}
    </Frame>
  );
}

function Pipeline() {
  const mine = useMine();
  const rows = useMemo(() => pipelineByStage(mine), [mine]);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Frame count={mine.length} more={{ href: "/pipeline", label: "Pipeline" }}>
      {rows.map((r) => {
        const st = STAGES.find((s) => s.id === r.stage)!;
        return (
          <div key={r.stage} className="flex items-center gap-2 py-1 text-[12.5px]" style={{ color: "var(--ink)" }}>
            <span className="w-[96px] shrink-0 truncate">{st.name}</span>
            <Bar value={r.count} max={max} color={st.dot} />
            <span className="w-10 text-right font-mono text-[11.5px]">{r.count}</span>
          </div>
        );
      })}
    </Frame>
  );
}

function Won() {
  const mine = useMine();
  const rows = useMemo(() => wonThisMonth(mine), [mine]);
  const mrr = rows.reduce((s, l) => s + leadMrr(l), 0);
  return (
    <Frame count={rows.length}>
      <p className="text-[26px] font-semibold leading-none" style={{ color: rows.length ? "var(--good)" : "var(--ink)" }}>
        {rows.length}
        <span className="text-[13px] font-normal" style={{ color: "var(--muted)" }}>
          {" "}deal{rows.length === 1 ? "" : "s"} · {fmtInr(mrr)}/month
        </span>
      </p>
      <div className="mt-2">
        {rows.map((l) => (
          <LeadRow key={l.id} lead={l} when={planById(l.plan)?.name || "No plan yet"} />
        ))}
      </div>
    </Frame>
  );
}

function Week() {
  const mine = useMine();
  const rows = useMemo(() => followupsThisWeek(mine), [mine]);
  return (
    <Frame count={rows.length} more={{ href: "/followups", label: "Follow-ups" }}>
      <LeadList leads={rows} when={(l) => fmtFollowup(l.nextFollowup)} empty="Nothing due in the next 7 days." />
    </Frame>
  );
}

function NoStep() {
  const mine = useMine();
  const rows = useMemo(() => noNextStep(mine), [mine]);
  return (
    <Frame count={rows.length}>
      <LeadList
        leads={rows}
        when={(l) => (l.ownerSince ? `Yours since ${fmtShortDate(l.ownerSince)}` : "No follow-up set")}
        empty="Every open contact has a next step."
      />
    </Frame>
  );
}

function Recent() {
  const mine = useMine();
  const rows = useMemo(() => recentlyAssigned(mine), [mine]);
  return (
    <Frame count={rows.length} subtitle="last 14 days">
      <LeadList leads={rows} when={(l) => `Assigned ${fmtShortDate(l.ownerSince!)}`} empty="Nothing new handed to you in the last 2 weeks." />
    </Frame>
  );
}

function Activity() {
  const leads = useStore((s) => s.leads);
  const me = useStore((s) => s.currentUser());
  const { openLead } = useContext(DashboardActions);
  const rows = useMemo(() => myActivity(leads, me.name), [leads, me.name]);
  return (
    <Frame>
      {rows.length ? (
        rows.map((a, i) => (
          <div key={i} className={rowCls + " cursor-pointer items-start"} style={rowStyle} onClick={() => openLead(a.lead.id)}>
            <span className="font-mono text-[11px] w-14 shrink-0 pt-0.5" style={{ color: "var(--muted)" }}>
              {fmtShortDate(a.date)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] truncate" style={{ color: "var(--ink)" }}>
                {a.lead.name} <span style={{ color: "var(--muted)" }}>· {a.lead.account}</span>
              </p>
              <p className="text-[11.5px] line-clamp-2" style={{ color: "var(--ink-2)" }}>
                {a.method ? `${a.method} · ` : ""}
                {a.txt}
              </p>
            </div>
          </div>
        ))
      ) : (
        <Empty>Nothing logged by you yet.</Empty>
      )}
    </Frame>
  );
}

function DayOffList({ repIds, from, to, empty }: { repIds: string[] | null; from: string; to: string; empty: string }) {
  const holidays = useStore((s) => s.companyHolidays);
  const leaves = useStore((s) => s.repLeaves);
  const rows = useMemo(() => daysOff(holidays, leaves, from, to, repIds), [holidays, leaves, from, to, repIds]);
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <>
      {rows.map((d, i) => (
        <div key={i} className={rowCls + " text-[12.5px]"} style={{ ...rowStyle, color: "var(--ink)" }}>
          <span className="font-mono text-[11.5px] w-16 shrink-0" style={{ color: "var(--muted)" }}>
            {fmtShortDate(d.date)}
          </span>
          {d.repId ? <Avatar id={d.repId} /> : null}
          <span className="flex-1 truncate">
            {d.repId ? `${repById(d.repId)?.name || "Someone"} · ` : ""}
            {d.label}
          </span>
          {!d.repId && (
            <span className="px-1.5 py-0.5 rounded text-[10.5px]" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
              Holiday
            </span>
          )}
        </div>
      ))}
    </>
  );
}

function Leave() {
  const me = useStore((s) => s.currentUserId);
  const { from, to } = monthBounds();
  const ids = useMemo(() => [me], [me]);
  return (
    <Frame more={{ href: "/calendar", label: "Calendar" }}>
      <DayOffList repIds={ids} from={from} to={to} empty="No holidays or leave this month." />
    </Frame>
  );
}

// ---------------------------------------------------------------- team

function TeamGlance() {
  const leads = useStore((s) => s.leads);
  const cr = useStore((s) => s.changeRequests);
  const lr = useStore((s) => s.leaveRequests);
  const payments = useStore((s) => s.payments);
  const a = useMemo(() => approvalsWaiting(cr, lr), [cr, lr]);
  const unowned = useMemo(() => unownedCities(leads), [leads]);
  const stuck = useMemo(() => stuckLocations(leads), [leads]);
  const billed = useMemo(() => billedThisMonth(leads), [leads]);
  const contacts = unowned.reduce((n, c) => n + c.contacts, 0);
  const month = new Date().toLocaleDateString("en-IN", { month: "long" });
  return (
    <Frame>
      <Tiles>
        <Tile label="Approvals" value={a.edits + a.leave} sub={`${a.edits} edits · ${a.leave} leave`} tone={a.edits + a.leave ? "warn" : undefined} href="/followups" />
        <Tile label="No owner" value={unowned.length} sub={`cities · ${contacts.toLocaleString("en-IN")} contacts`} tone={unowned.length ? "warn" : undefined} href="/accounts" />
        <Tile label="Stuck 60+ days" value={stuck.length} sub="locations" tone={stuck.length ? "crit" : undefined} href="/reports" />
        <Tile label={`Revenue · ${month}`} value={fmtInr(billed)} sub={`${fmtInr(collectedThisMonth(payments))} marked paid`} href="/revenue" />
      </Tiles>
    </Frame>
  );
}

function TeamToday() {
  const leads = useStore((s) => s.leads);
  const targets = useStore((s) => s.targets);
  const holidays = useStore((s) => s.companyHolidays);
  const leaves = useStore((s) => s.repLeaves);
  const rows = useMemo(() => teamToday(leads, sellersList(leads), targets, holidays, leaves), [leads, targets, holidays, leaves]);
  return (
    <Frame count={rows.length} more={{ href: "/reports", label: "Reports" }}>
      {rows.length ? (
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left font-mono text-[10.5px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              <th className="py-1.5 font-normal">Person</th>
              <th className="py-1.5 font-normal w-[34%]">Calls today</th>
              <th className="py-1.5 font-normal text-right">Overdue</th>
              <th className="py-1.5 font-normal text-right">Meetings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.rep.id} className="border-t" style={{ borderColor: "var(--grid)", color: "var(--ink)" }}>
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <Avatar id={t.rep.id} />
                    <span className="truncate">
                      {t.rep.name}
                      {t.away && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10.5px]" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
                          {t.away}
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span className="font-mono text-[11.5px]">
                    {t.calls} / {t.target}
                  </span>
                  <Progress done={t.calls} target={t.target} />
                </td>
                <td className="py-2 text-right font-mono" style={{ color: t.overdue ? "var(--crit)" : "var(--muted)" }}>
                  {t.overdue}
                </td>
                <td className="py-2 text-right font-mono">{t.meetingsToday}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty>No one on the sales team yet.</Empty>
      )}
    </Frame>
  );
}

function Unowned() {
  const leads = useStore((s) => s.leads);
  const rows = useMemo(() => unownedCities(leads), [leads]);
  return (
    <Frame count={rows.length} more={{ href: "/accounts", label: "Accounts" }}>
      {rows.length ? (
        rows.slice(0, 60).map((c) => (
          <Link key={c.account + c.cityKey} href={accountHref(c.account)} className={rowCls + " text-[13px]"} style={{ ...rowStyle, color: "var(--ink)" }}>
            <span className="flex-1 truncate">
              {c.account} <span style={{ color: "var(--muted)" }}>· {c.city}</span>
            </span>
            <span className="font-mono text-[11.5px]" style={{ color: "var(--ink-2)" }}>
              {c.contacts}
            </span>
            <span className="text-[12px]" style={{ color: "var(--accent)" }}>
              Assign →
            </span>
          </Link>
        ))
      ) : (
        <Empty>Every city has an owner.</Empty>
      )}
    </Frame>
  );
}

function Stuck() {
  const leads = useStore((s) => s.leads);
  const rows = useMemo(() => stuckLocations(leads), [leads]);
  return (
    <Frame count={rows.length} more={{ href: "/reports", label: "Reports" }}>
      {rows.length ? (
        rows.map((s) => (
          <Link key={s.account + (s.city || "")} href={accountHref(s.account)} className={rowCls + " text-[13px]"} style={{ ...rowStyle, color: "var(--ink)" }}>
            <span className="flex-1 truncate">
              {s.account}
              {s.city && <span style={{ color: "var(--muted)" }}> · {s.city}</span>}
            </span>
            <span className="text-[12px] truncate" style={{ color: "var(--ink-2)" }}>
              {repById(s.owner)?.name || "No owner"}
            </span>
            <span className="font-mono text-[11.5px] w-16 text-right" style={{ color: "var(--crit)" }}>
              {s.days} days
            </span>
          </Link>
        ))
      ) : (
        <Empty>Nothing has been stuck for 60 days.</Empty>
      )}
    </Frame>
  );
}

function Approvals() {
  const leads = useStore((s) => s.leads);
  const cr = useStore((s) => s.changeRequests);
  const lr = useStore((s) => s.leaveRequests);
  const applyChangeRequest = useStore((s) => s.applyChangeRequest);
  const decideLeaveRequest = useStore((s) => s.decideLeaveRequest);
  const showToast = useStore((s) => s.showToast);
  const edits = cr.filter((c) => c.status === "pending");
  const leave = lr.filter((r) => r.status === "pending");
  const btn = "px-2 py-0.5 rounded text-[11.5px] border shrink-0";
  const decide = (yes: boolean, run: () => void, what: string) => {
    run();
    showToast(`${what} ${yes ? "approved" : "declined"}`);
  };
  const buttons = (onYes: () => void, onNo: () => void) => (
    <>
      <button type="button" className={btn} style={{ borderColor: "var(--good)", color: "var(--good)" }} onClick={onYes}>
        Approve
      </button>
      <button type="button" className={btn} style={{ borderColor: "var(--grid)", color: "var(--ink-2)" }} onClick={onNo}>
        Decline
      </button>
    </>
  );
  return (
    <Frame count={edits.length + leave.length} more={{ href: "/followups", label: "Details" }}>
      {!edits.length && !leave.length && <Empty>Nothing waiting for you.</Empty>}
      {edits.map((c) => {
        const what = c.scope === "account" ? c.accountName : leads.find((l) => l.id === c.leadId)?.name || "a contact";
        const fields = Object.entries(c.changes)
          .map(([k, v]) => `${k}: ${v?.from || "—"} → ${v?.to || "—"}`)
          .join(", ");
        return (
          <div key={c.id} className={rowCls + " text-[12.5px]"} style={{ ...rowStyle, color: "var(--ink)" }}>
            <Avatar id={c.requestedBy} />
            <div className="flex-1 min-w-0">
              <p className="truncate">Edit to {what}</p>
              <p className="text-[11.5px] truncate" style={{ color: "var(--ink-2)" }}>
                {fields}
              </p>
            </div>
            {buttons(
              () => decide(true, () => applyChangeRequest(c.id, true), "Edit"),
              () => decide(false, () => applyChangeRequest(c.id, false), "Edit")
            )}
          </div>
        );
      })}
      {leave.map((r) => (
        <div key={r.id} className={rowCls + " text-[12.5px]"} style={{ ...rowStyle, color: "var(--ink)" }}>
          <Avatar id={r.repId} />
          <div className="flex-1 min-w-0">
            <p className="truncate">
              {repById(r.repId)?.name || "Someone"} · leave on {fmtShortDate(r.date)}
            </p>
            {r.reason && (
              <p className="text-[11.5px] truncate" style={{ color: "var(--ink-2)" }}>
                {r.reason}
              </p>
            )}
          </div>
          {buttons(
            () => decide(true, () => decideLeaveRequest(r.id, true), "Leave"),
            () => decide(false, () => decideLeaveRequest(r.id, false), "Leave")
          )}
        </div>
      ))}
    </Frame>
  );
}

function Leaderboard() {
  const leads = useStore((s) => s.leads);
  const rows = useMemo(() => leaderboard(leads, sellersList(leads)), [leads]);
  const maxCalls = Math.max(1, ...rows.map((r) => r.calls));
  return (
    <Frame subtitle="this month" more={{ href: "/reports", label: "Reports" }}>
      {rows.length ? (
        rows.map((r, i) => (
          <div key={r.rep.id} className={rowCls + " text-[12.5px]"} style={{ ...rowStyle, color: "var(--ink)" }}>
            <span className="font-mono text-[11.5px] w-4" style={{ color: "var(--muted)" }}>
              {i + 1}
            </span>
            <Avatar id={r.rep.id} />
            <span className="w-[110px] truncate">{r.rep.name}</span>
            <Bar value={r.calls} max={maxCalls} />
            <span className="font-mono text-[11.5px] w-[110px] text-right">
              <b style={{ color: r.wins ? "var(--good)" : "var(--ink)" }}>{r.wins}</b> won · {r.calls} calls
            </span>
          </div>
        ))
      ) : (
        <Empty>No one on the sales team yet.</Empty>
      )}
    </Frame>
  );
}

function Funnel() {
  const leads = useStore((s) => s.leads);
  const rows = useMemo(() => computeFunnel(leads, { from: isoPlusDays(isoToday(), -90), to: isoToday(), days: 90 }), [leads]);
  return (
    <Frame subtitle="added in the last 90 days" more={{ href: "/reports", label: "Reports" }}>
      {rows.map((r) => (
        <div key={r.stage.id} className="flex items-center gap-2 py-1 text-[12.5px]" style={{ color: "var(--ink)" }}>
          <span className="w-[96px] shrink-0 truncate">{r.stage.name}</span>
          <Bar value={r.pct} max={100} color={r.stage.dot} />
          <span className="w-12 text-right font-mono text-[11.5px]">{r.count}</span>
          <span className="w-12 text-right font-mono text-[11px]" style={{ color: "var(--muted)" }}>
            {r.convPct != null ? `${r.convPct}%` : ""}
          </span>
        </div>
      ))}
    </Frame>
  );
}

function Revenue() {
  const leads = useStore((s) => s.leads);
  const rows = useMemo(() => revenueByMonth(leads), [leads]);
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <Frame more={{ href: "/revenue", label: "Revenue" }}>
      <div className="flex items-end gap-2 h-[calc(100%-8px)] min-h-[120px] pt-4">
        {rows.map((r) => (
          <div key={r.month} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <span className="font-mono text-[10.5px]" style={{ color: "var(--ink-2)" }}>
              {r.amount ? fmtInr(r.amount) : ""}
            </span>
            <div
              className="w-full rounded-t"
              title={`${r.label}: ${fmtInr(r.amount)}`}
              style={{ height: `${Math.max(2, Math.round((r.amount / max) * 75))}%`, background: r.amount ? "var(--accent)" : "var(--surface-2)" }}
            />
            <span className="text-[11px]" style={{ color: "var(--muted)" }}>
              {r.label}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function LeaveWeek() {
  const from = isoToday();
  return (
    <Frame subtitle="next 7 days" more={{ href: "/calendar", label: "Calendar" }}>
      <DayOffList repIds={null} from={from} to={isoPlusDays(from, 7)} empty="Everyone's in this week." />
    </Frame>
  );
}

function MissingPlan() {
  const leads = useStore((s) => s.leads);
  const rows = useMemo(() => wonMissingPlan(leads), [leads]);
  return (
    <Frame count={rows.length} more={{ href: "/revenue", label: "Revenue" }}>
      <LeadList
        leads={rows}
        when={(l) => (l.wonAt ? `Won ${fmtShortDate(l.wonAt)} · ${!l.plan ? "no plan" : "no start date"}` : "No plan")}
        empty="Every won deal has a plan and start date."
      />
    </Frame>
  );
}

// ---------------------------------------------------------------- admin

function Access() {
  const [waiting, setWaiting] = useState<number | null>(null);
  useEffect(() => {
    api
      .adminUsers()
      .then((people) => setWaiting(people.filter((p) => p.role === "Pending").length))
      .catch(() => setWaiting(null));
  }, []);
  return (
    <Frame more={{ href: "/settings", label: "Settings" }}>
      {waiting == null ? (
        <Empty>Checking…</Empty>
      ) : waiting ? (
        <p className="text-[13px]" style={{ color: "var(--ink)" }}>
          <b>{waiting}</b> {waiting === 1 ? "person has" : "people have"} signed in and need a role.
        </p>
      ) : (
        <Empty>No one is waiting. New people appear here after they first sign in.</Empty>
      )}
    </Frame>
  );
}

function Roster() {
  const reps = useStore((s) => s.reps);
  const rows = useMemo(() => rosterCounts(reps), [reps]);
  const label = { Rep: "Sales reps", Manager: "Managers", Admin: "Admins", Pending: "No access" };
  return (
    <Frame more={{ href: "/settings", label: "Settings" }}>
      <Tiles>
        {rows.map((r) => (
          <Tile key={r.role} label={label[r.role]} value={r.count} />
        ))}
      </Tiles>
    </Frame>
  );
}

export const WIDGET_COMPONENTS: Record<WidgetId, () => React.ReactNode> = {
  glance: Glance,
  followups: Followups,
  meetings: Meetings,
  payments: Payments,
  hot: Hot,
  fresh: Fresh,
  calls: Calls,
  requests: Requests,
  pipeline: Pipeline,
  won: Won,
  week: Week,
  nostep: NoStep,
  recent: Recent,
  activity: Activity,
  leave: Leave,
  "team-glance": TeamGlance,
  "team-today": TeamToday,
  unowned: Unowned,
  stuck: Stuck,
  approvals: Approvals,
  leaderboard: Leaderboard,
  funnel: Funnel,
  revenue: Revenue,
  "leave-week": LeaveWeek,
  "missing-plan": MissingPlan,
  access: Access,
  roster: Roster,
};
