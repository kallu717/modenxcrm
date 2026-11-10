import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../lib/store";
import { accountHref, buildAccounts, buildLocations, filterLocations, locationKey, ownerSummary } from "../lib/accounts";
import { assignableList, sellersList, setDirectory } from "../lib/constants";
import { DEMO_REPS } from "../lib/seed";
import { makeLead, resetStore, store, leadById } from "./helpers";

const as = (userId: string) => useStore.setState({ currentUserId: userId });

describe("L. Locations: one owner per account + city", () => {
  const blr1 = makeLead({ account: "Reliance Retail", city: "Bengaluru", assignee: null, ownerSince: null });
  const blr2 = makeLead({ account: "Reliance Retail", city: " bengaluru", assignee: null, ownerSince: null });
  const mum = makeLead({ account: "Reliance Retail", city: "Mumbai", assignee: null, ownerSince: null });
  const none = makeLead({ account: "Reliance Retail", city: "—", assignee: null, ownerSince: null });
  const solo = makeLead({ account: "Luma Home", city: "Pune", assignee: null, ownerSince: null });
  beforeEach(() => resetStore([blr1, blr2, mum, none, solo]));

  it("L1 city names are matched loosely; blank and — are one 'no city' location", () => {
    expect(locationKey(" Bengaluru ")).toBe("bengaluru");
    expect(locationKey("—")).toBe("");
    expect(locationKey("")).toBe("");
    const locs = buildLocations([blr1, blr2, mum, none]);
    expect(locs.map((l) => [l.city, l.contacts.length])).toEqual([
      ["Bengaluru", 2],
      ["Mumbai", 1],
      ["No city", 1],
    ]);
  });

  it("L2 each city of one account can go to a different person", () => {
    store().assignLocation("Reliance Retail", "bengaluru", "priya");
    store().assignLocation("Reliance Retail", "mumbai", "arjun");
    expect([leadById(blr1.id).assignee, leadById(blr2.id).assignee]).toEqual(["priya", "priya"]);
    expect(leadById(mum.id).assignee).toBe("arjun");
    expect(leadById(none.id).assignee).toBeNull();
    const acct = buildAccounts(store().leads).find((a) => a.name === "Reliance Retail")!;
    expect(acct.owner).toBeNull(); // split between two people
    expect(acct.owners.sort()).toEqual(["arjun", "priya"]);
    expect(leadById(mum.id).activity[0].txt).toBe("Reliance Retail · Mumbai assigned to Arjun Mehta by Meera Iyer.");
  });

  it("L3 an account in one city is handed over whole, like before", () => {
    store().assignAccount("Luma Home", "priya");
    expect(leadById(solo.id).assignee).toBe("priya");
    expect(leadById(solo.id).activity[0].txt).toBe("Account assigned to Priya Nair by Meera Iyer.");
    const acct = buildAccounts(store().leads).find((a) => a.name === "Luma Home")!;
    expect(acct.owner).toBe("priya");
    expect(acct.locations).toHaveLength(1);
  });

  it("L4 'all locations to one person' still works on a multi-city account", () => {
    store().assignAccount("Reliance Retail", "arjun");
    expect(store().leads.filter((l) => l.account === "Reliance Retail").every((l) => l.assignee === "arjun")).toBe(true);
    expect(buildAccounts(store().leads).find((a) => a.name === "Reliance Retail")!.owner).toBe("arjun");
  });

  it("L5 reassigning one city leaves the other cities' owners and dates alone", () => {
    store().assignLocation("Reliance Retail", "bengaluru", "priya");
    store().assignLocation("Reliance Retail", "mumbai", "arjun");
    const mumBefore = leadById(mum.id);
    store().assignLocation("Reliance Retail", "bengaluru", "meera");
    expect(leadById(blr1.id).assignee).toBe("meera");
    expect(leadById(mum.id)).toEqual(mumBefore);
  });

  it("L6 a manager correcting a contact's city moves it to that city's owner", () => {
    store().assignLocation("Reliance Retail", "bengaluru", "priya");
    store().assignLocation("Reliance Retail", "mumbai", "arjun");
    store().saveLeadEdit(mum.id, { city: { from: "Mumbai", to: "Bengaluru" } });
    expect(leadById(mum.id).assignee).toBe("priya");
    expect(leadById(mum.id).activity[0].txt).toContain("now with Priya Nair");
  });

  it("L7 moving a contact to a city nobody owns yet keeps its current owner", () => {
    store().assignLocation("Reliance Retail", "mumbai", "arjun");
    store().saveLeadEdit(mum.id, { city: { from: "Mumbai", to: "Pune" } });
    expect(leadById(mum.id).assignee).toBe("arjun");
  });

  it("L8 an approved city change from a rep follows the new city's owner too", () => {
    store().assignLocation("Reliance Retail", "bengaluru", "priya");
    store().assignLocation("Reliance Retail", "mumbai", "arjun");
    as("arjun");
    store().saveLeadEdit(mum.id, { city: { from: "Mumbai", to: "Bengaluru" } });
    const cr = store().changeRequests[0];
    as("meera");
    store().applyChangeRequest(cr.id, true);
    expect(leadById(mum.id).city).toBe("Bengaluru");
    expect(leadById(mum.id).assignee).toBe("priya");
  });
});

describe("M. Who can own accounts, and whose selling is reported", () => {
  beforeEach(() => setDirectory(DEMO_REPS));

  it("M1 reps and managers can be given accounts, admins cannot", () => {
    setDirectory([...DEMO_REPS, { id: "asha", name: "Asha Rao", role: "Admin", color: "#000" }]);
    const roles = new Set(assignableList().map((r) => r.role));
    expect(roles).toEqual(new Set(["Rep", "Manager"]));
    expect(assignableList().some((r) => r.id === "meera")).toBe(true);
    expect(assignableList().some((r) => r.id === "asha")).toBe(false);
  });

  it("M2 reports show every rep, plus a manager only once they own an account", () => {
    const leads = [makeLead({ assignee: "priya" })];
    expect(sellersList(leads).map((r) => r.id)).not.toContain("meera");
    leads.push(makeLead({ assignee: "meera" }));
    expect(sellersList(leads).map((r) => r.id)).toContain("meera");
    expect(sellersList([]).map((r) => r.id)).toEqual(expect.arrayContaining(["priya", "arjun"]));
  });

  it("M3 a manager who owns leads sees them as her own on her stats", () => {
    resetStore([makeLead({ account: "Mine", assignee: "meera" }), makeLead({ account: "Other", assignee: "priya" })]);
    expect(store().leads.filter((l) => l.assignee === store().currentUserId)).toHaveLength(1);
  });
});

describe("N. One city, many spellings", () => {
  it("N1 Gurgaon and Gurugram (and old names like Bangalore) are one location, shown under the standard name", () => {
    const g1 = makeLead({ account: "DLF", city: "Gurgaon", assignee: null, ownerSince: null });
    const g2 = makeLead({ account: "DLF", city: "Gurugram", assignee: null, ownerSince: null });
    const b = makeLead({ account: "DLF", city: "Bangalore", assignee: null, ownerSince: null });
    const locs = buildLocations([g1, g2, b]);
    expect(locs.map((l) => [l.city, l.contacts.length])).toEqual([
      ["Gurugram", 2],
      ["Bengaluru", 1],
    ]);
    expect(locationKey("Pimpri Chinchwad")).toBe(locationKey("Pimpri-Chinchwad"));
    expect(locationKey("Mumbai")).not.toBe(locationKey("Navi Mumbai"));
  });

  it("N2 a contact typed as Gurgaon joins whoever owns Gurugram", () => {
    const owned = makeLead({ account: "DLF", city: "Gurugram", assignee: "arjun" });
    resetStore([owned], "priya");
    const l = store().createLead({
      name: "New", title: "Founder", account: "DLF", type: "Brand", email: "n@dlf.com",
      phone: "", city: "Gurgaon", verified: false,
    })!;
    expect(l.assignee).toBe("arjun");
    expect(l.activity[0].txt).toContain("DLF · Gurgaon is already owned by Arjun Mehta");
  });
});

describe("O. The account page: who owns which city", () => {
  const leads = [
    makeLead({ account: "R", city: "Pune", assignee: "priya" }),
    makeLead({ account: "R", city: "Pune", assignee: "priya" }),
    makeLead({ account: "R", city: "Agra", assignee: "priya" }),
    makeLead({ account: "R", city: "Mumbai", assignee: "arjun" }),
    makeLead({ account: "R", city: "Nagpur", assignee: null, ownerSince: null }),
    makeLead({ account: "R", city: "Bengaluru", assignee: null, ownerSince: null }),
    makeLead({ account: "R", city: "Bengaluru", assignee: null, ownerSince: null }),
    makeLead({ account: "R", city: "Bengaluru", assignee: null, ownerSince: null }),
  ];
  const locs = buildLocations(leads);

  it("O1 owner chips: most cities first, unassigned last, with contact counts", () => {
    expect(ownerSummary(locs)).toEqual([
      { owner: "priya", cities: 2, contacts: 3 },
      { owner: "arjun", cities: 1, contacts: 1 },
      { owner: null, cities: 2, contacts: 4 },
    ]);
  });

  it("O2 the table is biggest city first by default; city search ignores case", () => {
    expect(filterLocations(locs, {}).map((l) => l.city)).toEqual(["Bengaluru", "Pune", "Agra", "Mumbai", "Nagpur"]);
    expect(filterLocations(locs, { query: "PUN" }).map((l) => l.city)).toEqual(["Pune"]);
    expect(filterLocations(locs, { query: "pu" }).map((l) => l.city)).toEqual(["Pune", "Nagpur"]);
    expect(filterLocations(locs, { sort: "city" }).map((l) => l.city)).toEqual(["Agra", "Bengaluru", "Mumbai", "Nagpur", "Pune"]);
  });

  it("O3 'Unassigned', 'Assigned' and one owner's cities", () => {
    expect(filterLocations(locs, { status: "unassigned" }).map((l) => l.city)).toEqual(["Bengaluru", "Nagpur"]);
    expect(filterLocations(locs, { status: "assigned" })).toHaveLength(3);
    expect(filterLocations(locs, { owner: "priya" }).map((l) => l.city)).toEqual(["Pune", "Agra"]);
  });

  it("O4 assigning several ticked cities at once gives each to that person", () => {
    resetStore(leads.map((l) => ({ ...l })));
    for (const key of ["bengaluru", "nagpur"]) store().assignLocation("R", key, "meera");
    const acct = buildAccounts(store().leads).find((a) => a.name === "R")!;
    expect(ownerSummary(acct.locations).find((s) => s.owner === "meera")).toEqual({ owner: "meera", cities: 2, contacts: 4 });
    expect(acct.locations.every((l) => l.owner)).toBe(true);
  });

  it("O5 each account has its own page address, safe for any name", () => {
    expect(accountHref("Marrow & Co")).toBe("/accounts/view?name=Marrow%20%26%20Co");
  });
});
