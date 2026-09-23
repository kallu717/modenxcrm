"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { IMPORT_COLUMNS, parseImportText, type ImportRow } from "@/lib/import";

export default function ImportModal({ onClose }: { onClose: () => void }) {
  const importLeads = useStore((s) => s.importLeads);
  const isManager = useStore((s) => s.isManager());
  const [staged, setStaged] = useState<{ rows: ImportRow[]; filename: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const { rows, errors } = parseImportText(text);
    setErrors(errors);
    if (rows.length) setStaged({ rows, filename: file.name });
    else setStaged(null);
  };

  const confirm = () => {
    if (!staged) return;
    const { count, toOwnAccount } = importLeads(staged.rows, staged.filename);
    const msg =
      !isManager && toOwnAccount
        ? `Imported ${count} lead${count === 1 ? "" : "s"} — ${toOwnAccount} assigned to you`
        : `Imported ${count} lead${count === 1 ? "" : "s"}`;
    alert(msg);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl p-5 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
          Import leads
        </h3>
        <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
          Upload a CSV (or tab-separated file from a spreadsheet) with these columns. Contact name,
          job title, account name, and account type are required.
        </p>

        <div className="overflow-x-auto mt-3">
          <table className="text-[11.5px] w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {IMPORT_COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className="text-left px-2 py-1 border"
                    style={{ borderColor: "var(--grid)", color: "var(--muted)" }}
                  >
                    {c.header}
                    {c.required ? " *" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {IMPORT_COLUMNS.map((c) => (
                  <td
                    key={c.key}
                    className="px-2 py-1 border"
                    style={{
                      borderColor: "var(--grid)",
                      color: c.required ? "var(--accent-ink)" : "var(--ink-2)",
                    }}
                  >
                    {c.example}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <input
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
            className="text-[12.5px]"
            style={{ color: "var(--ink)" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {errors.length > 0 && (
          <div
            className="mt-3 rounded-md px-3 py-2 text-[12px]"
            style={{ background: "var(--crit-soft)", color: "var(--crit)" }}
          >
            {errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}

        {staged && (
          <div
            className="mt-3 rounded-md px-3 py-2 text-[12.5px]"
            style={{ background: "var(--good-soft)", color: "var(--good)" }}
          >
            {staged.rows.length} row{staged.rows.length === 1 ? "" : "s"} ready to import from{" "}
            {staged.filename}.
          </div>
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
            disabled={!staged}
            className="px-3 py-1.5 rounded-md text-[13px] text-white disabled:opacity-40"
            style={{ background: "var(--accent)" }}
            onClick={confirm}
          >
            Import {staged ? staged.rows.length : ""} lead{staged?.rows.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
