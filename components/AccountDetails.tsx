"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { STAGES, repById } from "@/lib/constants";
import { accountHref, type AccountSummary } from "@/lib/accounts";
import { fmtShortDate } from "@/lib/dates";
import { planById, fmtInr, leadMrr } from "@/lib/revenue";
import type { AccountType } from "@/lib/types";
import type { EditableAccountField } from "@/lib/store";

const VALID_TYPES: AccountType[] = ["Brand", "Mall", "Store"];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-4" style={{ borderColor: "var(--grid)", background: "var(--surface)" }}>
      <h2 className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <dt style={{ color: "var(--muted)" }}>{label}</dt>
      <dd className="text-right" style={{ color: "var(--ink)" }}>{value}</dd>
    </div>
  );
}

// The account's own facts: name and type (edit, or ask a manager to),
// subscription, where its contacts are in the pipeline, and delete.
export default function AccountDetails({ account }: { account: AccountSummary }) {
  const router = useRouter();
  const isManager = useStore((s) => s.isManager());
  const currentUserId = useStore((s) => s.currentUserId);
  const saveAccountEdit = useStore((s) => s.saveAccountEdit);
  const deleteAccount = useStore((s) => s.deleteAccount);
  const pendingAccountRequestFor = useStore((s) => s.pendingAccountRequestFor);
  const showToast = useStore((s) => s.showToast);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(account.name);
  const [editType, setEditType] = useState<AccountType>(account.type);

  const pending = pendingAccountRequestFor(account.name);
  // A rep who owns any city of the account may ask for account-level edits.
  const canEdit = isManager || account.owners.includes(currentUserId);
  const stageCounts: Record<string, number> = {};
  account.contacts.forEach((c) => (stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1));

  const save = () => {
    const newName = editName.trim();
    const changes: Record<string, { from: string; to: string }> = {};
    if (newName !== account.name) changes.account = { from: account.name, to: newName };
    if (editType !== account.type) changes.type = { from: account.type, to: editType };
    if (!Object.keys(changes).length) {
      setEditing(false);
      showToast("Nothing changed");
      return;
    }
    const error = saveAccountEdit(account.name, changes as Partial<Record<EditableAccountField, { from: string; to: string }>>);
    if (error) {
      showToast(error);
      return;
    }
    setEditing(false);
    if (isManager) {
      showToast("Account updated");
      // The page is addressed by name, so follow a rename.
      if (changes.account) router.replace(accountHref(newName));
    } else {
      showToast("Sent to manager for approval");
    }
  };

  const inputStyle = { borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" };

  return (
    <div className="flex flex-col gap-4">
      <Card title="Company details">
        {pending && (
          <div className="rounded-md px-3 py-2 mb-2 text-[12px]" style={{ background: "var(--warn-soft)", border: "1px solid var(--warn)" }}>
            <b>Awaiting approval:</b> {repById(pending.requestedBy)?.name} asked to change this on{" "}
            {fmtShortDate(pending.requestedAt)}.
          </div>
        )}
        {editing ? (
          <div className="space-y-2 text-[12.5px]">
            <label className="block">
              <span className="block text-[11px] mb-0.5" style={{ color: "var(--muted)" }}>Account name</span>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-2 py-1 rounded border" style={inputStyle} />
            </label>
            <label className="block">
              <span className="block text-[11px] mb-0.5" style={{ color: "var(--muted)" }}>Account type</span>
              <select value={editType} onChange={(e) => setEditType(e.target.value as AccountType)} className="w-full px-2 py-1 rounded border" style={inputStyle}>
                {VALID_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={save} className="px-2.5 py-1 rounded text-white" style={{ background: "var(--accent)" }}>
                {isManager ? "Save changes" : "Send for approval"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="px-2.5 py-1 rounded border" style={{ borderColor: "var(--grid)", color: "var(--ink)" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <dl className="text-[12.5px]">
              <Row label="Account name" value={account.name} />
              <Row label="Account type" value={account.type} />
              <Row label="Domain" value={account.domain} />
              <Row label="In CRM since" value={fmtShortDate(account.firstSeen)} />
              <Row label="Meetings scheduled" value={account.openMeetings} />
            </dl>
            <div className="mt-2">
              {canEdit ? (
                <button
                  type="button"
                  disabled={!!pending}
                  onClick={() => {
                    setEditName(account.name);
                    setEditType(account.type);
                    setEditing(true);
                  }}
                  className="px-2.5 py-1 rounded text-[12px] border disabled:opacity-50"
                  style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
                >
                  {pending ? "Edit locked — approval pending" : "Edit account details"}
                </button>
              ) : (
                <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>View only — none of this account is assigned to you.</span>
              )}
            </div>
          </>
        )}
      </Card>

      <Card title="Subscription">
        {account.subscription ? (
          <dl className="text-[12.5px]">
            <Row label="Plan" value={planById(account.subscription.plan)?.name} />
            <Row label="Monthly value" value={fmtInr(leadMrr(account.subscription))} />
            <Row label="Mandate from" value={fmtShortDate(account.subscription.mandateDate!)} />
            <Row label="Per quarter" value={fmtInr(leadMrr(account.subscription) * 3)} />
          </dl>
        ) : account.needsSub ? (
          <p className="text-[12.5px]" style={{ color: "var(--warn)" }}>⚠ Won, but no subscription recorded</p>
        ) : (
          <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>Not a subscriber yet — no won deal on this account.</p>
        )}
      </Card>

      <Card title="Pipeline spread">
        <div className="flex flex-wrap gap-1.5">
          {STAGES.filter((s) => stageCounts[s.id]).map((s) => (
            <span key={s.id} className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11.5px]" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
              {s.name} · {stageCounts[s.id]}
            </span>
          ))}
        </div>
      </Card>

      {isManager && (
        <button
          type="button"
          className="self-start px-2.5 py-1 rounded text-[12px]"
          style={{ border: "1px solid var(--crit)", color: "var(--crit)" }}
          onClick={() => {
            const n = account.contacts.length;
            if (confirm(`Delete ${account.name}? This permanently removes it and all ${n} contact(s). This can't be undone.`)) {
              deleteAccount(account.name);
              showToast(`${account.name} and ${n} contact(s) deleted`);
              router.push("/accounts");
            }
          }}
        >
          Delete account ({account.contacts.length} contact{account.contacts.length === 1 ? "" : "s"})
        </button>
      )}
    </div>
  );
}
