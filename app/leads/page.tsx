"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { EMPTY_FILTERS, filterLeads, parseFilters, type FilterState } from "@/lib/filters";
import { STAGES, assignableList, directoryList } from "@/lib/constants";
import {
  applyFieldCriteria,
  buildFilterFields,
  fieldsByKeyMap,
  parseFieldCriteria,
  type FieldCriterion,
} from "@/lib/advancedFilters";
import { pageSlice } from "@/lib/paging";
import { usePaging } from "@/lib/usePaging";
import { useSessionState } from "@/lib/useSessionState";
import Pager from "@/components/Pager";
import FilterBar from "@/components/FilterBar";
import AdvancedFilterPanel from "@/components/AdvancedFilterPanel";
import StatsHeader from "@/components/StatsHeader";
import LeadsTable from "@/components/LeadsTable";
import NewLeadModal from "@/components/NewLeadModal";
import ImportModal from "@/components/ImportModal";

// Pages here are built ahead of time, before anyone opens a link, so the
// address's ?query is read in the browser with useSearchParams, inside
// <Suspense>. Reading the page's searchParams prop instead worked in
// development but came through empty in production builds.
export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsView />
    </Suspense>
  );
}

function LeadsView() {
  const assigneeParam = useSearchParams().get("assignee") ?? "";
  const leads = useStore((s) => s.leads);
  const isManager = useStore((s) => s.isManager());
  const currentUserId = useStore((s) => s.currentUserId);
  const uploadsGoToMe = useStore((s) => s.uploadsGoToMe());
  const visibleLeads = useMemo(
    () => (isManager ? leads : leads.filter((l) => l.assignee === currentUserId)),
    [leads, isManager, currentUserId]
  );
  // Filters and page are remembered for the session, per person, so coming
  // back to Leads shows the same view. A link with ?assignee= still wins.
  const [filters, setFilters] = useSessionState<FilterState>(
    `modenx:${currentUserId}:leads:filters`,
    { ...EMPTY_FILTERS, assignee: assigneeParam },
    (raw) => {
      const f = parseFilters(raw);
      return f && assigneeParam ? { ...f, assignee: assigneeParam } : f;
    }
  );

  // The "unassigned" pill links here while this page may already be open.
  const [seenParam, setSeenParam] = useState(assigneeParam);
  if (assigneeParam !== seenParam) {
    setSeenParam(assigneeParam);
    if (assigneeParam) setFilters((f) => ({ ...f, assignee: assigneeParam }));
  }
  const [showNewLead, setShowNewLead] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showFieldFilter, setShowFieldFilter] = useState(false);
  // Bumped by Reset, so the panel (which otherwise stays mounted to keep an
  // unapplied draft around) remounts with a clean slate.
  const [fieldFilterResetKey, setFieldFilterResetKey] = useState(0);

  const fields = useMemo(
    () => buildFilterFields(STAGES, assignableList(), directoryList()).filter((f) => !f.managerOnly || isManager),
    [isManager]
  );
  const fieldsByKey = useMemo(() => fieldsByKeyMap(fields), [fields]);
  const [fieldCriteria, setFieldCriteria] = useSessionState<FieldCriterion[]>(
    `modenx:${currentUserId}:leads:fieldfilters`,
    [],
    parseFieldCriteria
  );

  const cities = useMemo(
    () => Array.from(new Set(visibleLeads.map((l) => l.city))).sort(),
    [visibleLeads]
  );
  const filtered = useMemo(
    () => applyFieldCriteria(filterLeads(visibleLeads, filters), fieldCriteria, fieldsByKey),
    [visibleLeads, filters, fieldCriteria, fieldsByKey]
  );
  const paging = usePaging(`modenx:${currentUserId}:leads:paging`, filtered.length, JSON.stringify(filters));
  const shown = useMemo(() => pageSlice(filtered, paging.page, paging.size), [filtered, paging.page, paging.size]);
  const listTop = useRef<HTMLDivElement>(null);
  const goToPage = (p: number) => {
    paging.setPage(p);
    listTop.current?.scrollIntoView({ block: "start" });
  };

  return (
    <div className="py-5">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
            Leads
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
            {isManager
              ? "Every lead — assigned or not. Owners are set per account, from Accounts."
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
            : uploadsGoToMe
              ? "Add contacts you've found yourself — they're assigned to you automatically."
              : "Add contacts you've found yourself — a manager assigns them to someone."}
        </span>
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
          <div ref={listTop} className="scroll-mt-24">
            <LeadsTable leads={shown} />
          </div>
          <Pager
            page={paging.page}
            size={paging.size}
            total={filtered.length}
            noun={["lead", "leads"]}
            onPage={goToPage}
            onSize={paging.setSize}
          />
        </div>
      </div>

      {showNewLead && <NewLeadModal onClose={() => setShowNewLead(false)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
