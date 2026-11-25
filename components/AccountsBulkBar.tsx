"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { repById } from "@/lib/constants";
import { accountsCsv, type AccountSummary } from "@/lib/accounts";
import OwnerSelect from "@/components/OwnerSelect";
import type { Priority } from "@/lib/types";

const plural = (n: number, one: string, many = one + "s") => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

// Floats at the bottom while accounts are ticked. Managers only: the server
// refuses assignment and deletion from anyone else anyway.
export default function AccountsBulkBar({
  selected,
  onClear,
  canSelectAllMatching,
  onSelectAllMatching,
  matchingCount,
}: {
  selected: AccountSummary[];
  onClear: () => void;
  canSelectAllMatching: boolean;
  onSelectAllMatching: () => void;
  matchingCount: number;
}) {
  const assignAccount = useStore((s) => s.assignAccount);
  const deleteAccount = useStore((s) => s.deleteAccount);
  const setPriority = useStore((s) => s.setPriority);
  const showToast = useStore((s) => s.showToast);
  const [owner, setOwner] = useState<string | null | undefined>(undefined);
  const [priority, setPriorityChoice] = useState<string>("");

  if (!selected.length) return null;
  const contacts = selected.reduce((n, a) => n + a.contacts.length, 0);
  const what = plural(selected.length, "account");

  const assign = () => {
    if (owner === undefined) return;
    selected.forEach((a) => assignAccount(a.name, owner));
    showToast(owner ? `${what} assigned to ${repById(owner)?.name}` : `${what} unassigned`);
    setOwner(undefined);
    onClear();
  };

  const applyPriority = () => {
    if (!priority) return;
    const p = priority === "auto" ? null : (priority as Priority);
    selected.forEach((a) => a.contacts.forEach((c) => setPriority(c.id, p)));
    showToast(`${plural(contacts, "contact")} set to ${p ?? "automatic priority"}`);
    setPriorityChoice("");
  };

  const exportCsv = () => {
    const csv = accountsCsv(selected, (id) => repById(id)?.name || "Unassigned");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const remove = () => {
    const ok = confirm(
      `Delete ${what} and all ${plural(contacts, "contact")} in them?\n\n` +
        selected.slice(0, 8).map((a) => "• " + a.name).join("\n") +
        (selected.length > 8 ? `\n…and ${selected.length - 8} more` : "") +
        "\n\nThis can't be undone."
    );
    if (!ok) return;
    selected.forEach((a) => deleteAccount(a.name));
    showToast(`${what} and ${plural(contacts, "contact")} deleted`);
    onClear();
  };

  const btn = "px-3 py-1 rounded-md text-[12.5px] border disabled:opacity-40 disabled:cursor-not-allowed";
  const select = "rounded-md border px-2 py-1 text-[12px]";

  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
      <div
        role="region"
        aria-label="Actions for selected accounts"
        className="pointer-events-auto w-full max-w-[1100px] rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px]"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--accent)", color: "var(--ink)" }}
      >
        <div>
          <b>{what} selected</b> <span style={{ color: "var(--ink-2)" }}>({plural(contacts, "contact")})</span>
          {canSelectAllMatching && (
            <button type="button" className="ml-2 underline" style={{ color: "var(--accent)" }} onClick={onSelectAllMatching}>
              Select all {matchingCount.toLocaleString("en-IN")} matching
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <OwnerSelect
            label="Assign the selected accounts to"
            compact
            placeholder="Assign to…"
            value={owner === undefined ? "__choose" : owner || ""}
            onChange={setOwner}
          />
          <button
            type="button"
            className={btn}
            disabled={owner === undefined}
            onClick={assign}
            style={{ background: "var(--accent)", borderColor: "var(--accent)", color: "white" }}
          >
            Assign
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            aria-label="Set priority for every contact in the selected accounts"
            className={select}
            value={priority}
            onChange={(e) => setPriorityChoice(e.target.value)}
            style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
          >
            <option value="">Set priority…</option>
            <option value="Hot">Hot</option>
            <option value="Warm">Warm</option>
            <option value="Nurture">Nurture</option>
            <option value="Low">Low</option>
            <option value="auto">Automatic (score)</option>
          </select>
          <button
            type="button"
            className={btn}
            disabled={!priority}
            onClick={applyPriority}
            style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
          >
            Apply
          </button>
        </div>

        <button type="button" className={btn} onClick={exportCsv} style={{ borderColor: "var(--grid)", color: "var(--ink)" }}>
          Export CSV
        </button>
        <button type="button" className={btn} onClick={remove} style={{ borderColor: "var(--crit)", color: "var(--crit)" }}>
          Delete
        </button>

        <button
          type="button"
          className="ml-auto px-2 py-1 text-[12px] underline"
          style={{ color: "var(--ink-2)" }}
          onClick={onClear}
        >
          Clear selection
        </button>
      </div>
    </div>
  );
}
