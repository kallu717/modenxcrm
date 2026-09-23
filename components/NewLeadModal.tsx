"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { CITIES, repById } from "@/lib/constants";
import type { AccountType } from "@/lib/types";

const VALID_TYPES: AccountType[] = ["Brand", "Mall", "Store"];

const inputStyle = { borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" };

export default function NewLeadModal({ onClose }: { onClose: () => void }) {
  const leads = useStore((s) => s.leads);
  const createLead = useStore((s) => s.createLead);
  const showToast = useStore((s) => s.showToast);

  const [form, setForm] = useState({
    name: "",
    title: "",
    account: "",
    type: "Brand" as AccountType,
    city: "",
    email: "",
    phone: "",
    notes: "",
    verified: false,
  });
  const [error, setError] = useState<string | null>(null);

  const existingAccount = useMemo(
    () => leads.find((l) => l.account.toLowerCase() === form.account.trim().toLowerCase()),
    [leads, form.account]
  );
  const existingOwner = existingAccount ? repById(existingAccount.assignee) : null;

  const set = <K extends keyof typeof form>(key: K, v: (typeof form)[K]) =>
    setForm((s) => ({ ...s, [key]: v }));

  const submit = () => {
    const required = ["name", "title", "account", "type", "email", "city"] as const;
    const missing = required.filter((k) => !form[k]);
    if (missing.length) {
      setError("Fill in all required fields.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setError("That email doesn't look right.");
      return;
    }
    const lead = createLead({
      name: form.name,
      title: form.title,
      account: form.account,
      type: existingAccount ? existingAccount.type : form.type,
      email: form.email,
      phone: form.phone,
      city: form.city,
      notes: form.notes,
      verified: form.verified,
    });
    if (!lead) {
      setError("A lead with that email already exists.");
      return;
    }
    const owner = repById(lead.assignee);
    showToast(owner ? `${lead.name} added — assigned to ${owner.name}` : `${lead.name} added — unassigned`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl p-5 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
          New lead
        </h3>
        <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
          Everything except phone is required. If the account already exists, this contact joins it
          under its current owner automatically.
        </p>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>
              Contact name *
            </label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md text-[13px] border"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>
              Job title *
            </label>
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md text-[13px] border"
              style={inputStyle}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>
              Account name *
            </label>
            <input
              value={form.account}
              onChange={(e) => set("account", e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md text-[13px] border"
              style={inputStyle}
            />
            {existingAccount && (
              <p className="text-[11.5px] mt-1" style={{ color: "var(--accent-ink)" }}>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono mr-1"
                  style={{ background: "var(--accent-soft)" }}
                >
                  {existingAccount.type}
                </span>
                Existing account —{" "}
                {existingOwner ? `owned by ${existingOwner.name}. This contact will join them.` : "currently unassigned."}
              </p>
            )}
          </div>
          <div>
            <label className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>
              Account type *
            </label>
            <select
              value={existingAccount ? existingAccount.type : form.type}
              disabled={!!existingAccount}
              onChange={(e) => set("type", e.target.value as AccountType)}
              className="w-full px-2.5 py-1.5 rounded-md text-[13px] border disabled:opacity-60"
              style={inputStyle}
            >
              {VALID_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>
              City *
            </label>
            <input
              list="nl-city-list"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md text-[13px] border"
              style={inputStyle}
            />
            <datalist id="nl-city-list">
              {CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>
              Email *
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md text-[13px] border"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>
              Phone
            </label>
            <input
              value={form.phone}
              placeholder="Optional"
              onChange={(e) => set("phone", e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md text-[13px] border"
              style={inputStyle}
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="nl-verified"
              checked={form.verified}
              onChange={(e) => set("verified", e.target.checked)}
            />
            <label htmlFor="nl-verified" className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
              Email is verified (not just a guess)
            </label>
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>
              Notes
            </label>
            <input
              value={form.notes}
              placeholder="How you got this contact — optional"
              onChange={(e) => set("notes", e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md text-[13px] border"
              style={inputStyle}
            />
          </div>
        </div>

        {error && (
          <p className="text-[12px] mt-3" style={{ color: "var(--crit)" }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-[13px] border"
            style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-[13px] text-white"
            style={{ background: "var(--accent)" }}
            onClick={submit}
          >
            Add lead
          </button>
        </div>
      </div>
    </div>
  );
}
