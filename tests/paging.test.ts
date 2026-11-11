import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  clampPage,
  pageCount,
  pageNumbers,
  pageRange,
  pageSlice,
  validPageSize,
} from "../lib/paging";
import { EMPTY_FILTERS, parseFilters } from "../lib/filters";

const leads = Array.from({ length: 1906 }, (_, i) => i + 1); // stand-ins for 1,906 leads

describe("PAGING. Long lists in pages", () => {
  it("PAGING1 50 a page by default: 1,906 leads make 39 pages, the last one short", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(50);
    expect(pageCount(1906, 50)).toBe(39);
    expect(pageSlice(leads, 1, 50)).toEqual(leads.slice(0, 50));
    expect(pageSlice(leads, 39, 50)).toEqual(leads.slice(1900)); // 6 rows
    expect(pageRange(39, 1906, 50)).toEqual({ from: 1901, to: 1906 });
  });

  it("PAGING2 'Showing 51–100 of 1,906' on page 2", () => {
    expect(pageRange(2, 1906, 50)).toEqual({ from: 51, to: 100 });
  });

  it("PAGING3 25 and 100 a page work too", () => {
    expect(pageCount(1906, 25)).toBe(77);
    expect(pageCount(1906, 100)).toBe(20);
    expect(pageSlice(leads, 3, 100)).toEqual(leads.slice(200, 300));
  });

  it("PAGING4 ✗ page 0, a negative page, a fraction or not a number all mean page 1", () => {
    for (const bad of [0, -5, NaN, Infinity * -1]) expect(clampPage(bad, 1906, 50)).toBe(1);
    expect(clampPage(2.7, 1906, 50)).toBe(2);
  });

  it("PAGING5 ✗ a page past the end (e.g. after filtering shrank the list) shows the last page", () => {
    expect(clampPage(39, 120, 50)).toBe(3);
    expect(pageSlice(leads.slice(0, 120), 39, 50)).toEqual(leads.slice(100, 120));
    expect(clampPage(Infinity, 120, 50)).toBe(1); // not a real page number at all
  });

  it("PAGING6 ✗ a page size that isn't offered (7, 0, 'big', -50) falls back to 50", () => {
    for (const bad of [7, 0, "big", -50, undefined, null]) expect(validPageSize(bad)).toBe(50);
    expect(pageSlice(leads, 1, 7)).toHaveLength(50);
  });

  it("PAGING7 ✗ an empty list is one empty page, not an error", () => {
    expect(pageCount(0, 50)).toBe(1);
    expect(pageSlice([], 5, 50)).toEqual([]);
    expect(pageRange(1, 0, 50)).toEqual({ from: 0, to: 0 });
  });

  it("PAGING8 a list that fits on one page shows every row", () => {
    expect(pageSlice(leads.slice(0, 30), 1, 50)).toHaveLength(30);
    expect(pageCount(50, 50)).toBe(1);
    expect(pageCount(51, 50)).toBe(2);
  });

  it("PAGING9 page buttons: first, last, current and its neighbours, '…' for gaps", () => {
    expect(pageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageNumbers(1, 39)).toEqual([1, 2, 3, 4, "…", 39]);
    expect(pageNumbers(20, 39)).toEqual([1, "…", 19, 20, 21, "…", 39]);
    expect(pageNumbers(39, 39)).toEqual([1, "…", 36, 37, 38, 39]);
    expect(pageNumbers(3, 39)).toEqual([1, 2, 3, 4, "…", 39]);
  });

  it("PAGING10 ✗ a current page outside the range still gives sensible buttons", () => {
    expect(pageNumbers(0, 39)[0]).toBe(1);
    expect(pageNumbers(99, 39).slice(-1)[0]).toBe(39);
  });
});

describe("PAGING. Remembered filters", () => {
  it("PAGING11 saved filters come back as they were", () => {
    const saved = { ...EMPTY_FILTERS, city: "Mumbai", priority: "Hot" };
    expect(parseFilters(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it("PAGING12 ✗ broken or tampered saved filters fall back to no filter", () => {
    expect(parseFilters(null)).toBeUndefined();
    expect(parseFilters("Mumbai")).toBeUndefined();
    expect(parseFilters({ city: 42, stage: ["won"], hacker: "x" })).toEqual(EMPTY_FILTERS);
    expect(parseFilters({ city: "Pune", extra: "ignored" })).toEqual({ ...EMPTY_FILTERS, city: "Pune" });
  });
});
