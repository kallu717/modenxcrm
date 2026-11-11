import { describe, expect, it } from "vitest";
import { accountsCsv, buildAccounts } from "../lib/accounts";
import { makeLead, resetStore, store } from "./helpers";

const unowned = { assignee: null, ownerSince: null };

describe("BULK. Acting on many accounts at once", () => {
  it("BULK1 assigning several accounts gives every city of each to that person", () => {
    resetStore([
      makeLead({ account: "Alpha", city: "Pune", ...unowned }),
      makeLead({ account: "Alpha", city: "Mumbai", assignee: "arjun" }),
      makeLead({ account: "Beta", city: "Delhi", ...unowned }),
      makeLead({ account: "Gamma", city: "Delhi", ...unowned }),
    ]);
    for (const name of ["Alpha", "Beta"]) store().assignAccount(name, "meera");
    const owner = (acct: string) => [...new Set(store().leads.filter((l) => l.account === acct).map((l) => l.assignee))];
    expect(owner("Alpha")).toEqual(["meera"]);
    expect(owner("Beta")).toEqual(["meera"]);
    expect(owner("Gamma")).toEqual([null]); // not ticked, not touched
  });

  it("BULK2 unassigning several accounts clears their owner", () => {
    resetStore([makeLead({ account: "Alpha" }), makeLead({ account: "Beta", assignee: "arjun" })]);
    for (const name of ["Alpha", "Beta"]) store().assignAccount(name, null);
    expect(store().leads.map((l) => l.assignee)).toEqual([null, null]);
  });

  it("BULK3 deleting several accounts removes all their contacts and nothing else", () => {
    resetStore([
      makeLead({ account: "Alpha" }), makeLead({ account: "Alpha" }),
      makeLead({ account: "Beta" }), makeLead({ account: "Keep" }),
    ]);
    for (const name of ["Alpha", "Beta"]) store().deleteAccount(name);
    expect(store().leads.map((l) => l.account)).toEqual(["Keep"]);
  });

  it("BULK4 setting priority for selected accounts overrides every contact; 'automatic' clears it", () => {
    const a = makeLead({ account: "Alpha", priorityAuto: "Low" });
    const b = makeLead({ account: "Alpha", priorityAuto: "Warm" });
    resetStore([a, b]);
    [a, b].forEach((c) => store().setPriority(c.id, "Hot"));
    expect(store().leads.map((l) => l.priorityOverride)).toEqual(["Hot", "Hot"]);
    [a, b].forEach((c) => store().setPriority(c.id, null));
    expect(store().leads.map((l) => l.priorityOverride)).toEqual([null, null]);
  });

  it("BULK5 export lists every contact of the selected accounts with a header row", () => {
    const accounts = buildAccounts([
      makeLead({ account: "Alpha", name: "Asha Rao", city: "Pune", assignee: "priya" }),
      makeLead({ account: "Alpha", name: "Ravi K", city: "Mumbai", ...unowned }),
    ]);
    const lines = accountsCsv(accounts, (id) => (id ? "Priya Nair" : "Unassigned")).split("\r\n");
    expect(lines[0]).toBe("Account,Account type,Contact name,Job title,City,Email,Phone,Stage,Priority,Owner");
    expect(lines).toHaveLength(3);
    expect(lines.some((l) => l.includes("Asha Rao") && l.endsWith("Priya Nair"))).toBe(true);
    expect(lines.some((l) => l.includes("Ravi K") && l.endsWith("Unassigned"))).toBe(true);
  });

  it("BULK6 ✗ export can't be used to smuggle spreadsheet formulas; commas and quotes stay in their cell", () => {
    const accounts = buildAccounts([
      makeLead({ account: "Evil, Inc", name: '=HYPERLINK("http://x")', title: "+cmd", phone: "-1", email: "@a" }),
    ]);
    const row = accountsCsv(accounts, () => "Unassigned").split("\r\n")[1];
    expect(row.startsWith('"Evil, Inc"')).toBe(true);
    expect(row).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(row).toContain(",'+cmd,");
    expect(row).toContain(",'-1,");
    expect(row).toContain(",'@a,");
  });

  it("BULK7 ✗ an empty selection exports just the header", () => {
    expect(accountsCsv([], () => "")).toBe("Account,Account type,Contact name,Job title,City,Email,Phone,Stage,Priority,Owner");
  });
});
