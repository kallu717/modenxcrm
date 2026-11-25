"use client";

// Small motion pieces used across the app, written for bdCRM after free,
// open-source patterns (Magic UI, Motion Primitives, shadcn/ui). Every one
// follows the theme's colours and stays still for people whose device asks
// for less motion.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(noSubscribe, prefersReducedMotion, () => false);
}

// ---------------------------------------------------------------- Number Ticker
// Counts up (or down) to `value` with an ease-out. The first time from 0, then
// from wherever it was. Screen readers get the final number straight away.

export function NumberTicker({
  value,
  format = (n) => Math.round(n).toLocaleString("en-IN"),
  duration = 900,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(2, -10 * t); // ease-out expo
      const n = t >= 1 ? value : a + (value - a) * eased;
      setShown(n);
      from.current = n;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return (
    <span className="tabular-nums">
      <span aria-hidden>{format(reduced ? value : shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

// ---------------------------------------------------------------- Progress Ring
// A ring that fills toward a target (Magic UI "Animated Circular Progress").

export function ProgressRing({
  done,
  target,
  size = 64,
  stroke = 6,
  children,
}: {
  done: number;
  target: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, done / target) : 0;
  const color = done >= target && target > 0 ? "var(--good)" : "var(--accent)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          className="fx-ring"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ ["--ring-from" as string]: String(c) }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Glow follow
// Magic Card: a soft spotlight that follows the mouse across a card. Spread
// the returned handlers on the card and give it the `fx-glow` class.

export function glowHandlers() {
  return {
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    },
  };
}

// ---------------------------------------------------------------- Skeleton
// Placeholder shapes with a moving shine while something loads.

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={`fx-skeleton rounded-md ${className}`} style={style} />;
}

// The whole app while it loads after sign-in: a top bar and a few cards.
export function AppSkeleton() {
  return (
    <div role="status" aria-label="Loading bdCRM" className="min-h-screen">
      <div className="border-b" style={{ borderColor: "var(--grid)" }}>
        <div className="max-w-[1320px] mx-auto px-[18px] py-3 flex items-center gap-4">
          <Skeleton className="w-[26px] h-[26px]" />
          <Skeleton className="w-36 h-4" />
          <div className="hidden md:flex gap-2 ml-4">
            {[64, 56, 48, 64, 72].map((w, i) => (
              <Skeleton key={i} className="h-6" style={{ width: w }} />
            ))}
          </div>
          <Skeleton className="ml-auto w-8 h-8 rounded-full" />
        </div>
      </div>
      <div className="max-w-[1320px] mx-auto px-[18px] pt-6">
        <Skeleton className="w-64 h-6" />
        <Skeleton className="w-40 h-3.5 mt-2.5" />
        <div className="grid gap-4 mt-6 md:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}>
              <Skeleton className="w-28 h-4" />
              <Skeleton className="w-full h-3 mt-4" />
              <Skeleton className="w-4/5 h-3 mt-2.5" />
              <Skeleton className="w-3/5 h-3 mt-2.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
