// Paging for long lists (Leads, Accounts). Pages are numbered from 1.

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 50;

export function validPageSize(size: unknown): number {
  return PAGE_SIZES.includes(size as (typeof PAGE_SIZES)[number]) ? (size as number) : DEFAULT_PAGE_SIZE;
}

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / validPageSize(size)));
}

// Any page number in, a page that exists out: below 1 is page 1; past the
// end (e.g. after filtering shrank the list) is the last page.
export function clampPage(page: number, total: number, size: number): number {
  const p = Number.isFinite(page) ? Math.floor(page) : 1;
  return Math.min(Math.max(1, p), pageCount(total, size));
}

export function pageSlice<T>(items: T[], page: number, size: number): T[] {
  const s = validPageSize(size);
  const p = clampPage(page, items.length, s);
  return items.slice((p - 1) * s, p * s);
}

// "Showing 51–100 of 1,906": the 1-based positions of the first and last row.
export function pageRange(page: number, total: number, size: number): { from: number; to: number } {
  if (total <= 0) return { from: 0, to: 0 };
  const s = validPageSize(size);
  const p = clampPage(page, total, s);
  return { from: (p - 1) * s + 1, to: Math.min(p * s, total) };
}

// Page buttons to show: always the first and last, the current one and its
// neighbours, and "…" for the gaps. E.g. page 6 of 20 -> 1 … 5 6 7 … 20.
export function pageNumbers(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const p = Math.min(Math.max(1, page), pages);
  const keep = new Set([1, pages, p - 1, p, p + 1].filter((n) => n >= 1 && n <= pages));
  if (p <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (p >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((n) => keep.add(n));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}
