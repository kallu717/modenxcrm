"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { STAGES, PRIORITIES, MEETING_MODES, CONTACT_METHODS, repById } from "@/lib/constants";
import { effectivePriority, bandForScore } from "@/lib/scoring";
import { fmtShortDate, fmtFollowup, followupBucket, isoToday, isoPlusDays, nextWeekday } from "@/lib/dates";
import { planById, fmtInr, leadMrr, needsRevenueDetails } from "@/lib/revenue";
import WonModal from "./WonModal";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const inputStyle = { borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" };

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="text-[10.5px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="px-2.5 py-1 rounded-md text-[12px] border"
      style={{
        borderColor: active ? "var(--accent)" : "var(--grid)",
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent-ink)" : "var(--ink-2)",
      }}
    >
      {children}
    </button>
  );
}

export default function LeadDrawer({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const lead = useStore((s) => s.leads.find((l) => l.id === leadId));
  const isManager = useStore((s) => s.isManager());
  const setPriority = useStore((s) => s.setPriority);
  const setLeadStage = useStore((s) => s.setLeadStage);
  const setNextFollowup = useStore((s) => s.setNextFollowup);
  const addMeeting = useStore((s) => s.addMeeting);
  const setMeetingStatus = useStore((s) => s.setMeetingStatus);
  const addNote = useStore((s) => s.addNote);
  const showToast = useStore((s) => s.showToast);

  const [wonModal, setWonModal] = useState(false);
  const [mtgDate, setMtgDate] = useState(isoToday());
  const [mtgTime, setMtgTime] = useState("11:00");
  const [mtgMode, setMtgMode] = useState(MEETING_MODES[0]);
  const [mtgNotes, setMtgNotes] = useState("");
  const [method, setMethod] = useState("NA");
  const [note, setNote] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!lead) return null;
  const rep = repById(lead.assignee);
  const priority = effectivePriority(lead);

  const pickFollowup = (iso: string) => {
    setNextFollowup(lead.id, iso);
    showToast("Follow-up set for " + fmtFollowup(iso));
  };

  const submitNote = () => {
    const v = note.trim();
    if (!v) return;
    addNote(lead.id, v, method);
    setNote("");
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" style={{ background: "rgba(0,0,0,.4)" }} onClick={onClose}>
      <aside
        className="w-full max-w-md h-full overflow-y-auto p-5"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Close" className="text-[13px] mb-3" style={{ color: "var(--muted)" }} onClick={onClose}>
          ✕ Close
        </button>

        <p className="text-[17px] font-semibold" style={{ color: "var(--ink)" }}>{lead.name}</p>
        <p className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
          {lead.title} · {lead.account}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="px-2 py-0.5 rounded text-[11px] font-mono" style={{ background: "var(--crit-soft)", color: "var(--p-hot)" }}>
            {priority}
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
            {lead.type} account
          </span>
        </div>

        <Section title={`Priority · ${lead.priorityOverride ? "set by rep" : "auto-scored"}`}>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((p) => (
              <Pill key={p} active={p === priority} onClick={() => setPriority(lead.id, p)}>
                {p}
              </Pill>
            ))}
          </div>
          <p className="text-[11.5px] mt-2" style={{ color: "var(--muted)" }}>
            Auto score: <b style={{ color: "var(--ink)" }}>{lead.score}</b> ({bandForScore(lead.score)}) —{" "}
            {lead.scoreReasons.join(", ")}.
            {lead.priorityOverride && (
              <button type="button" className="ml-1 underline" style={{ color: "var(--accent-ink)" }} onClick={() => setPriority(lead.id, null)}>
                Reset to auto
              </button>
            )}
          </p>
        </Section>

        <Section title="Stage">
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <Pill
                key={s.id}
                active={s.id === lead.stage}
                onClick={() => {
                  if (s.id === lead.stage) return;
                  setLeadStage(lead.id, s.id);
                  if (needsRevenueDetails({ stage: s.id, plan: lead.plan })) setWonModal(true);
                }}
              >
                {s.name}
              </Pill>
            ))}
          </div>
        </Section>

        {lead.stage === "won" && (
          <Section title="Subscription">
            {lead.plan ? (
              <dl className="text-[12.5px] space-y-1">
                {[
                  ["Plan", planById(lead.plan)?.name],
                  ["Monthly value", fmtInr(leadMrr(lead))],
                  ["Mandate from", lead.mandateDate ? fmtShortDate(lead.mandateDate) : "—"],
                  ["Per quarter", fmtInr(leadMrr(lead) * 3)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt style={{ color: "var(--muted)" }}>{k}</dt>
                    <dd style={{ color: "var(--ink)" }}>{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-[12px]" style={{ color: "var(--warn)" }}>⚠ No subscription recorded</p>
            )}
            <button
              type="button"
              className="mt-2 px-2.5 py-1 rounded text-[12px] border"
              style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
              onClick={() => setWonModal(true)}
            >
              {lead.plan ? "Change plan" : "Add subscription details"}
            </button>
          </Section>
        )}

        <Section title="Next follow-up">
          <div className="flex items-center gap-2 mb-2 text-[12.5px]">
            {lead.nextFollowup ? (
              <>
                <span
                  className="px-2 py-0.5 rounded font-mono text-[11.5px]"
                  style={{
                    background: followupBucket(lead.nextFollowup) === "overdue" ? "var(--crit-soft)" : "var(--accent-soft)",
                    color: followupBucket(lead.nextFollowup) === "overdue" ? "var(--crit)" : "var(--accent-ink)",
                  }}
                >
                  {fmtFollowup(lead.nextFollowup)}
                </span>
                <button type="button" className="underline text-[12px]" style={{ color: "var(--muted)" }} onClick={() => setNextFollowup(lead.id, null)}>
                  Clear
                </button>
              </>
            ) : (
              <span style={{ color: "var(--muted)" }}>No follow-up scheduled</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              ["Today", isoToday()],
              ["Tomorrow", isoPlusDays(isoToday(), 1)],
              ["This Fri", nextWeekday(5)],
              ["+1 week", isoPlusDays(isoToday(), 7)],
            ].map(([label, iso]) => (
              <Pill key={label} active={false} onClick={() => pickFollowup(iso)}>
                {label}
              </Pill>
            ))}
            <input
              type="date"
              aria-label="Custom follow-up date"
              value={lead.nextFollowup || ""}
              onChange={(e) => e.target.value && pickFollowup(e.target.value)}
              className="px-2 py-1 rounded-md text-[12px] border"
              style={inputStyle}
            />
          </div>
        </Section>

        <Section title="Meetings">
          {lead.meetings.length ? (
            <div className="space-y-2 mb-3">
              {[...lead.meetings]
                .sort((a, b) => (a.date < b.date ? -1 : 1))
                .map((m) => (
                  <div key={m.id} className="flex gap-3 text-[12px]">
                    <span className="font-mono shrink-0 w-28" style={{ color: "var(--muted)" }}>
                      {fmtFollowup(m.date)}
                      <br />
                      {m.time}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span style={{ color: "var(--ink)" }}>{m.mode}</span>
                        <span style={{ color: m.status === "done" ? "var(--good)" : m.status === "cancelled" ? "var(--muted)" : "var(--accent-ink)" }}>
                          {m.status}
                        </span>
                      </div>
                      <div style={{ color: "var(--ink-2)" }}>{m.notes}</div>
                      {m.status === "scheduled" && (
                        <div className="flex gap-1.5 mt-1">
                          <button type="button" className="px-2 py-0.5 rounded text-[11px] border" style={{ borderColor: "var(--grid)", color: "var(--ink)" }} onClick={() => setMeetingStatus(lead.id, m.id, "done")}>
                            Mark done
                          </button>
                          <button type="button" className="px-2 py-0.5 rounded text-[11px] border" style={{ borderColor: "var(--grid)", color: "var(--ink)" }} onClick={() => setMeetingStatus(lead.id, m.id, "cancelled")}>
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>No meetings logged yet.</p>
          )}
          <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
            <input type="date" aria-label="Meeting date" value={mtgDate} onChange={(e) => setMtgDate(e.target.value)} className="px-2 py-1 rounded-md text-[12px] border" style={inputStyle} />
            <input type="time" aria-label="Meeting time" value={mtgTime} onChange={(e) => setMtgTime(e.target.value)} className="px-2 py-1 rounded-md text-[12px] border" style={inputStyle} />
            <select aria-label="Meeting mode" value={mtgMode} onChange={(e) => setMtgMode(e.target.value)} className="px-2 py-1 rounded-md text-[12px] border" style={inputStyle}>
              {MEETING_MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <input
              type="text"
              aria-label="Meeting notes"
              placeholder="Agenda / what's this meeting about…"
              value={mtgNotes}
              onChange={(e) => setMtgNotes(e.target.value)}
              className="col-span-2 px-2 py-1 rounded-md text-[12px] border"
              style={inputStyle}
            />
            <button
              type="button"
              className="px-2.5 py-1 rounded-md text-[12px] text-white"
              style={{ background: "var(--accent)" }}
              onClick={() => {
                if (!mtgDate || !mtgTime) {
                  showToast("Pick a date and time");
                  return;
                }
                addMeeting(lead.id, { date: mtgDate, time: mtgTime, mode: mtgMode, notes: mtgNotes.trim() });
                setMtgNotes("");
                showToast("Meeting scheduled");
              }}
            >
              Schedule
            </button>
          </div>
        </Section>

        <Section title="Owner">
          <div className="flex items-center gap-2 text-[12.5px]">
            {rep ? (
              <span className="flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-semibold" style={{ background: rep.color }}>
                  {initials(rep.name)}
                </span>
                {rep.name}
              </span>
            ) : (
              <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Unassigned</span>
            )}
            {isManager && (
              <Link href={`/accounts?account=${encodeURIComponent(lead.account)}`} className="underline" style={{ color: "var(--accent-ink)" }}>
                manage in Accounts
              </Link>
            )}
          </div>
          <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
            One rep per account — reassign from the account&apos;s own page.
          </p>
        </Section>

        <Section title="Contact details">
          <dl className="text-[12.5px] space-y-1">
            {[
              ["Email", lead.email || "—"],
              ["Phone", lead.phone || "—"],
              ["Location", lead.city],
              ["Lead ID", lead.id],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt style={{ color: "var(--muted)" }}>{k}</dt>
                <dd style={{ color: "var(--ink)" }}>{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Activity">
          <div className="space-y-2">
            {lead.activity.map((a, i) => (
              <div key={i} className="text-[12px] border-l-2 pl-2" style={{ borderColor: "var(--grid)" }}>
                <div className="flex justify-between gap-2">
                  <span style={{ color: "var(--ink)" }}>
                    {a.who}
                    {a.method && (
                      <span className="ml-1 px-1 py-0.5 rounded font-mono" style={{ fontSize: "9.5px", background: "var(--surface-2)", color: "var(--muted)" }}>
                        {a.method}
                      </span>
                    )}
                  </span>
                  <span style={{ color: "var(--muted)" }}>{a.t}</span>
                </div>
                <div style={{ color: "var(--ink-2)" }}>{a.txt}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] mt-3 mb-1.5" style={{ color: "var(--muted)" }}>How did you reach them?</p>
          <div className="flex flex-wrap gap-1.5">
            {CONTACT_METHODS.map((m) => (
              <Pill key={m} active={m === method} onClick={() => setMethod(m)}>
                {m}
              </Pill>
            ))}
          </div>
          <div className="flex gap-1.5 mt-2">
            <input
              type="text"
              aria-label="Add note"
              placeholder="Log a call, email or note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitNote()}
              className="flex-1 px-2.5 py-1.5 rounded-md text-[12.5px] border"
              style={inputStyle}
            />
            <button type="button" className="px-3 py-1.5 rounded-md text-[12.5px] text-white" style={{ background: "var(--accent)" }} onClick={submitNote}>
              Add
            </button>
          </div>
        </Section>
      </aside>

      {wonModal && (
        <div onClick={(e) => e.stopPropagation()}>
          <WonModal lead={lead} onClose={() => setWonModal(false)} />
        </div>
      )}
    </div>
  );
}
