import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Pages are built ahead of time. A page that reads the address's ?query
// through its `searchParams` prop gets nothing in a production build (it
// worked in development, which is how the account page broke in production
// on 11 Nov 2026). Pages must use useSearchParams inside <Suspense> instead.

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return pages(p);
    return f === "page.tsx" ? [p] : [];
  });
}

const appDir = new URL("../app", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

describe("PAGES. Reading the address in production builds", () => {
  it("PAGES1 ✗ no client page reads ?query through the searchParams prop", () => {
    const offenders = pages(appDir).filter((p) => {
      const src = readFileSync(p, "utf8");
      return src.includes('"use client"') && /\bsearchParams\b/.test(src.replace(/\/\/.*$/gm, ""));
    });
    expect(offenders).toEqual([]);
  });

  it("PAGES2 pages that read ?query wrap the reader in Suspense", () => {
    for (const p of pages(appDir)) {
      const src = readFileSync(p, "utf8");
      if (src.includes("useSearchParams(")) expect(src, p).toContain("<Suspense");
    }
  });
});
