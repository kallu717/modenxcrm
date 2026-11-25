"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { accountHref } from "@/lib/accounts";
import { quickSearch, readRecent, rememberRecent, type Hit, type HitKind, type PageItem } from "@/lib/quicksearch";
import LeadDrawer from "@/components/LeadDrawer";

// Quick search: press / anywhere (except while typing in a box), or the
// search button in the top bar. Finds pages, accounts and contacts; arrow keys move, Enter opens, Esc
// closes. (vibecodecomponents.com "Command Palette" + "Search Autocomplete".)

const GROUP_LABEL: Record<HitKind, string> = { page: "Pages", account: "Accounts", lead: "Contacts" };

function KindIcon({ kind }: { kind: HitKind }) {
  const path =
    kind === "page" ? (
      <path d="M3.5 2.5h6l3 3v8h-9zM9.5 2.5v3h3" />
    ) : kind === "account" ? (
      <path d="M2.5 13.5v-9l5-2v11M7.5 6.5h6v7M4.5 6.5h1M4.5 9h1M9.5 9h2M9.5 11h2M1.5 13.5h13" />
    ) : (
      <path d="M8 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3 13.5c.6-2.3 2.6-3.5 5-3.5s4.4 1.2 5 3.5" />
    );
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {path}
    </svg>
  );
}

export default function CommandPalette({ pages }: { pages: PageItem[] }) {
  const router = useRouter();
  const allLeads = useStore((s) => s.leads);
  const isManager = useStore((s) => s.isManager());
  const currentUserId = useStore((s) => s.currentUserId);
  // Only what this person can already see (reps: their own leads).
  const leads = useMemo(
    () => (isManager ? allLeads : allLeads.filter((l) => l.assignee === currentUserId)),
    [allLeads, isManager, currentUserId]
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<Hit[]>([]);
  const [leadId, setLeadId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const openPalette = useCallback(() => {
    setQuery("");
    setActive(0);
    setRecent(readRecent());
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (open || e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (typing) return;
      e.preventDefault();
      openPalette();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openPalette]);

  // With nothing typed: recent picks, then every page.
  const results: Hit[] = useMemo(() => {
    if (query.trim()) return quickSearch(query, leads, pages);
    const pageHits = pages.map((p) => ({ kind: "page" as const, id: p.href, title: p.label, detail: "Go to page" }));
    // A recent contact or account that's no longer visible (reassigned) is dropped.
    const seen = new Set(leads.map((l) => l.id));
    const accounts = new Set(leads.map((l) => l.account.toLowerCase()));
    const stillThere = recent.filter(
      (h) => h.kind === "page" ? pages.some((p) => p.href === h.id) : h.kind === "lead" ? seen.has(h.id) : accounts.has(h.id.toLowerCase())
    );
    return [...stillThere, ...pageHits];
  }, [query, leads, pages, recent]);

  const recentCount = query.trim() ? 0 : results.length - pages.length;

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(hit: Hit) {
    rememberRecent(hit);
    setOpen(false);
    if (hit.kind === "page") router.push(hit.id);
    else if (hit.kind === "account") router.push(accountHref(hit.id));
    else setLeadId(hit.id);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  // Group headings: "Recent" for the recent block, then by kind.
  const heading = (i: number): string | null => {
    if (i < recentCount) return i === 0 ? "Recent" : null;
    const kind = results[i].kind;
    const prev = i > recentCount ? results[i - 1].kind : null;
    if (i === recentCount || prev !== kind) return query.trim() ? GROUP_LABEL[kind] : "Go to";
    return null;
  };

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="shrink-0 flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-md border text-[12.5px] transition-colors hover:border-[var(--accent)]"
        style={{ borderColor: "var(--grid)", color: "var(--muted)", background: "var(--surface)" }}
        aria-label="Search"
        data-tip="Search everything (press /)"
        data-tip-side="bottom"
        aria-keyshortcuts="/"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5l3 3" />
        </svg>
        <span className="hidden lg:inline">Search…</span>
        <kbd className="hidden sm:inline font-mono text-[10.5px] px-1.5 py-px rounded border" style={{ borderColor: "var(--grid)", background: "var(--surface-2)" }}>
          /
        </kbd>
      </button>

      {open && (
        <div
          className="modal-backdrop fixed inset-0 z-[110] flex items-start justify-center p-4 pt-[12vh]"
          style={{ background: "rgba(0,0,0,.4)" }}
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Quick search"
            className="w-full max-w-[560px] rounded-xl border overflow-hidden"
            style={{ background: "var(--surface)", borderColor: "var(--grid)", boxShadow: "var(--shadow-lg)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 px-3.5 border-b" style={{ borderColor: "var(--grid)" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden style={{ color: "var(--muted)" }}>
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5l3 3" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search contacts, accounts, pages…"
                className="flex-1 py-3 bg-transparent outline-none fx-no-focus-ring text-[14px]"
                style={{ color: "var(--ink)" }}
                role="combobox"
                aria-expanded="true"
                aria-controls="qs-list"
                aria-activedescendant={results[active] ? `qs-${active}` : undefined}
                autoComplete="off"
                spellCheck={false}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="text-[11.5px] px-1.5 py-0.5 rounded"
                  style={{ color: "var(--muted)" }}
                >
                  Clear
                </button>
              )}
            </div>

            <div ref={listRef} id="qs-list" role="listbox" className="max-h-[52vh] overflow-y-auto py-1.5">
              {results.length === 0 && (
                <p className="px-4 py-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>
                  Nothing matches &ldquo;{query.trim()}&rdquo;.
                </p>
              )}
              {results.map((hit, i) => {
                const h = heading(i);
                const on = i === active;
                return (
                  <div key={`${i < recentCount ? "r" : ""}${hit.kind}:${hit.id}`}>
                    {h && (
                      <div className="px-4 pt-2 pb-1 font-mono uppercase tracking-wide" style={{ fontSize: "10px", color: "var(--muted)" }}>
                        {h}
                      </div>
                    )}
                    <div
                      id={`qs-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={on}
                      onMouseMove={() => setActive(i)}
                      onClick={() => choose(hit)}
                      className="mx-1.5 px-2.5 py-2 rounded-md flex items-center gap-3 cursor-pointer"
                      style={{ background: on ? "var(--accent-soft)" : "transparent" }}
                    >
                      <span
                        className="w-7 h-7 rounded-md grid place-items-center shrink-0"
                        style={{ background: on ? "var(--surface)" : "var(--surface-2)", color: on ? "var(--accent-ink)" : "var(--muted)" }}
                      >
                        <KindIcon kind={hit.kind} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                          {hit.title}
                        </span>
                        <span className="block text-[11.5px] truncate" style={{ color: "var(--muted)" }}>
                          {hit.detail}
                        </span>
                      </span>
                      {on && (
                        <span className="font-mono text-[11px] shrink-0" style={{ color: "var(--accent-ink)" }} aria-hidden>
                          ↵
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 px-4 py-2 border-t text-[11px]" style={{ borderColor: "var(--grid)", color: "var(--muted)" }}>
              <span><kbd className="font-mono">↑ ↓</kbd> move</span>
              <span><kbd className="font-mono">↵</kbd> open</span>
              <span><kbd className="font-mono">Esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}

      {leadId && <LeadDrawer leadId={leadId} onClose={() => setLeadId(null)} />}
    </>
  );
}
