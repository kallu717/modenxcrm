// Dates are calendar days, never instants. toISOString() would convert local
// midnight to UTC and shift the day backwards for anyone east of UTC (IST
// included), so every ISO string here is built from local parts instead.

export function isoOf(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export function isoToday(): string {
  return isoOf(new Date());
}

export function isoPlusDays(iso: string | null, n: number): string {
  const d = iso ? new Date(iso + "T00:00:00") : new Date();
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

// dow: 0=Sun..6=Sat, "next" includes today
export function nextWeekday(dow: number): string {
  const d = new Date();
  const diff = (dow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return isoOf(d);
}

export function daysUntil(iso: string): number {
  return Math.round(
    (new Date(iso + "T00:00:00").getTime() - new Date(isoToday() + "T00:00:00").getTime()) /
      86400000
  );
}

export function daysBetweenInclusive(fromIso: string, toIso: string): number {
  return (
    Math.round(
      (new Date(toIso + "T00:00:00").getTime() - new Date(fromIso + "T00:00:00").getTime()) /
        86400000
    ) + 1
  );
}

export function fmtFollowup(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  const label = d.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (days === 0) return "Today · " + label;
  if (days === 1) return "Tomorrow · " + label;
  if (days === -1) return "Yesterday · " + label;
  if (days < 0) return Math.abs(days) + "d overdue · " + label;
  return label;
}

export function followupBucket(iso: string | null): "overdue" | "today" | "upcoming" | null {
  if (!iso) return null;
  const today = isoToday();
  if (iso < today) return "overdue";
  if (iso === today) return "today";
  return "upcoming";
}

export function fmtShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-IN", opts);
}

export function fmtDueIn(iso: string): string {
  const d = daysUntil(iso);
  const label = new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (d === 0) return "Today · " + label;
  if (d === 1) return "Tomorrow · " + label;
  return `in ${d} days · ${label}`;
}
