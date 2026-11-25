"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { followupBucket } from "@/lib/dates";
import { duePayments } from "@/lib/revenue";
import { signOut } from "@/lib/sync";
import { ROLE_LABELS } from "@/lib/types";
import ThemesModal from "@/components/ThemesModal";
import Logo from "@/components/Logo";
import CommandPalette from "@/components/CommandPalette";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/leads", label: "Leads" },
  { href: "/accounts", label: "Accounts" },
  { href: "/followups", label: "Follow-ups", badge: "followups" },
  { href: "/reports", label: "Reports", managerOnly: true },
  { href: "/revenue", label: "Revenue", managerOnly: true },
  { href: "/calendar", label: "Calendar", badge: "calendar" },
  { href: "/settings", label: "Settings", adminOnly: true },
] as const;

const MANAGER_ONLY_PATHS = ["/reports", "/revenue"];
const ADMIN_ONLY_PATHS = ["/settings"];

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
  const payments = useStore((s) => s.payments);
  const currentUserId = useStore((s) => s.currentUserId);
  const currentUser = useStore((s) => s.currentUser());
  const isManager = useStore((s) => s.isManager());
  const isAdmin = useStore((s) => s.isAdmin());
  const [menuOpen, setMenuOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
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
    const paymentsDue = duePayments(scope, payments, paymentReminders).length;
    const pendingLeave = leaveRequests.filter((r) => r.status === "pending");
    const calendar = isManager ? pendingLeave.length : pendingLeave.filter((r) => r.repId === currentUserId).length;
    return { followups: due + approvals + paymentsDue, calendar, unassigned: leads.filter((l) => !l.assignee).length };
  }, [leads, changeRequests, leaveRequests, paymentReminders, payments, isManager, currentUserId]);

  // Sliding highlight: sits under the hovered menu item, else the current page.
  const navRef = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pill, setPill] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const activeHref = NAV_ITEMS.find((i) => pathname?.startsWith(i.href))?.href ?? null;
  const target = hovered ?? activeHref;
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const place = () => {
      const el = target ? nav.querySelector<HTMLElement>(`[data-nav="${target}"]`) : null;
      setPill(el ? { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight } : null);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [target]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    const blocked =
      (!isManager && MANAGER_ONLY_PATHS.some((p) => pathname?.startsWith(p))) ||
      (!isAdmin && ADMIN_ONLY_PATHS.some((p) => pathname?.startsWith(p)));
    if (blocked) router.replace("/dashboard");
  }, [isManager, isAdmin, pathname, router]);

  return (
    <header className="sticky top-0 z-50 border-b" style={{ background: "var(--bg)", borderColor: "var(--grid)" }}>
      <div className="max-w-[1320px] mx-auto px-[18px] pt-2.5 pb-1.5 flex items-center gap-3 sm:gap-4">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0" aria-label="bdCRM home">
          <Logo size={26} />
          <span className="font-semibold text-[15px]" style={{ color: "var(--ink)" }}>
            bdCRM <span className="hidden sm:inline" style={{ color: "var(--muted)" }}>for ModenX</span>
          </span>
        </Link>
        <div className="flex-1" />
        <CommandPalette
          pages={NAV_ITEMS.filter(
            (item) => (!("managerOnly" in item) || isManager) && (!("adminOnly" in item) || isAdmin)
          ).map(({ href, label }) => ({ href, label }))}
        />

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
            ◎ {badges.unassigned}<span className="hidden sm:inline"> unassigned</span>
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
            <span className="hidden md:block text-left leading-tight">
              <span className="block text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
                {currentUser.name}
              </span>
              <span className="block font-mono uppercase tracking-wide" style={{ fontSize: "10px", color: "var(--muted)" }}>
                {ROLE_LABELS[currentUser.role]}
              </span>
            </span>
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-60 rounded-lg border overflow-hidden z-[60]"
              style={{ background: "var(--surface)", borderColor: "var(--grid)", boxShadow: "var(--shadow-lg)" }}
            >
              {/* Role comes from the server (an Admin sets it in Settings); there is no way to switch it here. */}
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2.5 text-left text-[13px] font-medium border-b"
                style={{ color: "var(--ink)", borderColor: "var(--grid)" }}
                onClick={() => {
                  setMenuOpen(false);
                  setThemesOpen(true);
                }}
              >
                Themes
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2.5 text-left text-[13px] font-medium border-b"
                style={{ color: "var(--ink)", borderColor: "var(--grid)" }}
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/scoring-guide");
                }}
              >
                ℹ How scoring works
              </button>
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

      <div className="max-w-[1320px] mx-auto px-[18px]">
        <nav
          ref={navRef}
          className="no-scrollbar relative flex items-center gap-1 overflow-x-auto -mx-1 px-1 pb-2"
          aria-label="View"
          onMouseLeave={() => setHovered(null)}
        >
          <span
            aria-hidden
            className="fx-nav-pill"
            style={{ left: pill?.left ?? 0, top: pill?.top ?? 0, width: pill?.width ?? 0, height: pill?.height ?? 0, opacity: pill ? 1 : 0 }}
          />
          {NAV_ITEMS.filter(
            (item) => (!("managerOnly" in item) || isManager) && (!("adminOnly" in item) || isAdmin)
          ).map((item) => {
            const active = pathname?.startsWith(item.href);
            const count = "badge" in item ? badges[item.badge] : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                data-nav={item.href}
                onMouseEnter={() => setHovered(item.href)}
                onFocus={() => setHovered(item.href)}
                onBlur={() => setHovered(null)}
                className="relative shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors flex items-center gap-1.5"
                style={{
                  color: active || hovered === item.href ? "var(--accent-ink)" : "var(--ink-2)",
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

      </div>
      {themesOpen && <ThemesModal onClose={() => setThemesOpen(false)} />}
    </header>
  );
}
