"use client";

import { useStore } from "@/lib/store";
import { STAGES, assignableList } from "@/lib/constants";
import { EMPTY_FILTERS, type FilterState } from "@/lib/filters";

const selectClass =
  "px-2.5 py-1.5 rounded-md text-[13px] border bg-transparent";
const selectStyle = { borderColor: "var(--grid)", color: "var(--ink)", background: "var(--surface)" };

export default function FilterBar({
  value,
  onChange,
  cities,
  quickFilters = true,
  fieldFilterCount,
  onOpenFieldFilter,
  onResetFieldFilter,
}: {
  value: FilterState;
  onChange: (f: FilterState) => void;
  cities: string[];
  // Leads has its own field-by-field panel that covers these same things
  // with more comparisons, so it hides the plain dropdowns rather than
  // showing both.
  quickFilters?: boolean;
  fieldFilterCount?: number;
  onOpenFieldFilter?: () => void;
  onResetFieldFilter?: () => void;
}) {
  const isManager = useStore((s) => s.isManager());
  const reps = assignableList();

  const set = <K extends keyof FilterState>(key: K, v: FilterState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      <input
        type="search"
        placeholder="Search name, account, city, lead ID…"
        aria-label="Search leads"
        value={value.search}
        onChange={(e) => set("search", e.target.value)}
        className="px-2.5 py-1.5 rounded-md text-[13px] border bg-transparent flex-1 min-w-[200px]"
        style={selectStyle}
      />
      {quickFilters && (
        <>
          <select
            aria-label="Filter by priority"
            className={selectClass}
            style={selectStyle}
            value={value.priority}
            onChange={(e) => set("priority", e.target.value as FilterState["priority"])}
          >
            <option value="">Any priority</option>
            <option>Hot</option>
            <option>Warm</option>
            <option>Nurture</option>
            <option>Low</option>
          </select>
          <select
            aria-label="Filter by account type"
            className={selectClass}
            style={selectStyle}
            value={value.type}
            onChange={(e) => set("type", e.target.value as FilterState["type"])}
          >
            <option value="">Any account type</option>
            <option>Brand</option>
            <option>Mall</option>
            <option>Store</option>
          </select>
          <select
            aria-label="Filter by stage"
            className={selectClass}
            style={selectStyle}
            value={value.stage}
            onChange={(e) => set("stage", e.target.value as FilterState["stage"])}
          >
            <option value="">Any stage</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by location"
            className={selectClass}
            style={selectStyle}
            value={value.city}
            onChange={(e) => set("city", e.target.value)}
          >
            <option value="">Any location</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {isManager && (
            <select
              aria-label="Filter by assignee"
              className={selectClass}
              style={selectStyle}
              value={value.assignee}
              onChange={(e) => set("assignee", e.target.value)}
            >
              <option value="">Everyone</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
              <option value="__unassigned">Unassigned</option>
            </select>
          )}
        </>
      )}
      {onOpenFieldFilter && (
        <button
          type="button"
          className="px-2.5 py-1.5 rounded-md text-[13px] border flex items-center gap-1.5"
          style={selectStyle}
          onClick={onOpenFieldFilter}
          data-tip="Build a filter from any field"
        >
          ⚙ Filter by field
          {!!fieldFilterCount && (
            <span
              className="rounded-full px-1.5 font-mono text-white"
              style={{ background: "var(--accent)", fontSize: "10px", lineHeight: "16px" }}
            >
              {fieldFilterCount}
            </span>
          )}
        </button>
      )}
      <button
        type="button"
        className="px-2.5 py-1.5 rounded-md text-[13px] border"
        style={selectStyle}
        onClick={() => {
          onChange(EMPTY_FILTERS);
          onResetFieldFilter?.();
        }}
      >
        Reset
      </button>
    </div>
  );
}
