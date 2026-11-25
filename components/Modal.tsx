"use client";

// One frame for every pop-up window, so they all look and behave the same:
// dimmed, blurred background; a centred card that pops in; Esc or a click
// outside closes it; screen readers hear it as a dialog; the page behind
// doesn't scroll. When windows are stacked (a window opened from the contact
// drawer), Esc closes only the top one.

import { useEffect, useId, useRef } from "react";

const stack: string[] = [];

export function useEscape(onClose: () => void): void {
  const id = useId();
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    stack.push(id);
    const body = document.body.style;
    const before = body.overflow;
    if (stack.length === 1) body.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stack[stack.length - 1] === id) {
        e.preventDefault();
        latest.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const i = stack.lastIndexOf(id);
      if (i >= 0) stack.splice(i, 1);
      if (stack.length === 0) body.overflow = before === "hidden" ? "" : before;
    };
  }, [id]);
}

export default function Modal({
  onClose,
  label,
  width = "max-w-md",
  className = "",
  children,
}: {
  onClose: () => void;
  label: string;
  width?: string;
  className?: string;
  children: React.ReactNode;
}) {
  useEscape(onClose);
  return (
    <div
      className="modal-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.45)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`w-full ${width} max-h-[90vh] overflow-y-auto rounded-xl border p-5 ${className}`}
        style={{ background: "var(--surface)", borderColor: "var(--grid)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
