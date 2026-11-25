import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../lib/store";
import { phoneDigits } from "../lib/phone";
import { stageImport } from "../lib/import";
import { makeLead, resetStore, store, leadById } from "./helpers";

// Every contact needs an email or a 10-digit phone (or both), and a phone
// number, like an email, can belong to only one lead. The server applies the
// same rules (backend/tests/test_phone.py); these are the in-browser checks.

const row = (p: Record<string, unknown> = {}) => ({
  "First name": "Ananya",
  "Last name": "Sharma",
  "Job title": "Marketing Head",
  "Account name": "Brand New Co",
  "Account type": "Brand",
  ...p,
});

describe("PH. Phone numbers", () => {
  it("PH1 the 10-digit rule (same cases as the server)", () => {
    const cases: [string, string | null][] = [
      ["9876543210", "9876543210"],
      ["98765 43210", "9876543210"],
      ["+91 98765 43210", "9876543210"],
      ["+91-98765-43210", "9876543210"],
      ["919876543210", "9876543210"],
      ["080 2558 8844", "8025588844"],
      ["(080) 2558-8844", "8025588844"],
      ["987654321", null],
      ["98765432101", null],
      ["+1 415 555 0100 9", null],
      ["98765abc10", null],
      ["", null],
      ["   ", null],
    ];
    for (const [raw, want] of cases) expect(phoneDigits(raw), raw).toBe(want);
  });
});

describe("PH. Importing with an email, a phone, or both", () => {
  const existing = [makeLead({ email: "taken@studioweft.com", phone: "+91 98765 43210" })];

  it("PH2 email only is imported", () => {
    const s = stageImport([row({ Email: "a@brandnew.com" })], "x", existing);
    expect(s.rows).toHaveLength(1);
  });

  it("PH3 phone only is imported, saved as 10 digits", () => {
    const s = stageImport([row({ Phone: "+91 91234 56789" })], "x", existing);
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]).toMatchObject({ email: "", phone: "9123456789" });
  });

  it("PH4 ✗ neither email nor phone is refused", () => {
    const s = stageImport([row()], "x", existing);
    expect(s.rows).toHaveLength(0);
    expect(s.rejected).toBe(1);
    expect(s.issues[0]).toContain("needs an email or a phone number");
  });

  it("PH5 ✗ a phone that isn't 10 digits is refused", () => {
    const s = stageImport([row({ Phone: "12345" }), row({ Phone: "98765432101", Email: "b@x.co" })], "x", existing);
    expect(s.rows).toHaveLength(0);
    expect(s.rejected).toBe(2);
    expect(s.issues.every((t) => t.includes("must be 10 digits"))).toBe(true);
  });

  it("PH6 ✗ a phone already in the CRM is skipped, however it's typed", () => {
    const s = stageImport([row({ Phone: "098765-43210", Email: "new@x.co" })], "x", existing);
    expect(s.rows).toHaveLength(0);
    expect(s.duplicates).toBe(1);
    expect(s.issues[0]).toContain("phone 9876543210 already exists");
  });

  it("PH7 ✗ the same phone twice in one sheet keeps only the first", () => {
    const s = stageImport([row({ Phone: "9123456789" }), row({ "First name": "Twin", Phone: "91234 56789" })], "x", existing);
    expect(s.rows).toHaveLength(1);
    expect(s.duplicates).toBe(1);
  });

  it("PH8 ✗ a badly formed email is refused", () => {
    const s = stageImport([row({ Email: "not-an-email" })], "x", existing);
    expect(s.rows).toHaveLength(0);
    expect(s.issues[0]).toContain("doesn't look like an email address");
  });
});

describe("PH. Editing a contact's phone", () => {
  const a = makeLead({ account: "Studio Weft", phone: "9000000000", email: "a@studioweft.com" });
  const b = makeLead({ account: "Studio Weft", phone: "+91 98765 43210", email: "b@studioweft.com" });
  beforeEach(() => {
    resetStore([a, b]);
    useStore.setState({ currentUserId: "meera" });
  });

  it("PH9 ✗ a phone another lead has is refused", () => {
    const err = store().saveLeadEdit(a.id, { phone: { from: a.phone, to: "98765 43210" } });
    expect(err).toBe("Another lead already has that phone number");
    expect(leadById(a.id).phone).toBe("9000000000");
  });

  it("PH10 ✗ a phone that isn't 10 digits is refused", () => {
    const err = store().saveLeadEdit(a.id, { phone: { from: a.phone, to: "12345" } });
    expect(err).toContain("must be 10 digits");
  });

  it("PH11 a good phone is saved as its 10 digits", () => {
    expect(store().saveLeadEdit(a.id, { phone: { from: a.phone, to: "+91 91234-56789" } })).toBeNull();
    expect(leadById(a.id).phone).toBe("9123456789");
  });
});
