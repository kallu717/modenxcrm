"use client";

import { useEffect, useState } from "react";
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
  onPick: () => void;
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = (id: string) => setCurrent(applyTheme(id));
  const group = (mode: ThemeMode, title: string) => (
    <div>
      <p className="text-[11.5px] uppercase tracking-wide font-mono mb-2" style={{ color: "var(--muted)" }}>
        {title}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {THEMES.filter((t) => t.mode === mode).map((t) => (
          <Swatch key={t.id} {...t} active={current === t.id} onPick={() => pick(t.id)} />
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.45)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Themes"
        className="w-full max-w-[760px] max-h-[90vh] overflow-auto rounded-xl p-5 space-y-5"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: "var(--ink)" }}>
              Themes
            </h2>
            <p className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
              Changes apply straight away and are remembered on this computer.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
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
      </div>
    </div>
  );
}
