"use client";

import { useEffect, useState } from "react";
import { api, describeError, type AdminUser } from "@/lib/api";
import { useStore } from "@/lib/store";
import { refresh } from "@/lib/sync";
import { ROLE_LABELS, type Role } from "@/lib/types";

// The order the role picker lists them in.
const ROLE_CHOICES: Role[] = ["Rep", "Manager", "Admin", "Pending"];

const ROLE_HELP: { role: Role; text: string }[] = [
  { role: "Rep", text: "Works the leads assigned to them. Edits to contact details go to a manager for approval." },
  { role: "Manager", text: "Sees every lead, assigns accounts, approves edits and leave, sees Reports and Revenue." },
  { role: "Admin", text: "Everything a Manager can do, plus this page." },
  { role: "Pending", text: "Signed in but can't see anything. New people start here until you pick a role." },
];

function fmtWhen(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function lockNote(u: AdminUser): string | null {
  if (u.locked === "server") return "Set in the server settings";
  if (u.locked === "self") return "That's you";
  return null;
}

function PersonRow({ u, busy, onChange }: { u: AdminUser; busy: boolean; onChange: (role: Role) => void }) {
  const note = lockNote(u);
  return (
    <tr className="border-t" style={{ borderColor: "var(--grid)" }}>
      <td className="py-2.5 pl-3 pr-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: u.color }} />
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
              {u.name}
            </div>
            <div className="text-[11.5px] truncate" style={{ color: "var(--muted)" }}>
              {u.email}
            </div>
          </div>
        </div>
      </td>
      <td className="py-2.5 pr-3">
        <select
          aria-label={`Role for ${u.name}`}
          value={u.role}
          disabled={busy || u.locked !== null}
          onChange={(e) => onChange(e.target.value as Role)}
          className="px-2 py-1 rounded-md text-[12.5px] border disabled:opacity-60"
          style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
        >
          {ROLE_CHOICES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        {note && (
          <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
            {note}
          </div>
        )}
      </td>
      <td className="py-2.5 pr-3 text-[12px] font-mono whitespace-nowrap" style={{ color: "var(--muted)" }}>
        {fmtWhen(u.lastLogin)}
      </td>
      <td className="py-2.5 pr-3 text-[12px] font-mono text-right" style={{ color: "var(--muted)" }}>
        {u.role === "Rep" || u.role === "Manager" ? u.leadCount : "—"}
      </td>
    </tr>
  );
}

function PeopleTable({ people, busyId, onChange }: { people: AdminUser[]; busyId: string | null; onChange: (u: AdminUser, role: Role) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--grid)", background: "var(--surface)" }}>
      <table className="w-full min-w-[560px] text-left">
        <thead>
          <tr className="font-mono uppercase tracking-wide" style={{ fontSize: "10.5px", color: "var(--muted)" }}>
            <th className="py-2 pl-3 pr-3 font-normal">Person</th>
            <th className="py-2 pr-3 font-normal">Role</th>
            <th className="py-2 pr-3 font-normal">Last signed in</th>
            <th className="py-2 pr-3 font-normal text-right">Leads</th>
          </tr>
        </thead>
        <tbody>
          {people.map((u) => (
            <PersonRow key={u.id} u={u} busy={busyId === u.id} onChange={(role) => onChange(u, role)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SettingsPage() {
  const isAdmin = useStore((s) => s.isAdmin());
  const showToast = useStore((s) => s.showToast);
  const [people, setPeople] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    api.adminUsers().then(setPeople, () => setLoadError(true));
  }, [isAdmin]);

  async function changeRole(u: AdminUser, role: Role) {
    if (role === u.role) return;
    setBusyId(u.id);
    try {
      const updated = await api.setRole(u.id, role);
      setPeople((list) => list?.map((p) => (p.id === u.id ? updated : p)) ?? null);
      showToast(role === "Pending" ? `${u.name} no longer has access` : `${u.name} is now ${ROLE_LABELS[role]}`);
      refresh(); // so assignee lists etc. pick up the change
    } catch (e) {
      showToast(describeError(e));
    } finally {
      setBusyId(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="py-8 text-center" style={{ color: "var(--muted)" }}>
        Settings are visible to admins only.
      </div>
    );
  }

  // Newcomers and anyone whose access was taken away; listed first so a new
  // sign-in is easy to spot.
  const waiting = people?.filter((u) => u.role === "Pending") ?? [];
  const others = people?.filter((u) => u.role !== "Pending") ?? [];

  return (
    <div className="py-5 max-w-[880px]">
      <h1 className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
        Settings
      </h1>
      <p className="text-[12.5px] mt-0.5 mb-4" style={{ color: "var(--muted)" }}>
        Who can use ModenX Pipeline and what they can do. People appear here after they first sign in with Microsoft.
        A change applies straight away, without them signing out.
      </p>

      <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 mb-6 text-[12px]">
        {ROLE_HELP.map(({ role, text }) => (
          <div key={role}>
            <span className="font-medium" style={{ color: "var(--ink)" }}>
              {ROLE_LABELS[role]}:
            </span>{" "}
            <span style={{ color: "var(--muted)" }}>{text}</span>
          </div>
        ))}
      </div>

      {loadError && (
        <p className="text-[13px]" style={{ color: "var(--crit)" }}>
          Couldn&apos;t load the list of people. Refresh the page to try again.
        </p>
      )}
      {!people && !loadError && (
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          Loading…
        </p>
      )}

      {waiting.length > 0 && (
        <section className="mb-6">
          <h2 className="text-[14px] font-semibold mb-2" style={{ color: "var(--ink)" }}>
            Waiting for access ({waiting.length})
          </h2>
          <PeopleTable people={waiting} busyId={busyId} onChange={changeRole} />
        </section>
      )}

      {people && (
        <section>
          <h2 className="text-[14px] font-semibold mb-2" style={{ color: "var(--ink)" }}>
            Everyone else ({others.length})
          </h2>
          <PeopleTable people={others} busyId={busyId} onChange={changeRole} />
        </section>
      )}
    </div>
  );
}
