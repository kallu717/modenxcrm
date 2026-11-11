"use client";

import { PAGE_SIZES, clampPage, pageCount, pageNumbers, pageRange } from "@/lib/paging";

// "Showing 51–100 of 1,906 leads" · rows per page · ‹ 1 … 4 5 6 … 39 ›
export default function Pager({
  page,
  size,
  total,
  noun,
  onPage,
  onSize,
}: {
  page: number;
  size: number;
  total: number;
  noun: [string, string]; // ["lead", "leads"]
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  const pages = pageCount(total, size);
  const current = clampPage(page, total, size);
  const { from, to } = pageRange(current, total, size);
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const btn = "min-w-[30px] h-[30px] px-2 rounded-md text-[12.5px] border disabled:opacity-40 disabled:cursor-not-allowed";
  const go = (p: number) => onPage(clampPage(p, total, size));

  return (
    <nav
      aria-label={`${noun[1]} pages`}
      className="flex items-center justify-between gap-3 flex-wrap py-3 text-[12.5px]"
      style={{ color: "var(--ink-2)" }}
    >
      <span>
        {total === 0 ? (
          `No ${noun[1]}`
        ) : (
          <>
            Showing <b style={{ color: "var(--ink)" }}>{fmt(from)}–{fmt(to)}</b> of{" "}
            <b style={{ color: "var(--ink)" }}>{fmt(total)}</b> {total === 1 ? noun[0] : noun[1]}
          </>
        )}
      </span>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5">
          Rows per page
          <select
            value={size}
            onChange={(e) => onSize(Number(e.target.value))}
            className="px-2 py-1 rounded-md border text-[12.5px]"
            style={{ borderColor: "var(--grid)", background: "var(--surface)", color: "var(--ink)" }}
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        {pages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={btn}
              style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
              disabled={current === 1}
              onClick={() => go(current - 1)}
              aria-label="Previous page"
            >
              ‹ Prev
            </button>
            {pageNumbers(current, pages).map((n, i) =>
              n === "…" ? (
                <span key={`gap-${i}`} className="px-1" style={{ color: "var(--muted)" }}>
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  className={btn}
                  aria-label={`Page ${n}`}
                  aria-current={n === current ? "page" : undefined}
                  onClick={() => go(n)}
                  style={{
                    borderColor: n === current ? "var(--accent)" : "var(--grid)",
                    background: n === current ? "var(--accent-soft)" : "var(--surface)",
                    color: n === current ? "var(--accent-ink)" : "var(--ink)",
                    fontWeight: n === current ? 600 : 400,
                  }}
                >
                  {n}
                </button>
              )
            )}
            <button
              type="button"
              className={btn}
              style={{ borderColor: "var(--grid)", color: "var(--ink)" }}
              disabled={current === pages}
              onClick={() => go(current + 1)}
              aria-label="Next page"
            >
              Next ›
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
