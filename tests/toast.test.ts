import { describe, expect, it } from "vitest";
import { toastDuration, toastTone } from "../lib/toast";

describe("TOAST. Message colour", () => {
  it("TOAST1 confirmations are success", () => {
    for (const m of ["Dashboard saved", "Holiday added", "Meeting scheduled", "Priya Nair added — unassigned", "Changes saved"])
      expect(toastTone(m), m).toBe("success");
  });

  it("TOAST2 ✗ refusals and problems are errors", () => {
    for (const m of [
      "Another lead already has that phone number",
      "Phone must be 10 digits (a +91 or leading 0 is fine)",
      "That email doesn't look right",
      "Can't approve — another lead already uses x@y.in",
      "Couldn't reach the server. Check your connection.",
      "Already a holiday on that date",
      "Pick a date and time",
      "That's already a weekend",
    ])
      expect(toastTone(m), m).toBe("error");
  });

  it("TOAST3 notes are info", () => {
    expect(toastTone("Nothing changed")).toBe("info");
    expect(toastTone("Sent to manager for approval")).toBe("info");
  });

  it("TOAST4 a caller's choice wins", () => {
    expect(toastTone("Priya no longer has access", "success")).toBe("success");
    expect(toastTone("Saved", "error")).toBe("error");
  });

  it("TOAST5 errors stay up longer", () => {
    expect(toastDuration("error")).toBeGreaterThan(toastDuration("success"));
  });
});
