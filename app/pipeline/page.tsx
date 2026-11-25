"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { EMPTY_FILTERS, filterLeads, type FilterState } from "@/lib/filters";
import { STAGES, assignableList, directoryList } from "@/lib/constants";
import { applyFieldCriteria, buildFilterFields, fieldsByKeyMap, type FieldCriterion } from "@/lib/advancedFilters";
import FilterBar from "@/components/FilterBar";
import AdvancedFilterPanel from "@/components/AdvancedFilterPanel";
import StatsHeader from "@/components/StatsHeader";
import KanbanBoard from "@/components/KanbanBoard";

export default function PipelinePage() {
  const leads = useStore((s) => s.leads);
  const isManager = useStore((s) => s.isManager());
  const currentUserId = useStore((s) => s.currentUserId);
  const visibleLeads = useMemo(
    () => (isManager ? leads : leads.filter((l) => l.assignee === currentUserId)),
    [leads, isManager, currentUserId]
  );
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [showFieldFilter, setShowFieldFilter] = useState(false);
  const [fieldFilterResetKey, setFieldFilterResetKey] = useState(0);
  const fields = useMemo(
    () => buildFilterFields(STAGES, assignableList(), directoryList()).filter((f) => !f.managerOnly || isManager),
    [isManager]
  );
  const fieldsByKey = useMemo(() => fieldsByKeyMap(fields), [fields]);
  const [fieldCriteria, setFieldCriteria] = useState<FieldCriterion[]>([]);

  const cities = useMemo(
    () => Array.from(new Set(visibleLeads.map((l) => l.city))).sort(),
    [visibleLeads]
  );
  const filtered = useMemo(
    () => applyFieldCriteria(filterLeads(visibleLeads, filters), fieldCriteria, fieldsByKey),
    [visibleLeads, filters, fieldCriteria, fieldsByKey]
  );

  return (
    <div className="py-5">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
            Pipeline
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
            Only assigned leads appear here — drag a card between stages to update its status.
          </p>
        </div>
        <StatsHeader />
      </div>

      <FilterBar
        value={filters}
        onChange={setFilters}
        cities={cities}
        quickFilters={false}
        fieldFilterCount={fieldCriteria.length}
        onOpenFieldFilter={() => setShowFieldFilter((v) => !v)}
        onResetFieldFilter={() => {
          setFieldCriteria([]);
          setFieldFilterResetKey((k) => k + 1);
        }}
      />

      <div className="flex items-start gap-4 mt-1">
        <AdvancedFilterPanel
          key={fieldFilterResetKey}
          open={showFieldFilter}
          fields={fields}
          criteria={fieldCriteria}
          onApply={setFieldCriteria}
          onClose={() => setShowFieldFilter(false)}
        />

        <div className="min-w-0 flex-1">
          <KanbanBoard leads={filtered} />
        </div>
      </div>
    </div>
  );
}
