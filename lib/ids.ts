// Ids for records the browser creates (change and leave requests, leave days,
// meetings). Several people create them at once, so a counter would collide;
// these are random. Lead ids are different: the server hands those out.
// getRandomValues works on plain http too, unlike crypto.randomUUID.
export function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return prefix + "-" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
