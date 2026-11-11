"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { STAGES } from "@/lib/constants";
import { buildAccounts } from "@/lib/accounts";
import AccountOwnership from "@/components/AccountOwnership";
import AccountContacts from "@/components/AccountContacts";
import AccountDetails from "@/components/AccountDetails";
import LeadDrawer from "@/components/LeadDrawer";

const PRIORITY_STYLE: Record<string, { bg: string; fg: string }> = {
  Hot: { bg: "var(--crit-soft)", fg: "var(--p-hot)" },
  Warm: { bg: "var(--warn-soft)", fg: "var(--p-warm)" },
  Nurture: { bg: "var(--accent-soft)", fg: "var(--p-nurture)" },
  Low: { bg: "var(--surface-2)", fg: "var(--muted)" },
};

function Stat({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div className="px-3 py-2 rounded-md text-center min-w-[84px]" style={{ background: "var(--surface-2)" }}>
      <b className="block text-[18px] leading-tight" style={{ color: tone || "var(--ink)" }}>{value}</b>
      <span className="text-[10.5px]" style={{ color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

// One account on its own page: who owns which city, its contacts, and its
// details. Reached from the Accounts list and from a contact's "manage" link.
// Pages here are built ahead of time, before anyone opens a link, so the
// address's ?query is read in the browser with useSearchParams, inside
// <Suspense>. Reading the page's searchParams prop instead worked in
// development but came through empty in production builds.
export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountView />
    </Suspense>
  );
}

function AccountView() {
  const accountName = useSearchParams().get("name") ?? "";
  const leads = useStore((s) => s.leads);
  const isManager = useStore((s) => s.isManager());
  const account = useMemo(() => buildAccounts(leads).find((a) => a.name === accountName), [leads, accountName]);

  const [cityKey, setCityKey] = useState<string | null>(null);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const back = (
    <Link href="/accounts" className="text-[12.5px]" style={{ color: "var(--muted)" }}>
      ← All accounts
    </Link>
  );

  if (!account) {
    return (
      <div className="py-5">
        {back}
        <p className="mt-6 text-[13px]" style={{ color: "var(--muted)" }}>
          {accountName
            ? `“${accountName}” isn't here. It may have been renamed or deleted, or none of it is assigned to you.`
            : "No account chosen."}
        </p>
      </div>
    );
  }

  const stage = STAGES.find((s) => s.id === account.furthest);
  const pStyle = PRIORITY_STYLE[account.priority];
  const unassignedCities = account.locations.filter((l) => !l.owner).length;
  const showContacts = (key: string) => {
    setCityKey(key);
    // An instant jump: smooth scrolling doesn't run in every browser window
    // (it stalled in testing), and the list is what the click is for.
    document.getElementById("account-contacts")?.scrollIntoView({ block: "start" });
  };

  return (
    <div className="py-5 flex flex-col gap-4">
      {back}

      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[21px] font-semibold" style={{ color: "var(--ink)" }}>{account.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11.5px]">
            <span className="px-2 py-0.5 rounded font-mono" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
              {account.type}
            </span>
            <span className="px-2 py-0.5 rounded font-mono" style={{ background: pStyle.bg, color: pStyle.fg }}>
              {account.priority}
            </span>
            <span className="px-2 py-0.5 rounded" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
              Furthest stage: {stage?.name}
            </span>
            <span style={{ color: "var(--muted)" }}>{account.domain}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Stat value={account.contacts.length} label="Contacts" />
          <Stat value={account.locations.length} label={account.locations.length === 1 ? "City" : "Cities"} />
          <Stat value={account.owners.length} label={account.owners.length === 1 ? "Owner" : "Owners"} />
          {isManager && account.locations.length > 1 && (
            <Stat value={unassignedCities} label="Unassigned cities" tone={unassignedCities ? "var(--warn)" : undefined} />
          )}
          <Stat value={account.dueFollowups} label="Follow-ups due" tone={account.dueFollowups ? "var(--crit)" : undefined} />
        </div>
      </header>

      <AccountOwnership key={account.name} account={account} onShowContacts={showContacts} />

      <div className="grid gap-4 items-start lg:grid-cols-[minmax(0,1fr)_320px]">
        <AccountContacts account={account} cityKey={cityKey} onCityChange={setCityKey} onOpenLead={setOpenLeadId} />
        <AccountDetails key={account.name} account={account} />
      </div>

      {openLeadId && <LeadDrawer leadId={openLeadId} onClose={() => setOpenLeadId(null)} />}
    </div>
  );
}
