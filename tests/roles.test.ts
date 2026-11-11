import { afterEach, describe, expect, it } from "vitest";
import { assignableList, repsList, setDirectory } from "../lib/constants";
import { DEMO_REPS } from "../lib/seed";
import type { Rep } from "../lib/types";
import { makeLead, resetStore, store } from "./helpers";

const ASHA: Rep = { id: "asha", name: "Asha Rao", role: "Admin", color: "#3b6fc2" };

describe("ROLE. Roles", () => {
  afterEach(() => setDirectory(DEMO_REPS));

  it("ROLE1 an admin can do everything a manager can", () => {
    setDirectory([...DEMO_REPS, ASHA]);
    const mine = makeLead({ assignee: "priya" });
    const open = makeLead({ assignee: null });
    resetStore([mine, open], "asha");
    expect(store().isManager()).toBe(true);
    expect(store().isAdmin()).toBe(true);
    expect(store().visibleLeads()).toHaveLength(2);
  });

  it("ROLE2 managers and reps aren't admins", () => {
    resetStore([], "meera");
    expect(store().isManager()).toBe(true);
    expect(store().isAdmin()).toBe(false);
    resetStore([], "priya");
    expect(store().isManager()).toBe(false);
    expect(store().isAdmin()).toBe(false);
  });

  it("ROLE3 reps and managers can be given leads, admins can't; leave stays a reps' list", () => {
    setDirectory([...DEMO_REPS, ASHA]);
    expect(assignableList().map((r) => r.id)).toEqual(["priya", "arjun", "meera"]);
    expect(repsList().map((r) => r.id)).toEqual(["priya", "arjun"]);
  });
});
