import { beforeEach, vi } from "vitest";
import { setDirectory } from "../lib/constants";
import { DEMO_REPS } from "../lib/seed";

// The team is in India. Node picks up a TZ change at runtime, so this makes
// every Date in the tests behave as it would on a rep's laptop in IST.
process.env.TZ = "Asia/Kolkata";

export const NOW = "2026-09-23T10:00:00+05:30"; // Wed

// The app loads its users from the server; tests use the made-up team.
setDirectory(DEMO_REPS);

vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date(NOW));

const memory = new Map<string, string>();
globalThis.sessionStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: () => null,
  get length() {
    return memory.size;
  },
} as Storage;

beforeEach(() => {
  vi.setSystemTime(new Date(NOW));
});
