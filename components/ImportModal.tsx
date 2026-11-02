"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { IMPORT_COLUMNS, readSheet, stageImport, templateTsv, type StagedImport } from "@/lib/import";
import { api, describeError } from "@/lib/api";
import { adoptLeads } from "@/lib/sync";

type Step = "choose" | "template" | "upload";

const btn = "px-3 py-1.5 rounded-md text-[13px] border";
const btnStyle = { borderColor: "var(--grid)", color: "var(--ink)" };

export default function ImportModal({ onClose }: { onClose: () => void }) {
  const leads = useStore((s) => s.leads);
  const currentUserId = useStore((s) => s.currentUserId);
  const isManager = useStore((s) => s.isManager());
  const showToast = useStore((s) => s.showToast);
  const [step, setStep] = useState<Step>("choose");
  const [staged, setStaged] = useState<StagedImport | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The sheet is checked here first (missing columns, bad types, emails you
  // can see), then by the server, which also knows every other rep's leads.
  // Rows the server would skip are dropped from the preview.
  const handleFile = async (file: File) => {
    setReadError(null);
    setStaged(null);
    let local: StagedImport;
    try {
      local = stageImport(await readSheet(file), file.name, leads);
    } catch {
      setReadError("Couldn't read that file — is it a valid spreadsheet?");
      return;
    }
    if (!local.rows.length) {
      setStaged(local);
      return;
    }
    try {
      const dry = await api.importLeads(local.rows, local.filename, true);
      const skipped = new Set<number>();
      const issues = dry.issues.map((t) => {
        const m = /^Row (\d+): (.*)$/.exec(t);
        if (!m) return t;
        skipped.add(Number(m[1]) - 2); // the server numbers the rows it was sent, from 2
        return m[2].replace("already exists", "is already in the CRM");
      });
      setStaged({
        ...local,
        rows: local.rows.filter((_, i) => !skipped.has(i)),
        newAccounts: dry.newAccounts,
        duplicates: local.duplicates + dry.duplicates,
        rejected: local.rejected + dry.rejected,
        issues: [...local.issues, ...issues],
      });
    } catch (e) {
      setReadError(describeError(e));
    }
  };

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(msg);
    } catch {
      setCopyFallback(text);
    }
  };

  const confirmImport = async () => {
    if (!staged || busy) return;
    setBusy(true);
    try {
      const res = await api.importLeads(staged.rows, staged.filename, false);
      adoptLeads(res.created);
      const count = res.createdCount;
      const toOwnAccount = res.created.filter((x) => x.lead.assignee === currentUserId).length;
      showToast(
        !isManager && toOwnAccount
          ? `Imported ${count} lead${count === 1 ? "" : "s"} — ${toOwnAccount} assigned to you`
          : `Imported ${count} lead${count === 1 ? "" : "s"}`
      );
      onClose();
    } catch (e) {
      setReadError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.4)" }} onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl p-5 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {step === "choose" && (
          <>
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Import leads</h3>
            <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
              Leads and accounts come from one sheet — each row is a contact, and its account is created
              automatically if it doesn&apos;t exist yet.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {[
                { s: "template" as Step, t: "① Get the template", d: "The exact columns to fill in, with an example row." },
                { s: "upload" as Step, t: "② Upload filled sheet", d: "Reads .xlsx, .xls or .csv and previews before importing." },
              ].map((o) => (
                <button
                  key={o.s}
                  type="button"
                  className="text-left rounded-lg border p-4"
                  style={{ borderColor: "var(--grid)" }}
                  onClick={() => setStep(o.s)}
                >
                  <b className="block text-[13px]" style={{ color: "var(--ink)" }}>{o.t}</b>
                  <span className="text-[12px]" style={{ color: "var(--muted)" }}>{o.d}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-5">
              <button type="button" className={btn} style={btnStyle} onClick={onClose}>Close</button>
            </div>
          </>
        )}

        {step === "template" && (
          <>
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Template columns</h3>
            <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
              Put these in row 1 of your sheet, one lead per row after that. Starred columns are required.
            </p>
            <div className="overflow-x-auto mt-3">
              <table className="text-[11.5px] w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {IMPORT_COLUMNS.map((c) => (
                      <th key={c.key} className="text-left px-2 py-1 border whitespace-nowrap" style={{ borderColor: "var(--grid)", color: "var(--muted)" }}>
                        {c.header}{c.required ? " *" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {IMPORT_COLUMNS.map((c) => (
                      <td key={c.key} className="px-2 py-1 border whitespace-nowrap" style={{ borderColor: "var(--grid)", color: c.required ? "var(--accent-ink)" : "var(--ink-2)" }}>
                        {c.example}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[12px] mt-3" style={{ color: "var(--muted)" }}>
              <b style={{ color: "var(--ink)" }}>Account type</b> must be Brand, Mall or Store.{" "}
              <b style={{ color: "var(--ink)" }}>Email verified</b> takes Yes or No — it feeds the priority score.
              Paste into cell A1 of a blank Excel sheet and the columns land in order.
            </p>
            {copyFallback && (
              <textarea readOnly rows={3} value={copyFallback} className="w-full mt-3 p-2 rounded-md text-[12px] border font-mono" style={{ borderColor: "var(--grid)", background: "var(--surface-2)", color: "var(--ink)" }} />
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className={btn} style={btnStyle} onClick={() => setStep("choose")}>Back</button>
              <button type="button" className={btn} style={btnStyle} onClick={() => copy(templateTsv(false), "Headers copied — paste into A1")}>
                Copy headers
              </button>
              <button type="button" className="px-3 py-1.5 rounded-md text-[13px] text-white" style={{ background: "var(--accent)" }} onClick={() => copy(templateTsv(true), "Template copied — paste into A1")}>
                Copy with example row
              </button>
            </div>
          </>
        )}

        {step === "upload" && (
          <>
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Upload filled sheet</h3>
            <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
              Pick the file you filled in from the template. Nothing is imported until you confirm the preview.
            </p>
            <div className="mt-4 rounded-lg border border-dashed p-4" style={{ borderColor: "var(--rule)" }}>
              <p className="text-[12px] mb-2" style={{ color: "var(--muted)" }}>Excel (.xlsx, .xls) or CSV</p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                aria-label="Choose spreadsheet"
                className="text-[12.5px]"
                style={{ color: "var(--ink)" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>

            {readError && (
              <div className="mt-3 rounded-md px-3 py-2 text-[12px]" style={{ background: "var(--crit-soft)", color: "var(--crit)" }}>{readError}</div>
            )}

            {staged && (
              <>
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {[
                    ["Leads ready", staged.rows.length, "var(--ink)"],
                    ["New accounts", staged.newAccounts, "var(--ink)"],
                    ["Duplicates", staged.duplicates, staged.duplicates ? "var(--warn)" : "var(--ink)"],
                    ["Rejected", staged.rejected, staged.rejected ? "var(--crit)" : "var(--ink)"],
                  ].map(([label, n, color]) => (
                    <div key={label as string} className="rounded-md p-2.5 text-center" style={{ background: "var(--surface-2)" }}>
                      <b className="block text-[16px]" style={{ color: color as string }}>{n}</b>
                      <span className="uppercase tracking-wide" style={{ fontSize: "10px", color: "var(--muted)" }}>{label}</span>
                    </div>
                  ))}
                </div>
                {staged.issues.length > 0 && (
                  <div className="mt-3 rounded-md px-3 py-2 text-[12px] max-h-40 overflow-y-auto" style={{ background: "var(--warn-soft)", color: "var(--ink-2)" }}>
                    {staged.issues.slice(0, 40).map((t, i) => <div key={i}>{t}</div>)}
                    {staged.issues.length > 40 && <div>…and {staged.issues.length - 40} more</div>}
                  </div>
                )}
                {!isManager && (
                  <p className="text-[12px] mt-3" style={{ color: "var(--muted)" }}>
                    New accounts go straight to you, no approval needed. A contact for an account someone else
                    already owns stays with that rep — one account, one owner.
                  </p>
                )}
                {!staged.rows.length && (
                  <p className="text-[12px] mt-3" style={{ color: "var(--muted)" }}>Nothing to import — fix the rows above and try again.</p>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className={btn} style={btnStyle} onClick={() => setStep("choose")}>Back</button>
              {staged && staged.rows.length > 0 && (
                <button type="button" disabled={busy} className="px-3 py-1.5 rounded-md text-[13px] text-white disabled:opacity-60" style={{ background: "var(--accent)" }} onClick={confirmImport}>
                  Import {staged.rows.length} lead{staged.rows.length === 1 ? "" : "s"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
