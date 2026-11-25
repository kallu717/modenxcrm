"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { STAGES, repById } from "@/lib/constants";
import {
  filterLocations,
  ownerSummary,
  type AccountSummary,
  type LocationSort,
  type LocationStatus,
} from "@/lib/accounts";
import { agingBucket, AGING_MAX_DAYS } from "@/lib/revenue";
import OwnerSelect, { OwnerName } from "./OwnerSelect";

const AGING_STYLE: Record<string, { bg: string; fg: string }> = {
  ok: { bg: "var(--good-soft)", fg: "var(--good)" },
  caution: { bg: "var(--accent-soft)", fg: "var(--accent-ink)" },
  warn: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  crit: { bg: "var(--crit-soft)", fg: "var(--crit)" },
};

const th = "text-left py-2 px-2 text-[11px] font-medium uppercase tracking-wide whitespace-nowrap";
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

// Who owns which city of an account. Managers assign one city at a time or
// tick several and assign them together; reps see their own cities only.
export default function AccountOwnership({
  account,
  onShowContacts,
}: {
  account: AccountSummary;
  onShowContacts: (cityKey: string) => void;
}) {
  const isManager = useStore((s) => s.isManager());
  const assignLocation = useStore((s) => s.assignLocation);
  const showToast = useStore((s) => s.showToast);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LocationStatus>("all");
  const [owner, setOwner] = useState<string | null>(null);
  const [sort, setSort] = useState<LocationSort>("contacts");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOwner, setBulkOwner] = useState<string | null | undefined>(undefined);

  const shares = useMemo(() => ownerSummary(account.locations), [account.locations]);
  const rows = useMemo(
    () => filterLocations(account.locations, { query, status, owner, sort }),
    [account.locations, query, status, owner, sort]
  );
  // Selections only ever refer to cities still in the account.
  const liveSelected = useMemo(
    () => new Set([...selected].filter((k) => account.locations.some((l) => l.key === k))),
    [selected, account.locations]
  );
  const selectedContacts = account.locations
    .filter((l) => liveSelected.has(l.key))
    .reduce((n, l) => n + l.contacts.length, 0);
  const allShownSelected = rows.length > 0 && rows.every((r) => liveSelected.has(r.key));

  const toggle = (key: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleAllShown = () =>
    setSelected((s) => {
      const next = new Set(s);
      rows.forEach((r) => (allShownSelected ? next.delete(r.key) : next.add(r.key)));
      return next;
    });

  const assignOne = (key: string, city: string, repId: string | null) => {
    assignLocation(account.name, key, repId);
    const where = account.locations.length > 1 ? `${account.name} · ${city}` : account.name;
    showToast(repId ? `${where} assigned to ${repById(repId)?.name}` : `${where} unassigned`);
  };

  const assignSelected = () => {
    if (bulkOwner === undefined || !liveSelected.size) return;
    liveSelected.forEach((key) => assignLocation(account.name, key, bulkOwner));
    const n = liveSelected.size;
    showToast(
      bulkOwner
        ? `${plural(n, "city", "cities")} of ${account.name} assigned to ${repById(bulkOwner)?.name}`
        : `${plural(n, "city", "cities")} of ${account.name} unassigned`
    );
    setSelected(new Set());
    setBulkOwner(undefined);
  };

  // ---- an account in one city: a single owner, nothing to split ----
  if (account.locations.length === 1) {
    const loc = account.locations[0];
    const bucket = agingBucket(loc.agingDays);
    return (
      <section className="rounded-lg border p-4" style={{ borderColor: "var(--grid)", background: "var(--surface)" }}>
        <h2 className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Owner</h2>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
          All {plural(loc.contacts.length, "contact")} {loc.key ? `are in ${loc.city}` : "have no city"}, so the
          account has one owner. If contacts in another city are added later, each city gets its own owner.
        </p>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {isManager ? (
            <OwnerSelect
              label={`Owner of ${account.name}`}
              value={loc.owner || ""}
              onChange={(repId) => repId !== undefined && assignOne(loc.key, loc.city, repId)}
            />
          ) : (
            <OwnerName id={loc.owner} />
          )}
          {loc.agingDays != null && (
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>
              At {STAGES.find((s) => s.id === loc.furthest)?.name} for {loc.agingDays}d
            </span>
          )}
        </div>
        {bucket && loc.agingDays != null && loc.agingDays >= AGING_MAX_DAYS && (
          <p className="text-[12px] mt-2" style={{ color: "var(--crit)" }}>
            Stuck at this stage for over 3 months — consider giving it to someone else.
          </p>
        )}
      </section>
    );
  }

  // ---- several cities: a table, one row per city ----
  const unassigned = shares.find((s) => s.owner === null);
  return (
    <section className="rounded-lg border" style={{ borderColor: "var(--grid)", background: "var(--surface)" }}>
      <div className="p-4 pb-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
            Who owns which city
          </h2>
          <span className="text-[12px] font-mono" style={{ color: "var(--muted)" }}>
            {plural(account.locations.length, "city", "cities")} ·{" "}
            {account.locations.length - (unassigned?.cities || 0)} assigned
            {unassigned ? ` · ${unassigned.cities} unassigned` : ""}
          </span>
        </div>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
          {isManager
            ? "Each city can go to a different person. Change one in its row, or tick several and assign them together. A new city starts unassigned."
            : "The cities of this account that are yours."}
        </p>

        {/* Owner chips: who has how much. Click one to show only their cities. */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {shares.map((s) => {
            const active = s.owner === null ? status === "unassigned" : owner === s.owner;
            return (
              <button
                key={s.owner || "none"}
                type="button"
                onClick={() => {
                  if (s.owner === null) {
                    setOwner(null);
                    setStatus(active ? "all" : "unassigned");
                  } else {
                    setStatus("all");
                    setOwner(active ? null : s.owner);
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px]"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--grid)",
                  background: active ? "var(--accent-soft)" : "var(--surface-2)",
                  color: "var(--ink)",
                }}
                aria-pressed={active}
              >
                {s.owner ? <OwnerName id={s.owner} size={16} /> : <span style={{ color: "var(--warn)" }}>● Unassigned</span>}
                <span style={{ color: "var(--muted)" }}>
                  · {plural(s.cities, "city", "cities")} · {plural(s.contacts, "contact")}
                </span>
              </button>
            );
          })}
        </div>

        {/* Find and narrow */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a city…"
            aria-label="Find a city"
            className="px-2.5 py-1.5 rounded-md border text-[13px] w-[200px]"
            style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
          />
          <div className="flex rounded-md border overflow-hidden" style={{ borderColor: "var(--grid)" }}>
            {(["all", "unassigned", "assigned"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setStatus(v);
                  if (v === "unassigned") setOwner(null);
                }}
                className="px-2.5 py-1.5 text-[12px] capitalize"
                style={{
                  background: status === v ? "var(--accent-soft)" : "var(--surface)",
                  color: status === v ? "var(--accent-ink)" : "var(--ink-2)",
                }}
                aria-pressed={status === v}
              >
                {v}
              </button>
            ))}
          </div>
          {(query || status !== "all" || owner) && (
            <button
              type="button"
              className="text-[12px] underline"
              style={{ color: "var(--muted)" }}
              onClick={() => {
                setQuery("");
                setStatus("all");
                setOwner(null);
              }}
            >
              Show all cities
            </button>
          )}
          <span className="ml-auto text-[12px]" style={{ color: "var(--muted)" }}>
            Showing {rows.length} of {account.locations.length}
          </span>
        </div>
      </div>

      {/* Bulk action bar, only while cities are ticked */}
      {isManager && liveSelected.size > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 px-4 py-2 text-[12.5px]"
          style={{ background: "var(--accent-soft)", borderTop: "1px solid var(--grid)", color: "var(--ink)" }}
        >
          <b>{plural(liveSelected.size, "city", "cities")} selected</b>
          <span style={{ color: "var(--ink-2)" }}>({plural(selectedContacts, "contact")})</span>
          <span className="ml-2">Assign to</span>
          <OwnerSelect
            label="Assign the selected cities to"
            compact
            placeholder="Choose a person…"
            value={bulkOwner === undefined ? "__choose" : bulkOwner || ""}
            onChange={setBulkOwner}
          />
          <button
            type="button"
            disabled={bulkOwner === undefined}
            onClick={assignSelected}
            className="px-3 py-1 rounded-md text-[12.5px] text-white disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            Assign
          </button>
          <button
            type="button"
            className="px-2 py-1 text-[12px] underline"
            style={{ color: "var(--ink-2)" }}
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-x-auto max-h-[480px] overflow-y-auto" style={{ borderTop: "1px solid var(--grid)" }}>
        <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
          <thead className="sticky top-0 z-[1]" style={{ background: "var(--surface-2)" }}>
            <tr style={{ color: "var(--muted)" }}>
              {isManager && (
                <th className="py-2 pl-4 pr-1 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all cities shown"
                    checked={allShownSelected}
                    onChange={toggleAllShown}
                  />
                </th>
              )}
              <SortTh label="City" arrow="↑" active={sort === "city"} onClick={() => setSort("city")} />
              <SortTh label="Contacts" active={sort === "contacts"} onClick={() => setSort("contacts")} />
              <th className={th}>Furthest stage</th>
              <SortTh label="Stuck for" active={sort === "days"} onClick={() => setSort("days")} />
              <th className={th}>Owner</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-6" style={{ color: "var(--muted)" }}>
                  No cities match.
                </td>
              </tr>
            )}
            {rows.map((loc) => {
              const stage = STAGES.find((s) => s.id === loc.furthest);
              const bucket = agingBucket(loc.agingDays);
              const aStyle = bucket ? AGING_STYLE[bucket.cls] : null;
              const checked = liveSelected.has(loc.key);
              return (
                <tr
                  key={loc.key}
                  style={{
                    borderTop: "1px solid var(--grid)",
                    background: checked ? "var(--accent-soft)" : undefined,
                  }}
                >
                  {isManager && (
                    <td className="py-1.5 pl-4 pr-1">
                      <input
                        type="checkbox"
                        aria-label={`Select ${loc.city}`}
                        checked={checked}
                        onChange={() => toggle(loc.key)}
                      />
                    </td>
                  )}
                  <td className="py-1.5 px-2">
                    <span className="font-medium" style={{ color: "var(--ink)" }}>{loc.city}</span>
                  </td>
                  <td className="py-1.5 px-2">
                    <button
                      type="button"
                      className="underline decoration-dotted"
                      style={{ color: "var(--accent-ink)" }}
                      onClick={() => onShowContacts(loc.key)}
                      title={`See the contacts in ${loc.city}`}
                    >
                      {loc.contacts.length}
                    </button>
                  </td>
                  <td className="py-1.5 px-2" style={{ color: "var(--ink-2)" }}>{stage?.name}</td>
                  <td className="py-1.5 px-2">
                    {aStyle && loc.agingDays != null ? (
                      <span className="px-1.5 py-0.5 rounded text-[10.5px] font-mono" style={{ background: aStyle.bg, color: aStyle.fg }}>
                        {loc.agingDays}d
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2">
                    {isManager ? (
                      <OwnerSelect
                        label={`Owner of ${account.name} · ${loc.city}`}
                        compact
                        value={loc.owner || ""}
                        onChange={(repId) => repId !== undefined && assignOne(loc.key, loc.city, repId)}
                      />
                    ) : (
                      <OwnerName id={loc.owner} size={16} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SortTh({ label, active, onClick, arrow = "↓" }: { label: string; active: boolean; onClick: () => void; arrow?: string }) {
  return (
    <th className={th}>
      <button
        type="button"
        onClick={onClick}
        className="uppercase tracking-wide"
        style={{ color: active ? "var(--ink)" : "var(--muted)" }}
        aria-pressed={active}
      >
        {label}
        {active ? ` ${arrow}` : ""}
      </button>
    </th>
  );
}
