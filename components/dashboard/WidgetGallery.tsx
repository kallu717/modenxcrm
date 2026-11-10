"use client";

import { useEffect } from "react";
import { widgetsForRole, type WidgetId, type WidgetPlacement } from "@/lib/widgets";
import type { Role } from "@/lib/types";

const GROUPS = ["My work", "My numbers", "Team", "Admin"] as const;

// The "Add widget" gallery: every widget this role may use, grouped, with
// the ones already on the dashboard marked.
export default function WidgetGallery({
  role,
  layout,
  onAdd,
  onClose,
}: {
  role: Role;
  layout: WidgetPlacement[];
  onAdd: (id: WidgetId) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const available = widgetsForRole(role);
  const onBoard = new Set(layout.map((w) => w.id));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.45)" }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a widget"
        className="w-full max-w-[820px] max-h-[88vh] overflow-auto rounded-xl p-5 space-y-5"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: "var(--ink)" }}>
              Add a widget
            </h2>
            <p className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
              New widgets go to the top. Drag them where you want and resize from the corner.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-md text-[18px] leading-none" style={{ color: "var(--ink-2)" }}>
            ×
          </button>
        </div>

        {GROUPS.map((g) => {
          const items = available.filter((w) => w.group === g);
          if (!items.length) return null;
          return (
            <div key={g}>
              <p className="text-[11.5px] uppercase tracking-wide font-mono mb-2" style={{ color: "var(--muted)" }}>
                {g}
              </p>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
                {items.map((w) => {
                  const added = onBoard.has(w.id);
                  return (
                    <div
                      key={w.id}
                      className="rounded-lg border p-3 flex flex-col gap-2"
                      style={{ borderColor: "var(--grid)", background: added ? "var(--surface-2)" : "var(--surface)" }}
                    >
                      <p className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                        {w.title}
                      </p>
                      <p className="text-[12px] flex-1" style={{ color: "var(--ink-2)" }}>
                        {w.blurb}
                      </p>
                      <button
                        type="button"
                        disabled={added}
                        onClick={() => onAdd(w.id)}
                        aria-label={added ? `${w.title} is already on your dashboard` : `Add ${w.title}`}
                        className="self-start px-3 py-1 rounded-md text-[12.5px] border disabled:cursor-default"
                        style={
                          added
                            ? { borderColor: "var(--grid)", color: "var(--muted)" }
                            : { borderColor: "var(--accent)", background: "var(--accent)", color: "white" }
                        }
                      >
                        {added ? "On your dashboard ✓" : "Add"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
