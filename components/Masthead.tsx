"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";

const NAV_ITEMS = [
  { href: "/pipeline", label: "Pipeline" },
  { href: "/leads", label: "Leads" },
  { href: "/accounts", label: "Accounts" },
  { href: "/followups", label: "Follow-ups" },
  { href: "/reports", label: "Reports", managerOnly: true },
  { href: "/revenue", label: "Revenue", managerOnly: true },
  { href: "/calendar", label: "Calendar" },
];

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function Masthead() {
  const pathname = usePathname();
  const reps = useStore((s) => s.reps);
  const currentUserId = useStore((s) => s.currentUserId);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const currentUser = useStore((s) => s.currentUser());
  const isManager = currentUser.role === "Manager";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{ background: "var(--bg)", borderColor: "var(--grid)" }}
    >
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

        <nav className="flex items-center gap-1 flex-1 flex-wrap" role="group" aria-label="View">
          {NAV_ITEMS.filter((item) => !item.managerOnly || isManager).map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-pressed={active}
                className="px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors"
                style={{
                  color: active ? "var(--accent-ink)" : "var(--ink-2)",
                  background: active ? "var(--accent-soft)" : "transparent",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
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
              <span
                className="block font-mono uppercase tracking-wide"
                style={{ fontSize: "10px", color: "var(--muted)" }}
              >
                {currentUser.role}
              </span>
            </span>
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 mt-1 w-56 rounded-lg border shadow-lg overflow-hidden"
              style={{ background: "var(--surface)", borderColor: "var(--grid)", boxShadow: "var(--shadow-lg)" }}
            >
              {reps.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] hover:opacity-90"
                  style={{
                    color: "var(--ink)",
                    background: r.id === currentUserId ? "var(--accent-soft)" : "transparent",
                  }}
                  onClick={() => {
                    setCurrentUser(r.id);
                    setMenuOpen(false);
                  }}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                    style={{ background: r.color }}
                  >
                    {initials(r.name)}
                  </span>
                  <span>{r.name}</span>
                  <span
                    className="ml-auto font-mono uppercase"
                    style={{ fontSize: "9.5px", color: "var(--muted)" }}
                  >
                    {r.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
