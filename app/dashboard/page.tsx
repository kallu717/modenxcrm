"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { greeting } from "@/lib/dashboard";
import { addWidget, cleanLayout, defaultLayout, type WidgetPlacement } from "@/lib/widgets";
import LeadDrawer from "@/components/LeadDrawer";
import ContactedModal from "@/components/ContactedModal";
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import WidgetGallery from "@/components/dashboard/WidgetGallery";
import { DashboardActions } from "@/components/dashboard/Widgets";
import type { Lead } from "@/lib/types";

export default function DashboardPage() {
  const me = useStore((s) => s.currentUser());
  const currentUserId = useStore((s) => s.currentUserId);
  const saved = useStore((s) => s.dashboards[currentUserId]);
  const saveDashboard = useStore((s) => s.saveDashboard);
  const showToast = useStore((s) => s.showToast);

  // What's saved on the server for this person, cleaned for their role (a
  // role change can make some widgets unavailable). Nothing saved = default.
  const layout = useMemo(() => cleanLayout(saved, me.role), [saved, me.role]);
  const [draft, setDraft] = useState<WidgetPlacement[] | null>(null);
  const editing = draft !== null;
  const shown = draft ?? layout;

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [contactedLead, setContactedLead] = useState<Lead | null>(null);
  const [now] = useState(() => new Date());
  const actions = useMemo(() => ({ openLead: setOpenLeadId, contacted: setContactedLead }), []);

  const btn = "px-3 py-1.5 rounded-md text-[13px] border";

  return (
    <DashboardActions.Provider value={actions}>
      <div className="py-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
              {greeting(now.getHours())}, {me.name.split(" ")[0]}
            </h1>
            <p className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
              {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {editing ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                className={btn}
                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                onClick={() => setGalleryOpen(true)}
              >
                + Add widget
              </button>
              <button
                type="button"
                className={btn}
                style={{ borderColor: "var(--grid)", color: "var(--ink-2)" }}
                onClick={() => setDraft(defaultLayout(me.role))}
              >
                Reset to default
              </button>
              <button type="button" className={btn} style={{ borderColor: "var(--grid)", color: "var(--ink-2)" }} onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={btn + " text-white font-medium"}
                style={{ background: "var(--accent)", borderColor: "var(--accent)" }}
                onClick={() => {
                  saveDashboard(draft);
                  setDraft(null);
                  showToast("Dashboard saved");
                }}
              >
                Done
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={btn}
              style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
              onClick={() => setDraft(layout)}
            >
              ✎ Edit dashboard
            </button>
          )}
        </div>

        {editing && (
          <p className="text-[12.5px] rounded-lg px-3 py-2" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
            Drag a widget to move it, pull its bottom-right corner to resize, or use ← → and ✕. Press Done to save.
          </p>
        )}

        {shown.length ? (
          <DashboardGrid layout={shown} editing={editing} onChange={setDraft} />
        ) : (
          <div className="rounded-xl p-10 text-center" style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}>
            <p className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>
              Your dashboard is empty
            </p>
            <p className="text-[12.5px] mt-1 mb-4" style={{ color: "var(--muted)" }}>
              Add the widgets you want to see first thing each day.
            </p>
            <button
              type="button"
              className={btn + " text-white"}
              style={{ background: "var(--accent)", borderColor: "var(--accent)" }}
              onClick={() => {
                if (!editing) setDraft([]);
                setGalleryOpen(true);
              }}
            >
              + Add widget
            </button>
          </div>
        )}
      </div>

      {galleryOpen && (
        <WidgetGallery
          role={me.role}
          layout={shown}
          onAdd={(id) => setDraft((d) => addWidget(d ?? layout, id, me.role))}
          onClose={() => setGalleryOpen(false)}
        />
      )}
      {openLeadId && <LeadDrawer leadId={openLeadId} onClose={() => setOpenLeadId(null)} />}
      {contactedLead && <ContactedModal lead={contactedLead} onClose={() => setContactedLead(null)} />}
    </DashboardActions.Provider>
  );
}
