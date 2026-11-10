"use client";

import { useEffect, useState } from "react";

// State that survives leaving a page and coming back (e.g. Accounts -> an
// account -> back) for the rest of this browser tab's session. `parse` checks
// what was stored, so a stale or hand-edited value falls back to `initial`.
// Callers put the signed-in user's id in `key`, so one person's filters never
// carry over to the next person signing in on the same computer.
export function useSessionState<T>(
  key: string,
  initial: T,
  parse: (raw: unknown) => T | undefined = (raw) => raw as T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw === null) return initial;
      const parsed = parse(JSON.parse(raw));
      return parsed === undefined ? initial : parsed;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or blocked: the page still works, it just won't remember
    }
  }, [key, value]);

  return [value, setValue];
}
