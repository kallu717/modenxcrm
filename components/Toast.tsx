"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

export default function Toast() {
  const toast = useStore((s) => s.toast);
  const [dismissedId, setDismissedId] = useState<number | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setDismissedId(toast.id), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast || toast.id === dismissedId) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] px-4 py-2 rounded-lg text-[13px]"
      style={{ background: "var(--ink)", color: "var(--bg)", boxShadow: "var(--shadow-lg)" }}
    >
      {toast.msg}
    </div>
  );
}
