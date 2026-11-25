import { beforeEach, describe, expect, it } from "vitest";
import { quickSearch, readRecent, rememberRecent } from "../lib/quicksearch";
import { makeLead } from "./helpers";

const pages = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/accounts", label: "Accounts" },
];
const leads = [
  makeLead({ id: "L101", name: "Ananya Sharma", account: "Studio Weft", city: "Pune", email: "ananya@weft.in", phone: "9876543210" }),
  makeLead({ id: "L102", name: "Rohan Rao", account: "Studio Weft", city: "Mumbai", email: "rohan@weft.in", phone: "" }),
  makeLead({ id: "L103", name: "Kabir Bose", account: "Luma Home", city: "Pune", email: "kabir@luma.in", phone: "" }),
];

describe("QS. Quick search (press /)", () => {
  it("QS1 nothing typed finds nothing (the box shows recent and pages instead)", () => {
    expect(quickSearch("  ", leads, pages)).toEqual([]);
  });

  it("QS2 finds a contact by name, and ranks name matches first", () => {
    const hits = quickSearch("ana", leads, pages).filter((h) => h.kind === "lead");
    expect(hits[0]).toMatchObject({ id: "L101", title: "Ananya Sharma" });
    expect(hits[0].detail).toContain("Studio Weft");
  });

  it("QS3 finds an account once, with its contact and city count", () => {
    const acc = quickSearch("weft", leads, pages).filter((h) => h.kind === "account");
    expect(acc).toEqual([{ kind: "account", id: "Studio Weft", title: "Studio Weft", detail: "2 contacts · 2 cities" }]);
  });

  it("QS4 finds by lead ID, email or part of a phone number", () => {
    expect(quickSearch("l103", leads, pages).find((h) => h.kind === "lead")?.id).toBe("L103");
    expect(quickSearch("kabir@", leads, pages).find((h) => h.kind === "lead")?.id).toBe("L103");
    expect(quickSearch("43210", leads, pages).find((h) => h.kind === "lead")?.id).toBe("L101");
  });

  it("QS5 finds pages", () => {
    expect(quickSearch("dash", leads, pages)[0]).toMatchObject({ kind: "page", id: "/dashboard" });
  });

  it("QS6 ✗ only searches what it's given: a contact not in the list never shows", () => {
    expect(quickSearch("kabir", leads.slice(0, 2), pages)).toEqual([]);
  });

  it("QS7 ✗ no match gives an empty list", () => {
    expect(quickSearch("zzzz", leads, pages)).toEqual([]);
  });
});

describe("QS. Recent picks", () => {
  // Tests run outside a browser: a stand-in for its storage.
  beforeEach(() => {
    const m = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  });

  it("QS8 newest first, no repeats, at most 5", () => {
    for (let i = 1; i <= 7; i++) rememberRecent({ kind: "lead", id: `L${i}`, title: `T${i}`, detail: "" });
    rememberRecent({ kind: "lead", id: "L5", title: "T5", detail: "" });
    expect(readRecent().map((h) => h.id)).toEqual(["L5", "L7", "L6", "L4", "L3"]);
  });

  it("QS9 ✗ bad saved data is ignored", () => {
    localStorage.setItem("bdcrm:recent-search", "{not json");
    expect(readRecent()).toEqual([]);
  });
});
