"use client";

// A row of tab-like buttons with the same sliding highlight as the top menu
// (Masthead): it sits under the hovered one, or the chosen one when nothing's
// hovered, and glides there instead of jumping. Used for Follow-ups' date
// range, Reports' range, Revenue's quarters, and anywhere else that's really
// a set of same-page choices rather than a place to navigate to.

import { useLayoutEffect, useRef, useState } from "react";

export interface PillTabItem {
  key: string;
  label: React.ReactNode;
}

export default function PillTabs({
  items,
  active,
  onChange,
  className = "",
}: {
  items: PillTabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  const navRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pill, setPill] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const target = hovered ?? active;

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const place = () => {
      const el = target ? nav.querySelector<HTMLElement>(`[data-pill-tab="${target}"]`) : null;
      setPill(el ? { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight } : null);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [target, items.length]);

  return (
    <div
      ref={navRef}
      className={`relative flex items-center gap-1 flex-wrap ${className}`}
      onMouseLeave={() => setHovered(null)}
    >
      <span
        aria-hidden
        className="fx-nav-pill"
        style={{ left: pill?.left ?? 0, top: pill?.top ?? 0, width: pill?.width ?? 0, height: pill?.height ?? 0, opacity: pill ? 1 : 0 }}
      />
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            data-pill-tab={item.key}
            aria-current={isActive ? "true" : undefined}
            onMouseEnter={() => setHovered(item.key)}
            onFocus={() => setHovered(item.key)}
            onBlur={() => setHovered(null)}
            onClick={() => onChange(item.key)}
            className="relative shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors"
            style={{ color: isActive || hovered === item.key ? "var(--accent-ink)" : "var(--ink-2)" }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
