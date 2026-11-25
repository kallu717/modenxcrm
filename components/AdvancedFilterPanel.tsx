"use client";

// "Filter leads by field" — after Zoho CRM's Leads filter panel. Search for
// any field, tick it, and a small is/contains/before… row appears right
// there so you can say what you want; tick as many fields as you like and
// Apply keeps every lead that matches all of them.

import { useMemo, useState } from "react";
import { useEscape } from "@/components/Modal";
import {
  NO_VALUE_OPERATORS,
  OPERATORS_BY_TYPE,
  TWO_VALUE_OPERATORS,
  emptyCriterion,
  type FieldCriterion,
  type FilterFieldDef,
} from "@/lib/advancedFilters";

const inputStyle = { borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" };

function ValueInput({
  field,
  criterion,
  onChange,
}: {
  field: FilterFieldDef;
  criterion: FieldCriterion;
  onChange: (next: FieldCriterion) => void;
}) {
  if (NO_VALUE_OPERATORS.has(criterion.operator)) return null;

  if (field.type === "boolean") {
    return (
      <select
        value={criterion.value}
        onChange={(e) => onChange({ ...criterion, value: e.target.value })}
        className="w-full px-2 py-1 rounded-md text-[12.5px] border"
        style={inputStyle}
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <select
        value={criterion.value}
        onChange={(e) => onChange({ ...criterion, value: e.target.value })}
        className="w-full px-2 py-1 rounded-md text-[12.5px] border"
        style={inputStyle}
      >
        <option value="" disabled>
          Choose…
        </option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  const two = TWO_VALUE_OPERATORS.has(criterion.operator);
  const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
  return (
    <div className={two ? "grid grid-cols-2 gap-1.5" : ""}>
      <input
        type={inputType}
        value={criterion.value}
        placeholder={field.type === "text" ? "Value" : undefined}
        onChange={(e) => onChange({ ...criterion, value: e.target.value })}
        className="w-full px-2 py-1 rounded-md text-[12.5px] border"
        style={inputStyle}
      />
      {two && (
        <input
          type={inputType}
          value={criterion.value2 || ""}
          onChange={(e) => onChange({ ...criterion, value2: e.target.value })}
          className="w-full px-2 py-1 rounded-md text-[12.5px] border"
          style={inputStyle}
        />
      )}
    </div>
  );
}

export default function AdvancedFilterPanel({
  fields,
  criteria,
  onApply,
  onClose,
}: {
  fields: FilterFieldDef[];
  criteria: FieldCriterion[];
  onApply: (next: FieldCriterion[]) => void;
  onClose: () => void;
}) {
  useEscape(onClose);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<FieldCriterion[]>(criteria);

  const byKey = useMemo(() => new Map(draft.map((c) => [c.field, c])), [draft]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = q ? fields.filter((f) => f.label.toLowerCase().includes(q)) : fields;
    const order: string[] = [];
    const by = new Map<string, FilterFieldDef[]>();
    for (const f of shown) {
      if (!by.has(f.group)) {
        by.set(f.group, []);
        order.push(f.group);
      }
      by.get(f.group)!.push(f);
    }
    return order.map((g) => ({ group: g, fields: by.get(g)! }));
  }, [fields, query]);

  const toggle = (field: FilterFieldDef) => {
    setDraft((d) => {
      if (byKey.has(field.key)) return d.filter((c) => c.field !== field.key);
      return [...d, emptyCriterion(field.key, field.type)];
    });
  };

  const updateCriterion = (next: FieldCriterion) => {
    setDraft((d) => d.map((c) => (c.field === next.field ? next : c)));
  };

  const changeOperator = (field: FilterFieldDef, operator: string) => {
    setDraft((d) =>
      d.map((c) => (c.field === field.key ? { field: field.key, operator, value: "", value2: undefined } : c))
    );
  };

  return (
    <div
      className="drawer-backdrop-left fixed inset-0 z-[90] flex justify-start"
      style={{ background: "rgba(0,0,0,.4)" }}
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Filter leads by field"
        className="w-full max-w-sm h-full flex flex-col border-r"
        style={{ background: "var(--surface)", borderColor: "var(--grid)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 pb-3 border-b" style={{ borderColor: "var(--grid)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
              Filter leads by
            </h3>
            <button type="button" aria-label="Close" data-tip="Close" onClick={onClose} className="text-[13px]" style={{ color: "var(--muted)" }}>
              ✕
            </button>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fields…"
            aria-label="Search fields"
            className="w-full mt-2.5 px-2.5 py-1.5 rounded-md text-[13px] border"
            style={inputStyle}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {groups.map(({ group, fields: groupFields }) => (
            <div key={group} className="mb-3">
              <p className="font-mono uppercase tracking-wide mb-1 mt-2" style={{ fontSize: "10.5px", color: "var(--muted)" }}>
                {group}
              </p>
              {groupFields.map((f) => {
                const c = byKey.get(f.key);
                const checked = !!c;
                return (
                  <div key={f.key} className="py-1">
                    <label className="flex items-center gap-2 cursor-pointer text-[13px]" style={{ color: "var(--ink)" }}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(f)} />
                      {f.label}
                    </label>
                    {checked && c && (
                      <div className="mt-1.5 ml-5 space-y-1.5">
                        <select
                          value={c.operator}
                          onChange={(e) => changeOperator(f, e.target.value)}
                          className="w-full px-2 py-1 rounded-md text-[12.5px] border"
                          style={inputStyle}
                        >
                          {OPERATORS_BY_TYPE[f.type].map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <ValueInput field={f} criterion={c} onChange={updateCriterion} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {groups.length === 0 && (
            <p className="text-[12.5px] py-6 text-center" style={{ color: "var(--muted)" }}>
              No field matches &ldquo;{query.trim()}&rdquo;.
            </p>
          )}
        </div>

        <div className="p-4 pt-3 border-t flex items-center gap-2" style={{ borderColor: "var(--grid)" }}>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-[13px] text-white"
            style={{ background: "var(--accent)" }}
            onClick={() => onApply(draft)}
          >
            Apply Filter
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-[13px] border"
            style={inputStyle}
            onClick={() => setDraft([])}
          >
            Clear
          </button>
          {draft.length > 0 && (
            <span className="text-[11.5px] ml-auto" style={{ color: "var(--muted)" }}>
              {draft.length} field{draft.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </aside>
    </div>
  );
}
