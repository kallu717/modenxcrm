"use client";

import { DEFAULT_PAGE_SIZE, clampPage, validPageSize } from "./paging";
import { useSessionState } from "./useSessionState";

interface PagingState {
  page: number;
  size: number;
  // What the list was filtered by when this page was chosen. A different
  // filter is a different list, so it starts again at page 1.
  filterKey: string;
}

function parsePaging(raw: unknown): PagingState | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  return {
    page: typeof r.page === "number" ? r.page : 1,
    size: validPageSize(r.size),
    filterKey: typeof r.filterKey === "string" ? r.filterKey : "",
  };
}

// Page and page size for one list, remembered for the session (so coming
// back from a lead or an account lands on the same page) and reset to page 1
// whenever the filters change.
export function usePaging(storageKey: string, total: number, filterKey: string) {
  const [state, setState] = useSessionState<PagingState>(
    storageKey,
    { page: 1, size: DEFAULT_PAGE_SIZE, filterKey },
    parsePaging
  );
  if (state.filterKey !== filterKey) {
    setState({ ...state, page: 1, filterKey });
  }
  return {
    page: clampPage(state.filterKey === filterKey ? state.page : 1, total, state.size),
    size: state.size,
    setPage: (page: number) => setState((s) => ({ ...s, page: clampPage(page, total, s.size) })),
    // A new page size starts from the top, so nobody lands mid-list.
    setSize: (size: number) => setState((s) => ({ ...s, size: validPageSize(size), page: 1 })),
  };
}
