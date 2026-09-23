"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { STAGES, ACCOUNT_EDITABLE_FIELDS, repById, repsList } from "@/lib/constants";
import { buildAccounts } from "@/lib/accounts";
import { effectivePriority } from "@/lib/scoring";
import { fmtFollowup, fmtShortDate } from "@/lib/dates";
import { planById, fmtInr, leadMrr, agingBucket, AGING_MAX_DAYS } from "@/lib/revenue";
import type { AccountType } from "@/lib/types";
import type { EditableAccountField } from "@/lib/store";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const VALID_TYPES: AccountType[] = ["Brand", "Mall", "Store"];

export default function AccountDrawer({
  accountName,
  onClose,
  onOpenLead,
  onRenamed,
}: {
  accountName: string;
  onClose: () => void;
  onOpenLead: (id: string) => void;
  onRenamed: (newName: string) => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const leads = useStore((s) => s.leads);
  const isManager = useStore((s) => s.isManager());
  const currentUserId = useStore((s) => s.currentUserId);
  const assignAccount = useStore((s) => s.assignAccount);
  const deleteAccount = useStore((s) => s.deleteAccount);
  const deleteLead = useStore((s) => s.deleteLead);
  const saveAccountEdit = useStore((s) => s.saveAccountEdit);
  const pendingAccountRequestFor = useStore((s) => s.pendingAccountRequestFor);

  const account = useMemo(() => buildAccounts(leads).find((a) => a.name === accountName), [leads, accountName]);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(accountName);
  const [editType, setEditType] = useState<AccountType>(account?.type || "Brand");

  if (!account) return null;

  const pending = pendingAccountRequestFor(account.name);
  const canEdit = isManager || account.owner === currentUserId;
  const stage = STAGES.find((s) => s.id === account.furthest);
  const bucket = agingBucket(account.agingDays);
  const stageCounts: Record<string, number> = {};
  account.contacts.forEach((c) => {
    stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1;
  });

  const startEdit = () => {
    setEditName(account.name);
    setEditType(account.type);
    setEditing(true);
  };

  const handleSaveEdit = () => {
    const newName = editName.trim();
    const changes: Record<string, { from: string; to: string }> = {};
    if (newName !== account.name) changes.account = { from: account.name, to: newName };
    if (editType !== account.type) changes.type = { from: account.type, to: editType };
    if (!Object.keys(changes).length) {
      setEditing(false);
      showToast("Nothing changed");
      return;
    }
    const error = saveAccountEdit(
      account.name,
      changes as Partial<Record<EditableAccountField, { from: string; to: string }>>
    );
    if (error) {
      showToast(error);
      return;
    }
    setEditing(false);
    if (isManager) {
      showToast("Account updated");
      // The drawer is keyed by name, so follow a rename instead of vanishing.
      if (changes.account) onRenamed(newName);
    } else {
      showToast("Sent to manager for approval");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end"
      style={{ background: "rgba(0,0,0,.4)" }}
      onClick={onClose}
    >
      <aside
        className="w-full max-w-lg h-full overflow-y-auto p-5"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="text-[13px] mb-3"
          style={{ color: "var(--muted)" }}
          onClick={onClose}
        >
          ✕ Close
        </button>

        <p className="text-[17px] font-semibold" style={{ color: "var(--ink)" }}>
          {account.name}
        </p>
        <p className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
          {account.domain}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span
            className="px-2 py-0.5 rounded text-[11px] font-mono"
            style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
          >
            {account.type} account
          </span>
          <span
            className="px-2 py-0.5 rounded text-[11px] font-mono"
            style={{ background: "var(--crit-soft)", color: "var(--p-hot)" }}
          >
            {account.priority}
          </span>
          <span
            className="px-2 py-0.5 rounded text-[11px]"
            style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
          >
            {stage?.name}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="text-center">
            <b className="block text-[16px]" style={{ color: "var(--ink)" }}>{account.contacts.length}</b>
            <span style={{ fontSize: "10px", color: "var(--muted)" }}>Contacts</span>
          </div>
          <div className="text-center">
            <b className="block text-[16px]" style={{ color: "var(--ink)" }}>{account.functions.length}</b>
            <span style={{ fontSize: "10px", color: "var(--muted)" }}>Functions</span>
          </div>
          <div className="text-center">
            <b className="block text-[16px]" style={{ color: "var(--ink)" }}>{account.dueFollowups}</b>
            <span style={{ fontSize: "10px", color: "var(--muted)" }}>Follow-ups due</span>
          </div>
        </div>

        {/* Owner */}
        <div className="mt-5">
          <p className="text-[10.5px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
            Owner
            {account.agingDays != null && ` · at ${stage?.name} for ${account.agingDays}d`}
          </p>
          {isManager ? (
            <select
              value={account.owner || ""}
              onChange={(e) => {
                const repId = e.target.value || null;
                assignAccount(account.name, repId);
                showToast(repId ? `${account.name} assigned to ${repById(repId)?.name}` : `${account.name} unassigned`);
              }}
              className="px-2.5 py-1.5 rounded-md text-[13px] border"
              style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
            >
              <option value="">Unassigned</option>
              {repsList().map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          ) : account.owner ? (
            <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--ink)" }}>
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-semibold"
                style={{ background: repById(account.owner)?.color }}
              >
                {initials(repById(account.owner)?.name || "")}
              </span>
              {repById(account.owner)?.name}
            </span>
          ) : (
            <span style={{ color: "var(--muted)" }}>Unassigned</span>
          )}
          {bucket && account.agingDays != null && account.agingDays >= AGING_MAX_DAYS && (
            <p className="text-[11.5px] mt-1.5" style={{ color: "var(--crit)" }}>
              Stuck at this stage for over 3 months — consider reassigning to another rep.
            </p>
          )}
        </div>

        {/* Company details */}
        <div className="mt-5">
          <p className="text-[10.5px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
            Company details
          </p>
          {pending && (
            <div
              className="rounded-md px-3 py-2 mb-2 text-[12px]"
              style={{ background: "var(--warn-soft)", border: "1px solid var(--warn)" }}
            >
              <span
                className="px-1.5 py-0.5 rounded text-white font-mono mr-1"
                style={{ background: "var(--warn)", fontSize: "10px" }}
              >
                Awaiting approval
              </span>
              {repById(pending.requestedBy)?.name} requested changes on {fmtShortDate(pending.requestedAt)}
            </div>
          )}
          {editing ? (
            <div className="space-y-2">
              <div>
                <label className="block text-[10.5px] mb-0.5" style={{ color: "var(--muted)" }}>
                  Account name
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-2 py-1 rounded text-[12.5px] border"
                  style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
                />
              </div>
              <div>
                <label className="block text-[10.5px] mb-0.5" style={{ color: "var(--muted)" }}>
                  Account type
                </label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as AccountType)}
                  className="w-full px-2 py-1 rounded text-[12.5px] border"
                  style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
                >
                  {VALID_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-2.5 py-1 rounded text-[12px] text-white"
                  style={{ background: "var(--accent)" }}
                  onClick={handleSaveEdit}
                >
                  {isManager ? "Save changes" : "Send for approval"}
                </button>
                <button
                  type="button"
                  className="px-2.5 py-1 rounded text-[12px] border"
                  style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <dl className="text-[12.5px] space-y-1">
                {[
                  ...ACCOUNT_EDITABLE_FIELDS.map((f) => [f.label, f.key === "account" ? account.name : account.type]),
                  ["Domain", account.domain],
                  ["Locations", account.cities.join(", ")],
                  ["In CRM since", fmtShortDate(account.firstSeen)],
                  ["Meetings scheduled", String(account.openMeetings)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt style={{ color: "var(--muted)" }}>{label}</dt>
                    <dd style={{ color: "var(--ink)" }}>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex items-center gap-2 mt-2">
                {canEdit ? (
                  pending ? (
                    <button type="button" disabled className="px-2.5 py-1 rounded text-[12px] border opacity-50" style={{ borderColor: "var(--grid)" }}>
                      Edit locked — approval pending
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded text-[12px] border"
                      style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
                      onClick={startEdit}
                    >
                      Edit account details
                    </button>
                  )
                ) : (
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                    View only — this account isn&apos;t assigned to you.
                  </span>
                )}
              </div>
              {isManager && (
                <button
                  type="button"
                  className="mt-2 px-2.5 py-1 rounded text-[12px]"
                  style={{ border: "1px solid var(--crit)", color: "var(--crit)" }}
                  onClick={() => {
                    if (
                      confirm(
                        `Delete ${account.name}? This permanently removes it and all ${account.contacts.length} contact(s). This can't be undone.`
                      )
                    ) {
                      deleteAccount(account.name);
                      showToast(`${account.name} and ${account.contacts.length} contact(s) deleted`);
                      onClose();
                    }
                  }}
                >
                  Delete account ({account.contacts.length} contact{account.contacts.length === 1 ? "" : "s"})
                </button>
              )}
            </>
          )}
        </div>

        {/* Subscription */}
        <div className="mt-5">
          <p className="text-[10.5px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
            Subscription
          </p>
          {account.subscription ? (
            <dl className="text-[12.5px] space-y-1">
              <div className="flex justify-between gap-3">
                <dt style={{ color: "var(--muted)" }}>Plan</dt>
                <dd style={{ color: "var(--ink)" }}>{planById(account.subscription.plan)?.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt style={{ color: "var(--muted)" }}>Monthly value</dt>
                <dd style={{ color: "var(--ink)" }}>{fmtInr(leadMrr(account.subscription))}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt style={{ color: "var(--muted)" }}>Mandate from</dt>
                <dd style={{ color: "var(--ink)" }}>{fmtShortDate(account.subscription.mandateDate!)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt style={{ color: "var(--muted)" }}>Per quarter</dt>
                <dd style={{ color: "var(--ink)" }}>{fmtInr(leadMrr(account.subscription) * 3)}</dd>
              </div>
            </dl>
          ) : account.needsSub ? (
            <span style={{ color: "var(--warn)" }}>⚠ Won, but no subscription recorded</span>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "12px" }}>Not a subscriber yet — no won deal on this account.</p>
          )}
        </div>

        {/* Pipeline spread */}
        <div className="mt-5">
          <p className="text-[10.5px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
            Pipeline spread
          </p>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.filter((s) => stageCounts[s.id]).map((s) => (
              <span
                key={s.id}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px]"
                style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                {s.name} · {stageCounts[s.id]}
              </span>
            ))}
          </div>
        </div>

        {/* Contacts */}
        <div className="mt-5">
          <p className="text-[10.5px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
            Contacts at this account
          </p>
          <div className="space-y-1.5">
            {[...account.contacts]
              .sort((a, b) => b.score - a.score)
              .map((c) => {
                const cStage = STAGES.find((s) => s.id === c.stage);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-md cursor-pointer"
                    style={{ background: "var(--surface-2)" }}
                    onClick={() => onOpenLead(c.id)}
                  >
                    <div>
                      <div className="text-[12.5px]" style={{ color: "var(--ink)" }}>{c.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                        {c.title} · {c.city}
                        {c.nextFollowup && ` · follow-up ${fmtFollowup(c.nextFollowup)}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                        style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                      >
                        {effectivePriority(c)}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px]"
                        style={{ background: "var(--surface)", color: "var(--ink-2)" }}
                      >
                        {cStage?.name}
                      </span>
                      {isManager && (
                        <button
                          type="button"
                          aria-label={`Delete ${c.name}`}
                          className="px-1.5 text-[13px]"
                          style={{ color: "var(--muted)" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete ${c.name}? This can't be undone.`)) {
                              deleteLead(c.id);
                              showToast(`${c.name} deleted`);
                              // Last contact gone means the account itself is gone.
                              if (account.contacts.length === 1) onClose();
                            }
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </aside>
    </div>
  );
}
