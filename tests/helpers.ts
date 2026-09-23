import { vi } from "vitest";
import { useStore } from "../lib/store";
import type { Lead } from "../lib/types";

let seq = 900;

export function makeLead(p: Partial<Lead> = {}): Lead {
  seq++;
  return {
    id: "L" + seq,
    name: "Test Person " + seq,
    account: "Studio Weft",
    type: "Brand",
    city: "Mumbai",
    title: "Founder",
    email: `person${seq}@studioweft.com`,
    phone: "",
    emailQuality: "verified",
    multiSource: false,
    priorityAuto: "Warm",
    priorityOverride: null,
    score: 20,
    scoreReasons: [],
    stage: "new",
    stageHistory: [{ stage: "new", date: "2026-09-01" }],
    wonAt: null,
    assignee: "priya",
    ownerSince: "2026-09-01",
    plan: null,
    mandateDate: null,
    createdAt: "2026-09-01",
    nextFollowup: null,
    meetings: [],
    activity: [],
    ...p,
  };
}

export function resetStore(leads: Lead[], userId = "meera") {
  useStore.setState(useStore.getInitialState(), true);
  useStore.setState({ leads, currentUserId: userId });
}

export const store = () => useStore.getState();
export const leadById = (id: string) => store().leads.find((l) => l.id === id)!;

export function at(iso: string) {
  vi.setSystemTime(new Date(iso));
}
