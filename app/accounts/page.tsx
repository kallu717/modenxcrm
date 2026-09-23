"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { EMPTY_FILTERS, filterLeads, type FilterState } from "@/lib/filters";
import { buildAccounts } from "@/lib/accounts";
import FilterBar from "@/components/FilterBar";
import AccountsTable from "@/components/AccountsTable";
import AccountDrawer from "@/components/AccountDrawer";
import LeadDrawer from "@/components/LeadDrawer";

export default function AccountsPage() {
  const leads = useStore((s) => s.leads);
  const isManager = useStore((s) => s.isManager());
  const currentUserId = useStore((s) => s.currentUserId);
  const visibleLeads = useMemo(
    () => (isManager ? leads : leads.filter((l) => l.assignee === currentUserId)),
    [leads, isManager, currentUserId]
  );
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [openAccount, setOpenAccount] = useState<string | null>(null);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const cities = useMemo(
    () => Array.from(new Set(visibleLeads.map((l) => l.city))).sort(),
    [visibleLeads]
  );
  const filtered = useMemo(() => filterLeads(visibleLeads, filters), [visibleLeads, filters]);
  const accounts = useMemo(() => buildAccounts(filtered), [filtered]);
  const contactTotal = accounts.reduce((n, a) => n + a.contacts.length, 0);

  return (
    <div className="py-5">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
            Accounts
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
            One row per company, with every contact rolled up. Open an account to see its details
            and who you know there.
          </p>
        </div>
        <div className="font-mono text-[12px]" style={{ color: "var(--muted)" }}>
          {accounts.length} account{accounts.length === 1 ? "" : "s"} · {contactTotal} contact
          {contactTotal === 1 ? "" : "s"}
        </div>
      </div>

      <FilterBar value={filters} onChange={setFilters} cities={cities} />

      <AccountsTable accounts={accounts} onOpen={setOpenAccount} />

      {openAccount && (
        <AccountDrawer
          accountName={openAccount}
          onClose={() => setOpenAccount(null)}
          onOpenLead={(id) => setOpenLeadId(id)}
        />
      )}
      {openLeadId && <LeadDrawer leadId={openLeadId} onClose={() => setOpenLeadId(null)} />}
    </div>
  );
}
