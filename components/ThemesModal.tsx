"use client";

import Modal from "@/components/Modal";
import { useState } from "react";
import { SYSTEM_THEME, THEMES, applyTheme, readTheme, type ThemeMode } from "@/lib/themes";

function Swatch({
  id,
  name,
  blurb,
  active,
  onPick,
}: {
  id: string;
  name: string;
  blurb: string;
  active: boolean;
  onPick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      aria-label={`${name} theme`}
      className="text-left rounded-lg border p-2"
      style={{
        borderColor: active ? "var(--accent)" : "var(--grid)",
        boxShadow: active ? "0 0 0 2px var(--accent)" : "none",
        background: "var(--surface)",
      }}
    >
      {/* The card wears the theme itself, so this is a true preview. */}
      <div data-theme={id} className="rounded-md p-2 mb-2" style={{ background: "var(--bg)" }}>
        <div
          className="rounded p-1.5 flex items-center gap-1.5"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}
        >
          <span className="w-3 h-3 rounded-sm" style={{ background: "var(--accent)" }} />
          <span className="h-1.5 flex-1 rounded-full" style={{ background: "var(--ink)", opacity: 0.8 }} />
        </div>
        <div className="flex gap-1 mt-1.5">
          <span className="h-1.5 w-8 rounded-full" style={{ background: "var(--ink-2)" }} />
          <span className="h-1.5 w-5 rounded-full" style={{ background: "var(--crit)" }} />
          <span className="h-1.5 w-5 rounded-full" style={{ background: "var(--good)" }} />
        </div>
      </div>
      <p className="text-[12.5px] font-medium flex items-center gap-1" style={{ color: "var(--ink)" }}>
        {name}
        {active && <span style={{ color: "var(--accent)" }}>✓</span>}
      </p>
      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
        {blurb}
      </p>
    </button>
  );
}

export default function ThemesModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState(readTheme);

  // The new theme spreads out in a circle from the swatch that was clicked
  // (where the browser supports it; otherwise it just switches).
  const pick = (id: string, e?: React.MouseEvent<HTMLElement>) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || reduced || !e) {
      setCurrent(applyTheme(id));
      return;
    }
    const x = e.clientX || innerWidth / 2;
    const y = e.clientY || innerHeight / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const root = document.documentElement.style;
    root.setProperty("--reveal-x", `${x}px`);
    root.setProperty("--reveal-y", `${y}px`);
    root.setProperty("--reveal-r", `${r}px`);
    doc.startViewTransition(() => setCurrent(applyTheme(id)));
  };
  const group = (mode: ThemeMode, title: string) => (
    <div>
      <p className="text-[11.5px] uppercase tracking-wide font-mono mb-2" style={{ color: "var(--muted)" }}>
        {title}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {THEMES.filter((t) => t.mode === mode).map((t) => (
          <Swatch key={t.id} {...t} active={current === t.id} onPick={(e) => pick(t.id, e)} />
        ))}
      </div>
    </div>
  );

  return (
    <Modal onClose={onClose} label={"Themes"} width="max-w-[760px]" className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
              Themes
            </h2>
            <p className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
              Changes apply straight away and are remembered on this computer.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close" data-tip="Close"
            className="w-8 h-8 rounded-md text-[18px] leading-none"
            style={{ color: "var(--ink-2)" }}
          >
            ×
          </button>
        </div>

        <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "var(--ink)" }}>
          <input type="checkbox" checked={current === SYSTEM_THEME} onChange={() => pick(SYSTEM_THEME)} />
          Match my device (Sage in light mode, Forest in dark mode)
        </label>

        {group("light", "Light")}
        {group("dark", "Dark")}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md text-[13px] font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            Done
          </button>
        </div>
    </Modal>
  );
}
