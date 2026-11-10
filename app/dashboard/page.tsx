"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { repById, sellersList } from "@/lib/constants";
import { fmtFollowup, fmtShortDate, to12h } from "@/lib/dates";
import { accountHref } from "@/lib/accounts";
import { billedThisMonth, collectedThisMonth, duePayments, fmtInr, leadMrr } from "@/lib/revenue";
import { effectivePriority } from "@/lib/scoring";
import {
  approvalsWaiting, callsToday, followupsDue, greeting, hotWithoutNextStep, myRequests, notContactedYet,
  stuckLocations, teamToday, unownedCities, upcomingMeetings,
} from "@/lib/dashboard";
import LeadDrawer from "@/components/LeadDrawer";
import ContactedModal from "@/components/ContactedModal";
import PaymentsList from "@/components/PaymentsList";
import { initials } from "@/components/OwnerSelect";
import type { Lead } from "@/lib/types";

const LIST_LIMIT = 6;

const PRIORITY_STYLE: Record<string, { bg: string; fg: string }> = {
  Hot: { bg: "var(--crit-soft)", fg: "var(--p-hot)" },
  Warm: { bg: "var(--warn-soft)", fg: "var(--p-warm)" },
  Nurture: { bg: "var(--accent-soft)", fg: "var(--p-nurture)" },
  Low: { bg: "var(--surface-2)", fg: "var(--p-low)" },
};

function Card({
  title,
  count,
  more,
  children,
}: {
  title: string;
  count?: number;
  more?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl p-4" style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
          {title}
          {count != null && (
            <span className="ml-1.5 font-mono text-[12px]" style={{ color: "var(--muted)" }}>
              {count}
            </span>
          )}
        </h2>
        {more && (
          <Link href={more.href} className="text-[12px] shrink-0" style={{ color: "var(--accent)" }}>
            {more.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12.5px] py-2" style={{ color: "var(--muted)" }}>
      {children}
    </p>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "crit" | "warn" | "good";
  href?: string;
}) {
  const body = (
    <div
      className="rounded-xl p-3.5 h-full"
      style={{
        background: "var(--surface)",
        boxShadow: "var(--shadow)",
        borderTop: `3px solid ${tone ? `var(--${tone})` : "var(--grid)"}`,
      }}
    >
      <p className="text-[11.5px] uppercase tracking-wide font-mono" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <p className="text-[24px] font-semibold mt-1 leading-none" style={{ color: tone ? `var(--${tone})` : "var(--ink)" }}>
        {value}
      </p>
      {sub && (
        <div className="text-[12px] mt-1.5" style={{ color: "var(--ink-2)" }}>
          {sub}
        </div>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function Progress({ done, target }: { done: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: done >= target ? "var(--good)" : "var(--accent)" }}
      />
    </div>
  );
}

function LeadRow({
  lead,
  when,
  late,
  onOpen,
  action,
}: {
  lead: Lead;
  when?: string;
  late?: boolean;
  onOpen: () => void;
  action?: React.ReactNode;
}) {
  const p = effectivePriority(lead);
  const ps = PRIORITY_STYLE[p];
  return (
    <div
      className="flex items-center gap-3 py-2 border-t first:border-t-0 cursor-pointer"
      style={{ borderColor: "var(--grid)" }}
      onClick={onOpen}
    >
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

const STATUS_STYLE = {
  pending: { bg: "var(--warn-soft)", fg: "var(--warn)", label: "Waiting" },
  approved: { bg: "var(--good-soft)", fg: "var(--good)", label: "Approved" },
  rejected: { bg: "var(--crit-soft)", fg: "var(--crit)", label: "Declined" },
};

export default function DashboardPage() {
  const leads = useStore((s) => s.leads);
  const currentUserId = useStore((s) => s.currentUserId);
  const me = useStore((s) => s.currentUser());
  const isManager = useStore((s) => s.isManager());
  const isAdmin = useStore((s) => s.isAdmin());
  const targets = useStore((s) => s.targets);
  const payments = useStore((s) => s.payments);
  const paymentReminders = useStore((s) => s.paymentReminders);
  const changeRequests = useStore((s) => s.changeRequests);
  const leaveRequests = useStore((s) => s.leaveRequests);
  const companyHolidays = useStore((s) => s.companyHolidays);
  const repLeaves = useStore((s) => s.repLeaves);

  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [contactedLead, setContactedLead] = useState<Lead | null>(null);
  const [waitingForAccess, setWaitingForAccess] = useState<number | null>(null);
  const [now] = useState(() => new Date());

  // Admins only administer; reps and managers sell, so they get "my day".
  const sells = me.role === "Rep" || me.role === "Manager";
  const mine = useMemo(() => leads.filter((l) => l.assignee === currentUserId), [leads, currentUserId]);

  const fu = useMemo(() => followupsDue(mine), [mine]);
  const meetings = useMemo(() => upcomingMeetings(mine), [mine]);
  const hot = useMemo(() => hotWithoutNextStep(mine), [mine]);
  const fresh = useMemo(() => notContactedYet(mine), [mine]);
  const calls = useMemo(() => callsToday(leads, currentUserId, targets), [leads, currentUserId, targets]);
  const requests = useMemo(
    () => myRequests(changeRequests, leaveRequests, leads, currentUserId),
    [changeRequests, leaveRequests, leads, currentUserId]
  );
  // Managers look after collections for the whole team.
  const due = useMemo(
    () => duePayments(isManager ? leads : mine, payments, paymentReminders),
    [isManager, leads, mine, payments, paymentReminders]
  );
  const dueTotal = due.reduce((s, d) => s + leadMrr(d.lead), 0);

  const approvals = useMemo(() => approvalsWaiting(changeRequests, leaveRequests), [changeRequests, leaveRequests]);
  const unowned = useMemo(() => (isManager ? unownedCities(leads) : []), [isManager, leads]);
  const stuck = useMemo(() => (isManager ? stuckLocations(leads) : []), [isManager, leads]);
  const team = useMemo(
    () => (isManager ? teamToday(leads, sellersList(leads), targets, companyHolidays, repLeaves) : []),
    [isManager, leads, targets, companyHolidays, repLeaves]
  );
  const billed = useMemo(() => (isManager ? billedThisMonth(leads) : 0), [isManager, leads]);
  const collected = useMemo(() => collectedThisMonth(payments), [payments]);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .adminUsers()
      .then((people) => setWaitingForAccess(people.filter((p) => p.role === "Pending").length))
      .catch(() => setWaitingForAccess(null));
  }, [isAdmin]);

  const followupRows = [...fu.overdue, ...fu.today];
  const unownedContacts = unowned.reduce((n, c) => n + c.contacts, 0);
  const monthName = now.toLocaleDateString("en-IN", { month: "long" });

  return (
    <div className="py-5 space-y-6">
      <div>
        <h1 className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
          {greeting(now.getHours())}, {me.name.split(" ")[0]}
        </h1>
        <p className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
          {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          {sells ? " · here's what needs you today." : ""}
        </p>
      </div>

      {sells && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <Tile
              label="Overdue"
              value={fu.overdue.length}
              sub="follow-ups past their date"
              tone={fu.overdue.length ? "crit" : undefined}
              href="/followups"
            />
            <Tile label="Today" value={fu.today.length} sub="follow-ups due today" tone={fu.today.length ? "warn" : undefined} href="/followups" />
            <Tile label="Meetings" value={meetings.length} sub="in the next 7 days" />
            <Tile
              label="Payments due"
              value={due.length}
              sub={due.length ? `${fmtInr(dueTotal)}${isManager ? " · whole team" : ""}` : "nothing to collect"}
              tone={due.some((d) => d.status === "overdue") ? "crit" : undefined}
            />
            <Tile
              label="Calls today"
              value={
                <>
                  {calls.done}
                  <span className="text-[14px] font-normal" style={{ color: "var(--muted)" }}>
                    {" "}/ {calls.target}
                  </span>
                </>
              }
              sub={<Progress done={calls.done} target={calls.target} />}
              tone={calls.done >= calls.target ? "good" : undefined}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <div className="space-y-4">
              <Card
                title="Follow-ups"
                count={followupRows.length}
                more={followupRows.length > LIST_LIMIT ? { href: "/followups", label: "See all" } : undefined}
              >
                {followupRows.length ? (
                  followupRows.slice(0, LIST_LIMIT).map((l) => (
                    <LeadRow
                      key={l.id}
                      lead={l}
                      when={fmtFollowup(l.nextFollowup)}
                      late={fu.overdue.includes(l)}
                      onOpen={() => setOpenLeadId(l.id)}
                      action={
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded text-[12px] border shrink-0"
                          style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setContactedLead(l);
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
              </Card>

              <Card title="Meetings · next 7 days" count={meetings.length} more={{ href: "/calendar", label: "Calendar" }}>
                {meetings.length ? (
                  meetings.slice(0, LIST_LIMIT + 2).map(({ lead, meeting }) => (
                    <div
                      key={lead.id + meeting.id}
                      className="flex items-center gap-3 py-2 border-t first:border-t-0 cursor-pointer"
                      style={{ borderColor: "var(--grid)" }}
                      onClick={() => setOpenLeadId(lead.id)}
                    >
                      <div className="w-[92px] shrink-0">
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
              </Card>

              {requests.length > 0 && (
                <Card title="Your requests" count={requests.length}>
                  {requests.slice(0, LIST_LIMIT).map((r) => {
                    const st = STATUS_STYLE[r.status];
                    return (
                      <div
                        key={r.kind + r.id}
                        className="flex items-center gap-3 py-2 border-t first:border-t-0 text-[13px]"
                        style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
                      >
                        <span className="flex-1 truncate">{r.label}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10.5px]" style={{ background: st.bg, color: st.fg }}>
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Card
                title={isManager ? "Payments due · whole team" : "Payments due"}
                count={due.length}
                more={due.length > 4 ? { href: "/followups", label: "See all" } : undefined}
              >
                {due.length ? (
                  <PaymentsList due={due} onOpenLead={setOpenLeadId} limit={4} />
                ) : (
                  <Empty>No debits due in the next 7 days, and nothing left unpaid.</Empty>
                )}
              </Card>

              <Card title="Hot, with no next step" count={hot.length}>
                {hot.length ? (
                  hot.slice(0, LIST_LIMIT).map((l) => (
                    <LeadRow key={l.id} lead={l} when="No follow-up set" onOpen={() => setOpenLeadId(l.id)} />
                  ))
                ) : (
                  <Empty>Every hot contact has a next step planned.</Empty>
                )}
              </Card>

              <Card
                title="New, not contacted yet"
                count={fresh.length}
                more={fresh.length > LIST_LIMIT ? { href: "/leads", label: "Leads" } : undefined}
              >
                {fresh.length ? (
                  fresh.slice(0, LIST_LIMIT).map((l) => (
                    <LeadRow
                      key={l.id}
                      lead={l}
                      when={l.ownerSince ? `Yours since ${fmtShortDate(l.ownerSince)}` : undefined}
                      onOpen={() => setOpenLeadId(l.id)}
                    />
                  ))
                ) : (
                  <Empty>You&apos;ve reached everyone you were given.</Empty>
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      {isManager && (
        <>
          <h2 className="text-[15px] font-semibold pt-2" style={{ color: "var(--ink)" }}>
            Your team
          </h2>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <Tile
              label="Approvals waiting"
              value={approvals.edits + approvals.leave}
              sub={`${approvals.edits} edit${approvals.edits === 1 ? "" : "s"} · ${approvals.leave} leave`}
              tone={approvals.edits + approvals.leave ? "warn" : undefined}
              href={approvals.edits || !approvals.leave ? "/followups" : "/calendar"}
            />
            <Tile
              label="Cities with no owner"
              value={unowned.length}
              sub={`${unownedContacts.toLocaleString("en-IN")} contact${unownedContacts === 1 ? "" : "s"} waiting`}
              tone={unowned.length ? "warn" : undefined}
              href="/accounts"
            />
            <Tile label="Stuck 60+ days" value={stuck.length} sub="locations not moving" tone={stuck.length ? "crit" : undefined} href="/reports" />
            <Tile
              label={`Revenue · ${monthName}`}
              value={fmtInr(billed)}
              sub={`${fmtInr(collected)} marked paid so far`}
              href="/revenue"
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <Card title="Team today" count={team.length} more={{ href: "/reports", label: "Reports" }}>
              {team.length ? (
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr style={{ color: "var(--muted)" }} className="text-left font-mono text-[10.5px] uppercase tracking-wide">
                      <th className="py-1.5 font-normal">Person</th>
                      <th className="py-1.5 font-normal w-[34%]">Calls today</th>
                      <th className="py-1.5 font-normal text-right">Overdue</th>
                      <th className="py-1.5 font-normal text-right">Meetings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((t) => (
                      <tr key={t.rep.id} className="border-t" style={{ borderColor: "var(--grid)", color: "var(--ink)" }}>
                        <td className="py-2">
                          <span className="flex items-center gap-2">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-semibold"
                              style={{ background: t.rep.color }}
                            >
                              {initials(t.rep.name)}
                            </span>
                            <span>
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
            </Card>

            <div className="space-y-4">
              <Card title="Cities with no owner" count={unowned.length}>
                {unowned.length ? (
                  unowned.slice(0, LIST_LIMIT).map((c) => (
                    <Link
                      key={c.account + c.cityKey}
                      href={accountHref(c.account)}
                      className="flex items-center gap-3 py-2 border-t first:border-t-0 text-[13px]"
                      style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
                    >
                      <span className="flex-1 truncate">
                        {c.account} <span style={{ color: "var(--muted)" }}>· {c.city}</span>
                      </span>
                      <span className="font-mono text-[11.5px]" style={{ color: "var(--ink-2)" }}>
                        {c.contacts} contact{c.contacts === 1 ? "" : "s"}
                      </span>
                      <span className="text-[12px]" style={{ color: "var(--accent)" }}>
                        Assign →
                      </span>
                    </Link>
                  ))
                ) : (
                  <Empty>Every city has an owner.</Empty>
                )}
              </Card>

              <Card title="Stuck 60+ days" count={stuck.length} more={stuck.length > LIST_LIMIT ? { href: "/reports", label: "See all" } : undefined}>
                {stuck.length ? (
                  stuck.slice(0, LIST_LIMIT).map((s) => (
                    <Link
                      key={s.account + (s.city || "")}
                      href={accountHref(s.account)}
                      className="flex items-center gap-3 py-2 border-t first:border-t-0 text-[13px]"
                      style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
                    >
                      <span className="flex-1 truncate">
                        {s.account}
                        {s.city && <span style={{ color: "var(--muted)" }}> · {s.city}</span>}
                      </span>
                      <span className="text-[12px]" style={{ color: "var(--ink-2)" }}>
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
              </Card>
            </div>
          </div>
        </>
      )}

      {isAdmin && (
        <Card title="People waiting for access" more={{ href: "/settings", label: "Settings" }}>
          {waitingForAccess == null ? (
            <Empty>Checking…</Empty>
          ) : waitingForAccess ? (
            <p className="text-[13px]" style={{ color: "var(--ink)" }}>
              <b>{waitingForAccess}</b> {waitingForAccess === 1 ? "person has" : "people have"} signed in and need a role
              before they can use the CRM.
            </p>
          ) : (
            <Empty>No one is waiting. New people appear here after they first sign in.</Empty>
          )}
        </Card>
      )}

      {openLeadId && <LeadDrawer leadId={openLeadId} onClose={() => setOpenLeadId(null)} />}
      {contactedLead && <ContactedModal lead={contactedLead} onClose={() => setContactedLead(null)} />}
    </div>
  );
}
