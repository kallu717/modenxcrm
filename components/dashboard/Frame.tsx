"use client";

import Link from "next/link";
import { createContext, useContext } from "react";
import { widgetInfo, type WidgetId } from "@/lib/widgets";

export interface FrameControls {
  id: WidgetId;
  editing: boolean;
  index: number;
  count: number;
  onRemove: () => void;
  onMove: (delta: number) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onResizeKey: (e: React.KeyboardEvent) => void;
  size: { w: number; h: number };
}

export const FrameContext = createContext<FrameControls | null>(null);

const ctl = "w-7 h-7 rounded-md flex items-center justify-center text-[14px] leading-none border";

// The card around every widget: its title, a count, a link to the full page,
// and in edit mode the controls to move, remove and resize it.
export default function Frame({
  count,
  subtitle,
  more,
  children,
}: {
  count?: number;
  subtitle?: string;
  more?: { href: string; label: string };
  children: React.ReactNode;
}) {
  const c = useContext(FrameContext);
  if (!c) return null;
  const info = widgetInfo(c.id)!;

  return (
    <section
      aria-label={info.title}
      className="h-full flex flex-col rounded-xl relative"
      style={{
        background: "var(--surface)",
        boxShadow: "var(--shadow)",
        outline: c.editing ? "2px dashed var(--accent)" : undefined,
        outlineOffset: c.editing ? "-2px" : undefined,
      }}
    >
      <header className="flex items-center gap-2 px-4 pt-3 pb-2 shrink-0">
        {c.editing && (
          <span data-drag-handle className="cursor-grab select-none text-[15px]" style={{ color: "var(--muted)" }} title="Drag to move">
            ⠿
          </span>
        )}
        <h2 className="text-[14px] font-semibold truncate" style={{ color: "var(--ink)" }}>
          {info.title}
          {count != null && (
            <span className="ml-1.5 font-mono text-[12px] font-normal" style={{ color: "var(--muted)" }}>
              {count.toLocaleString("en-IN")}
            </span>
          )}
          {subtitle && (
            <span className="ml-1.5 text-[12px] font-normal" style={{ color: "var(--muted)" }}>
              · {subtitle}
            </span>
          )}
        </h2>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {c.editing ? (
            <>
              <span className="font-mono text-[11px] mr-1" style={{ color: "var(--muted)" }}>
                {c.size.w}×{c.size.h}
              </span>
              <button
                type="button"
                className={ctl}
                style={{ borderColor: "var(--grid)", color: "var(--ink-2)" }}
                aria-label={`Move ${info.title} earlier`}
                disabled={c.index === 0}
                onClick={() => c.onMove(-1)}
              >
                ←
              </button>
              <button
                type="button"
                className={ctl}
                style={{ borderColor: "var(--grid)", color: "var(--ink-2)" }}
                aria-label={`Move ${info.title} later`}
                disabled={c.index === c.count - 1}
                onClick={() => c.onMove(1)}
              >
                →
              </button>
              <button
                type="button"
                className={ctl}
                style={{ borderColor: "var(--crit)", color: "var(--crit)" }}
                aria-label={`Remove ${info.title}`}
                onClick={c.onRemove}
              >
                ✕
              </button>
            </>
          ) : (
            more && (
              <Link href={more.href} className="text-[12px]" style={{ color: "var(--accent)" }}>
                {more.label} →
              </Link>
            )
          )}
        </div>
      </header>

      <div
        className="flex-1 min-h-0 overflow-auto px-4 pb-3"
        style={{ pointerEvents: c.editing ? "none" : undefined, opacity: c.editing ? 0.75 : undefined }}
        inert={c.editing}
      >
        {children}
      </div>

      {c.editing && (
        <button
          type="button"
          aria-label={`Resize ${info.title}. Use the arrow keys, or drag.`}
          title="Drag to resize"
          className="absolute right-1 bottom-1 w-5 h-5 cursor-nwse-resize rounded"
          style={{ touchAction: "none" }}
          onPointerDown={c.onResizeStart}
          onKeyDown={c.onResizeKey}
        >
          <svg viewBox="0 0 10 10" className="w-full h-full" aria-hidden="true">
            <path d="M9 3 L3 9 M9 6 L6 9" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </section>
  );
}
