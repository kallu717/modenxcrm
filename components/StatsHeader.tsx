"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { effectivePriority, isClosedStage } from "@/lib/scoring";
import { followupBucket } from "@/lib/dates";

function Stat({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  return (
    <div className="flex flex-col">
      <b
        className="text-lg font-semibold"
        style={{ color: warn && value > 0 ? "var(--crit)" : "var(--ink)" }}
      >
        {value}
      </b>
      <span
        className="text-[10.5px] uppercase tracking-wide"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </span>
    </div>
  );
}

export default function StatsHeader() {
  const leads = useStore((s) => s.leads);
  const isManager = useStore((s) => s.isManager());
  const currentUserId = useStore((s) => s.currentUserId);
  const visibleLeads = useMemo(
    () => (isManager ? leads : leads.filter((l) => l.assignee === currentUserId)),
    [leads, isManager, currentUserId]
  );

  const mine = visibleLeads.filter(
    (l) => l.assignee === currentUserId && !isClosedStage(l.stage)
  ).length;
  const hot = isManager
    ? visibleLeads.filter((l) => effectivePriority(l) === "Hot" && !l.assignee).length
    : visibleLeads.filter((l) => effectivePriority(l) === "Hot" && !isClosedStage(l.stage)).length;
  const won = visibleLeads.filter((l) => l.stage === "won").length;
  const due = visibleLeads.filter(
    (l) =>
      l.nextFollowup &&
      (followupBucket(l.nextFollowup) === "overdue" || followupBucket(l.nextFollowup) === "today")
  ).length;

  return (
    <div className="flex items-center gap-6">
      <Stat value={mine} label="My open leads" />
      <Stat value={hot} label={isManager ? "Hot, unassigned" : "My hot leads"} />
      <Stat value={due} label="Follow-ups due" warn />
      <Stat value={won} label="Won this month" />
    </div>
  );
}
