"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { followupBucket } from "@/lib/dates";
import { duePayments } from "@/lib/revenue";
import { signOut } from "@/lib/sync";

const NAV_ITEMS = [
  { href: "/pipeline", label: "Pipeline" },
  { href: "/leads", label: "Leads" },
  { href: "/accounts", label: "Accounts" },
  { href: "/followups", label: "Follow-ups", badge: "followups" },
  { href: "/reports", label: "Reports", managerOnly: true },
  { href: "/revenue", label: "Revenue", managerOnly: true },
  { href: "/calendar", label: "Calendar", badge: "calendar" },
] as const;

const MANAGER_ONLY_PATHS = ["/reports", "/revenue"];

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function Masthead() {
  const pathname = usePathname();
  const router = useRouter();
  const leads = useStore((s) => s.leads);
  const changeRequests = useStore((s) => s.changeRequests);
  const leaveRequests = useStore((s) => s.leaveRequests);
  const paymentReminders = useStore((s) => s.paymentReminders);
  const currentUserId = useStore((s) => s.currentUserId);
  const currentUser = useStore((s) => s.currentUser());
  const isManager = currentUser.role === "Manager";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Follow-ups carries edit approvals and upcoming mandate debits too, so its
  // badge counts everything waiting there.
  const badges = useMemo(() => {
    const scope = isManager ? leads : leads.filter((l) => l.assignee === currentUserId);
    const due = scope.filter((l) => {
      const b = followupBucket(l.nextFollowup);
      return b === "overdue" || b === "today";
    }).length;
    const pendingCr = changeRequests.filter((c) => c.status === "pending");
    const approvals = isManager ? pendingCr.length : pendingCr.filter((c) => c.requestedBy === currentUserId).length;
    const payments = duePayments(scope, paymentReminders).length;
    const pendingLeave = leaveRequests.filter((r) => r.status === "pending");
    const calendar = isManager ? pendingLeave.length : pendingLeave.filter((r) => r.repId === currentUserId).length;
    return { followups: due + approvals + payments, calendar, unassigned: leads.filter((l) => !l.assignee).length };
  }, [leads, changeRequests, leaveRequests, paymentReminders, isManager, currentUserId]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    if (!isManager && MANAGER_ONLY_PATHS.some((p) => pathname?.startsWith(p))) router.replace("/pipeline");
  }, [isManager, pathname, router]);

  return (
    <header className="sticky top-0 z-50 border-b" style={{ background: "var(--bg)", borderColor: "var(--grid)" }}>
      <div className="max-w-[1320px] mx-auto px-[18px] py-2.5 flex items-center gap-6">
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center text-white font-semibold text-sm"
            style={{ background: "var(--accent)" }}
          >
            M
          </div>
          <p className="font-semibold text-[15px]" style={{ color: "var(--ink)" }}>
            ModenX <span style={{ color: "var(--muted)" }}>Pipeline</span>
          </p>
        </div>

        <nav className="flex items-center gap-1 flex-1 flex-wrap" aria-label="View">
          {NAV_ITEMS.filter((item) => !("managerOnly" in item) || isManager).map((item) => {
            const active = pathname?.startsWith(item.href);
            const count = "badge" in item ? badges[item.badge] : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors flex items-center gap-1.5"
                style={{
                  color: active ? "var(--accent-ink)" : "var(--ink-2)",
                  background: active ? "var(--accent-soft)" : "transparent",
                }}
              >
                {item.label}
                {count > 0 && (
                  <span
                    className="rounded-full px-1.5 font-mono text-white"
                    style={{ background: "var(--crit)", fontSize: "10px", lineHeight: "16px" }}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {isManager && badges.unassigned > 0 && (
          <Link
            href="/leads?assignee=__unassigned"
            className="shrink-0 font-mono rounded-full px-2.5 py-1 border"
            style={{
              fontSize: "11.5px",
              color: "var(--accent-ink)",
              background: "var(--accent-soft)",
              borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
            }}
          >
            ◎ {badges.unassigned} unassigned
          </Link>
        )}

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 px-1.5 py-1 rounded-md"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold"
              style={{ background: currentUser.color }}
            >
              {initials(currentUser.name)}
            </span>
            <span className="text-left leading-tight">
              <span className="block text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
                {currentUser.name}
              </span>
              <span className="block font-mono uppercase tracking-wide" style={{ fontSize: "10px", color: "var(--muted)" }}>
                {currentUser.role}
              </span>
            </span>
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-60 rounded-lg border overflow-hidden"
              style={{ background: "var(--surface)", borderColor: "var(--grid)", boxShadow: "var(--shadow-lg)" }}
            >
              {/* Role comes from the server at sign-in; there is no way to switch it here. */}
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2.5 text-left text-[13px] font-medium"
                style={{ color: "var(--crit)" }}
                onClick={() => {
                  setMenuOpen(false);
                  void signOut();
                }}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
