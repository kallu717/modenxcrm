"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { STAGES } from "@/lib/constants";
import { locationKey, type AccountSummary } from "@/lib/accounts";
import { effectivePriority } from "@/lib/scoring";
import { fmtFollowup } from "@/lib/dates";
import { OwnerName } from "./OwnerSelect";

const th = "text-left py-2 px-2 text-[11px] font-medium uppercase tracking-wide whitespace-nowrap";

// Everyone at the account, optionally narrowed to one city. Click a row to
// open the contact.
export default function AccountContacts({
  account,
  cityKey,
  onCityChange,
  onOpenLead,
}: {
  account: AccountSummary;
  cityKey: string | null;
  onCityChange: (key: string | null) => void;
  onOpenLead: (id: string) => void;
}) {
  const router = useRouter();
  const isManager = useStore((s) => s.isManager());
  const deleteLead = useStore((s) => s.deleteLead);
  const showToast = useStore((s) => s.showToast);
  const multiCity = account.locations.length > 1;

  const contacts = useMemo(
    () =>
      account.contacts
        .filter((c) => cityKey === null || locationKey(c.city) === cityKey)
        .sort((a, b) => b.score - a.score),
    [account.contacts, cityKey]
  );

  return (
    <section
      id="account-contacts"
      className="rounded-lg border"
      style={{ borderColor: "var(--grid)", background: "var(--surface)" }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap p-4 pb-3">
        <h2 className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
          Contacts{" "}
          <span className="font-normal text-[12px]" style={{ color: "var(--muted)" }}>
            · {contacts.length}
            {cityKey !== null ? ` of ${account.contacts.length}` : ""}
          </span>
        </h2>
        {multiCity && (
          <select
            aria-label="Show contacts in"
            value={cityKey ?? "__all"}
            onChange={(e) => onCityChange(e.target.value === "__all" ? null : e.target.value)}
            className="px-2.5 py-1.5 rounded-md border text-[12.5px]"
            style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
          >
            <option value="__all">All cities</option>
            {[...account.locations]
              .sort((a, b) => a.city.localeCompare(b.city))
              .map((l) => (
                <option key={l.key} value={l.key}>
                  {l.city} ({l.contacts.length})
                </option>
              ))}
          </select>
        )}
      </div>
      <div className="overflow-x-auto max-h-[520px] overflow-y-auto" style={{ borderTop: "1px solid var(--grid)" }}>
        <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
          <thead className="sticky top-0 z-[1]" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
            <tr>
              <th className={th}>Contact</th>
              {multiCity && <th className={th}>City</th>}
              <th className={th}>Owner</th>
              <th className={th}>Stage</th>
              <th className={th}>Priority</th>
              <th className={th}>Next follow-up</th>
              {isManager && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr
                key={c.id}
                className="cursor-pointer"
                style={{ borderTop: "1px solid var(--grid)" }}
                onClick={() => onOpenLead(c.id)}
              >
                <td className="py-1.5 px-2">
                  <div style={{ color: "var(--ink)" }}>{c.name}</div>
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>{c.title}</div>
                </td>
                {multiCity && <td className="py-1.5 px-2" style={{ color: "var(--ink-2)" }}>{c.city}</td>}
                <td className="py-1.5 px-2"><OwnerName id={c.assignee} size={16} /></td>
                <td className="py-1.5 px-2" style={{ color: "var(--ink-2)" }}>
                  {STAGES.find((s) => s.id === c.stage)?.name}
                </td>
                <td className="py-1.5 px-2">
                  <span className="px-1.5 py-0.5 rounded text-[10.5px] font-mono" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
                    {effectivePriority(c)}
                  </span>
                </td>
                <td className="py-1.5 px-2" style={{ color: "var(--ink-2)" }}>
                  {c.nextFollowup ? fmtFollowup(c.nextFollowup) : <span style={{ color: "var(--muted)" }}>—</span>}
                </td>
                {isManager && (
                  <td className="py-1.5 px-2 text-right">
                    <button
                      type="button"
                      aria-label={`Delete ${c.name}`}
                      className="px-1.5 text-[13px]"
                      style={{ color: "var(--muted)" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete ${c.name}? This can't be undone.`)) {
                          deleteLead(c.id);
                          showToast(`${c.name} deleted`);
                          // The last contact gone means the account itself is gone.
                          if (account.contacts.length === 1) router.push("/accounts");
                        }
                      }}
                    >
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
