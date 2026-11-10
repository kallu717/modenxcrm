"use client";

import { assignableList, repById } from "@/lib/constants";

export function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// A person's initials in their colour, then their name.
export function OwnerName({ id, size = 18 }: { id: string | null; size?: number }) {
  const rep = repById(id);
  if (!rep) return <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Unassigned</span>;
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
      <span
        className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
        style={{ background: rep.color, width: size, height: size, fontSize: Math.round(size * 0.45) }}
      >
        {initials(rep.name)}
      </span>
      {rep.name}
    </span>
  );
}

// Who an account or location can be given to: reps, and managers who sell.
// onChange gets null for "Unassigned", undefined for the "Choose…" placeholder.
export default function OwnerSelect({
  value,
  onChange,
  placeholder,
  label,
  compact,
}: {
  value: string;
  onChange: (repId: string | null | undefined) => void;
  placeholder?: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "__choose" ? undefined : v || null);
      }}
      className={`rounded-md border ${compact ? "px-2 py-1 text-[12px]" : "px-2.5 py-1.5 text-[13px]"}`}
      style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
    >
      {placeholder && <option value="__choose">{placeholder}</option>}
      <option value="">Unassigned</option>
      {assignableList().map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
          {r.role === "Manager" ? " (manager)" : ""}
        </option>
      ))}
    </select>
  );
}
