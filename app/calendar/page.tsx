"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { repsList, repById } from "@/lib/constants";
import { isWeekend } from "@/lib/calendar";
import { fmtShortDate } from "@/lib/dates";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const inputStyle = { borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" };

function CalRow({
  date,
  label,
  onDelete,
  right,
}: {
  date: string;
  label: string;
  onDelete?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-[12.5px]">
      <span className="font-mono w-24 shrink-0" style={{ color: "var(--muted)" }}>
        {fmtShortDate(date)}
      </span>
      <span style={{ color: "var(--ink)" }}>{label}</span>
      {right}
      {onDelete && (
        <button
          type="button"
          aria-label="Remove"
          className="ml-auto px-1.5 text-[13px]"
          style={{ color: "var(--muted)" }}
          onClick={onDelete}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const isManager = useStore((s) => s.isManager());
  const currentUserId = useStore((s) => s.currentUserId);
  const companyHolidays = useStore((s) => s.companyHolidays);
  const repLeaves = useStore((s) => s.repLeaves);
  const leaveRequests = useStore((s) => s.leaveRequests);
  const addHoliday = useStore((s) => s.addHoliday);
  const removeHoliday = useStore((s) => s.removeHoliday);
  const removeLeave = useStore((s) => s.removeLeave);
  const decideLeaveRequest = useStore((s) => s.decideLeaveRequest);
  const submitLeaveRequest = useStore((s) => s.submitLeaveRequest);
  const repLeaveOn = useStore((s) => s.repLeaveOn);
  const showToast = useStore((s) => s.showToast);

  const [holDate, setHolDate] = useState("");
  const [holName, setHolName] = useState("");
  const [myDate, setMyDate] = useState("");
  const [myReason, setMyReason] = useState("");

  const sortedHolidays = useMemo(
    () => [...companyHolidays].sort((a, b) => (a.date < b.date ? -1 : 1)),
    [companyHolidays]
  );
  const pending = useMemo(
    () => leaveRequests.filter((r) => r.status === "pending").sort((a, b) => (a.date < b.date ? -1 : 1)),
    [leaveRequests]
  );
  const myRequests = useMemo(
    () =>
      leaveRequests
        .filter((r) => r.repId === currentUserId)
        .sort((a, b) => (b.requestedAt < a.requestedAt ? -1 : 1)),
    [leaveRequests, currentUserId]
  );

  const handleAddHoliday = () => {
    if (!holDate || !holName.trim()) {
      showToast("Pick a date and name the holiday");
      return;
    }
    const ok = addHoliday(holDate, holName.trim());
    if (!ok) {
      showToast("Already a holiday on that date");
      return;
    }
    setHolDate("");
    setHolName("");
    showToast("Holiday added");
  };

  const handleApply = () => {
    if (!myDate) {
      showToast("Pick a date");
      return;
    }
    if (isWeekend(myDate)) {
      showToast("That's already a weekend");
      return;
    }
    const alreadyApproved = !!repLeaveOn(currentUserId, myDate);
    const ok = submitLeaveRequest(currentUserId, myDate, myReason.trim());
    if (!ok) {
      showToast(alreadyApproved ? "Already approved for that day" : "Already requested for that day");
      return;
    }
    setMyDate("");
    setMyReason("");
    showToast("Leave request sent to your manager");
  };

  return (
    <div className="py-5">
      <h1 className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
        Calendar
      </h1>
      <p className="text-[12.5px] mt-0.5 mb-5" style={{ color: "var(--muted)" }}>
        {isManager
          ? "Company holidays, plus leave requests waiting on your approval."
          : "Apply for leave and track your requests. Approved days shape what \"last N days\" means on your call target."}
      </p>
      <p className="text-[11.5px] mb-5" style={{ color: "var(--muted)" }}>
        Weekends are non-working by default on top of whatever&apos;s below.
        {isManager && " Revenue and billing dates are calendar-based and never look at this page."}
      </p>

      {/* Company holidays */}
      <section className="mb-6">
        <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Company holidays</p>
        <p className="text-[11.5px] mt-0.5 mb-2" style={{ color: "var(--muted)" }}>
          {isManager
            ? "Non-working days for the whole team, on top of weekends."
            : "Non-working days for the whole team, on top of weekends — set by your manager."}
        </p>
        {isManager && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <input
              type="date"
              value={holDate}
              onChange={(e) => setHolDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-md text-[13px] border"
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="Holiday name"
              value={holName}
              onChange={(e) => setHolName(e.target.value)}
              className="px-2.5 py-1.5 rounded-md text-[13px] border"
              style={inputStyle}
            />
            <button
              type="button"
              className="px-3 py-1.5 rounded-md text-[13px] text-white"
              style={{ background: "var(--accent)" }}
              onClick={handleAddHoliday}
            >
              Add holiday
            </button>
          </div>
        )}
        <div
          className="rounded-lg p-3"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}
        >
          {sortedHolidays.length ? (
            sortedHolidays.map((h) => (
              <CalRow
                key={h.date}
                date={h.date}
                label={h.name}
                onDelete={isManager ? () => removeHoliday(h.date) : undefined}
              />
            ))
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "12px" }}>No company holidays added yet.</p>
          )}
        </div>
      </section>

      {isManager ? (
        <>
          {/* Pending leave approvals */}
          <section className="mb-6">
            <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
              Leave requests ({pending.length} pending)
            </p>
            <div className="space-y-2 mt-2">
              {pending.length ? (
                pending.map((r) => {
                  const rep = repById(r.repId);
                  return (
                    <div
                      key={r.id}
                      className="rounded-lg p-3"
                      style={{ background: "var(--surface)", borderLeft: "3px solid var(--warn)", boxShadow: "var(--shadow)" }}
                    >
                      <div className="flex items-center gap-2 text-[12.5px] flex-wrap">
                        {rep && (
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-semibold"
                            style={{ background: rep.color }}
                          >
                            {initials(rep.name)}
                          </span>
                        )}
                        <span style={{ color: "var(--ink)" }}>
                          <b>{rep?.name}</b> requested leave on <b>{fmtShortDate(r.date)}</b>
                          {r.reason ? ` — ${r.reason}` : ""}
                        </span>
                        <span className="ml-auto font-mono" style={{ fontSize: "10.5px", color: "var(--muted)" }}>
                          requested {fmtShortDate(r.requestedAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded text-[12px] text-white"
                          style={{ background: "var(--accent)" }}
                          onClick={() => {
                            decideLeaveRequest(r.id, true);
                            showToast(`Leave approved for ${rep?.name}`);
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded text-[12px] border"
                          style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
                          onClick={() => {
                            decideLeaveRequest(r.id, false);
                            showToast("Leave request rejected");
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p style={{ color: "var(--muted)", fontSize: "12px" }}>No leave requests waiting.</p>
              )}
            </div>
          </section>

          {/* Approved leave record per rep */}
          <section className="mb-8">
            <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Approved leave record</p>
            <p className="text-[11.5px] mt-0.5 mb-3" style={{ color: "var(--muted)" }}>
              Everything approved so far, per rep. Remove one only to correct a mistake — reps apply
              through the request flow above.
            </p>
            <div className="space-y-4">
              {repsList().map((r) => {
                const mine = repLeaves.filter((l) => l.repId === r.id).sort((a, b) => (b.date < a.date ? -1 : 1));
                return (
                  <div key={r.id}>
                    <div className="flex items-center gap-1.5 text-[12.5px] mb-1.5" style={{ color: "var(--ink)" }}>
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-semibold"
                        style={{ background: r.color }}
                      >
                        {initials(r.name)}
                      </span>
                      {r.name}
                      <span style={{ color: "var(--muted)" }}>
                        · {mine.length} approved leave day{mine.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div
                      className="rounded-lg p-3"
                      style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}
                    >
                      {mine.length ? (
                        mine.map((l) => (
                          <CalRow
                            key={l.id}
                            date={l.date}
                            label={l.reason || "Leave"}
                            onDelete={() => removeLeave(l.id)}
                          />
                        ))
                      ) : (
                        <p style={{ color: "var(--muted)", fontSize: "12px" }}>Nothing approved yet.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <>
          {/* Rep: apply for leave */}
          <section className="mb-6">
            <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Apply for leave</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <input
                type="date"
                value={myDate}
                onChange={(e) => setMyDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-md text-[13px] border"
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="Reason (optional)"
                value={myReason}
                onChange={(e) => setMyReason(e.target.value)}
                className="px-2.5 py-1.5 rounded-md text-[13px] border flex-1 min-w-[160px]"
                style={inputStyle}
              />
              <button
                type="button"
                className="px-3 py-1.5 rounded-md text-[13px] text-white"
                style={{ background: "var(--accent)" }}
                onClick={handleApply}
              >
                Request leave
              </button>
            </div>
          </section>

          {/* Rep: my requests */}
          <section className="mb-8">
            <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Your leave requests</p>
            <div
              className="rounded-lg p-3 mt-2"
              style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}
            >
              {myRequests.length ? (
                myRequests.map((r) => (
                  <CalRow
                    key={r.id}
                    date={r.date}
                    label={
                      (r.reason || "Leave") +
                      (r.status !== "pending" && r.decidedAt ? ` · decided ${fmtShortDate(r.decidedAt)}` : "")
                    }
                    right={
                      <span
                        className="ml-auto px-1.5 py-0.5 rounded text-[10.5px] font-mono"
                        style={{
                          background:
                            r.status === "approved"
                              ? "var(--good-soft)"
                              : r.status === "rejected"
                                ? "var(--crit-soft)"
                                : "var(--warn-soft)",
                          color:
                            r.status === "approved"
                              ? "var(--good)"
                              : r.status === "rejected"
                                ? "var(--crit)"
                                : "var(--warn)",
                        }}
                      >
                        {r.status}
                      </span>
                    }
                  />
                ))
              ) : (
                <p style={{ color: "var(--muted)", fontSize: "12px" }}>You haven&apos;t requested any leave yet.</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
