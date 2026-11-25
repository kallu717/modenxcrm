"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { toastDuration, type ToastTone } from "@/lib/toast";

// Colour and icon per kind of message (lib/toast.ts decides which).
const TONES: Record<ToastTone, { color: string; icon: React.ReactNode; label: string }> = {
  success: {
    color: "var(--accent)",
    label: "Done",
    icon: <path d="M4 8.5l2.5 2.5L12 5.5" />,
  },
  error: {
    color: "var(--crit)",
    label: "Problem",
    icon: (
      <>
        <path d="M8 4.5v4" />
        <path d="M8 11.2v.1" />
      </>
    ),
  },
  info: {
    color: "var(--ink-2)",
    label: "Note",
    icon: (
      <>
        <path d="M8 7.5v4" />
        <path d="M8 4.8v.1" />
      </>
    ),
  },
};

export default function Toast() {
  const toast = useStore((s) => s.toast);
  const [dismissedId, setDismissedId] = useState<number | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setDismissedId(toast.id), toastDuration(toast.tone));
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast || toast.id === dismissedId) return null;
  const tone = TONES[toast.tone];
  return (
    <div
      key={toast.id}
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      className="toast-in fixed bottom-5 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-32px)] max-w-[440px]"
    >
      <div
        className="flex items-start gap-2.5 pl-3 pr-2 py-2.5 rounded-lg border text-[13px]"
        style={{
          background: "var(--surface)",
          color: "var(--ink)",
          borderColor: `color-mix(in srgb, ${tone.color} 35%, var(--grid))`,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <span
          aria-hidden
          className="mt-px shrink-0 w-5 h-5 rounded-full grid place-items-center"
          style={{ background: `color-mix(in srgb, ${tone.color} 16%, transparent)`, color: tone.color }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            {tone.icon}
          </svg>
        </span>
        <span className="sr-only">{tone.label}: </span>
        <span className="flex-1 min-w-0 leading-snug pt-px">{toast.msg}</span>
        <button
          type="button"
          onClick={() => setDismissedId(toast.id)}
          aria-label="Dismiss" data-tip="Dismiss"
          className="shrink-0 w-6 h-6 -my-0.5 rounded grid place-items-center hover:opacity-100 opacity-60"
          style={{ color: "var(--muted)" }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
