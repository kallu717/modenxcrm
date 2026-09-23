"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { EMPTY_FILTERS, filterLeads, type FilterState } from "@/lib/filters";
import FilterBar from "@/components/FilterBar";
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

  const cities = useMemo(
    () => Array.from(new Set(visibleLeads.map((l) => l.city))).sort(),
    [visibleLeads]
  );
  const filtered = useMemo(() => filterLeads(visibleLeads, filters), [visibleLeads, filters]);

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

      <FilterBar value={filters} onChange={setFilters} cities={cities} />

      <KanbanBoard leads={filtered} />
    </div>
  );
}
