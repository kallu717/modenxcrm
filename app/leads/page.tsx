"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { EMPTY_FILTERS, filterLeads, type FilterState } from "@/lib/filters";
import FilterBar from "@/components/FilterBar";
import StatsHeader from "@/components/StatsHeader";
import LeadsTable from "@/components/LeadsTable";
import NewLeadModal from "@/components/NewLeadModal";
import ImportModal from "@/components/ImportModal";

export default function LeadsPage() {
  const leads = useStore((s) => s.leads);
  const isManager = useStore((s) => s.isManager());
  const currentUserId = useStore((s) => s.currentUserId);
  const visibleLeads = useMemo(
    () => (isManager ? leads : leads.filter((l) => l.assignee === currentUserId)),
    [leads, isManager, currentUserId]
  );
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [showNewLead, setShowNewLead] = useState(false);
  const [showImport, setShowImport] = useState(false);

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
            Leads
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
            {isManager
              ? "Every lead — assigned or not. Assign a rep right from a lead's detail panel."
              : "Your assigned leads, in one sortable list."}
          </p>
        </div>
        <StatsHeader />
      </div>

      <div className="flex items-center gap-2 py-3">
        <button
          type="button"
          className="px-3 py-1.5 rounded-md text-[13px] text-white"
          style={{ background: "var(--accent)" }}
          onClick={() => setShowNewLead(true)}
        >
          + New lead
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded-md text-[13px] border"
          style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
          onClick={() => setShowImport(true)}
        >
          ↥ Import leads
        </button>
        <span className="text-[12px]" style={{ color: "var(--muted)" }}>
          {isManager
            ? "Bring in leads and accounts from a spreadsheet."
            : "Add contacts you've found yourself — they're assigned to you automatically."}
        </span>
      </div>

      <FilterBar value={filters} onChange={setFilters} cities={cities} />

      <LeadsTable leads={filtered} />

      {showNewLead && <NewLeadModal onClose={() => setShowNewLead(false)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
