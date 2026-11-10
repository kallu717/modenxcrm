"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { EMPTY_FILTERS, filterLeads, type FilterState } from "@/lib/filters";
import { accountHref, buildAccounts } from "@/lib/accounts";
import FilterBar from "@/components/FilterBar";
import AccountsTable from "@/components/AccountsTable";

export default function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  const { account } = use(searchParams);
  const accountParam = typeof account === "string" ? account : null;
  const router = useRouter();
  const leads = useStore((s) => s.leads);
  const isManager = useStore((s) => s.isManager());
  const currentUserId = useStore((s) => s.currentUserId);
  const visibleLeads = useMemo(
    () => (isManager ? leads : leads.filter((l) => l.assignee === currentUserId)),
    [leads, isManager, currentUserId]
  );
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  // Older links (/accounts?account=…) opened a side panel; each account now
  // has its own page.
  useEffect(() => {
    if (accountParam) router.replace(accountHref(accountParam));
  }, [accountParam, router]);

  const cities = useMemo(
    () => Array.from(new Set(visibleLeads.map((l) => l.city))).sort(),
    [visibleLeads]
  );
  const filtered = useMemo(
    () => (accountParam ? [] : filterLeads(visibleLeads, filters)),
    [accountParam, visibleLeads, filters]
  );
  const accounts = useMemo(() => buildAccounts(filtered), [filtered]);
  const contactTotal = accounts.reduce((n, a) => n + a.contacts.length, 0);

  // On its way to an account page: don't build the whole list first.
  if (accountParam) {
    return (
      <p className="py-8 text-[13px]" style={{ color: "var(--muted)" }}>
        Opening {accountParam}…
      </p>
    );
  }

  return (
    <div className="py-5">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
            Accounts
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
            One row per company, with every contact rolled up. Open an account to see who owns which
            city, its contacts and its details.
          </p>
        </div>
        <div className="font-mono text-[12px]" style={{ color: "var(--muted)" }}>
          {accounts.length} account{accounts.length === 1 ? "" : "s"} · {contactTotal} contact
          {contactTotal === 1 ? "" : "s"}
        </div>
      </div>

      <FilterBar value={filters} onChange={setFilters} cities={cities} />

      <AccountsTable accounts={accounts} onOpen={(name) => router.push(accountHref(name))} />
    </div>
  );
}
