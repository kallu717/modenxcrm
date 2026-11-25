// Phone numbers are 10 digits. People type them many ways, so spaces,
// dashes, dots and brackets are ignored, and a leading +91 / 91 or a
// leading 0 (as in 080 2558 8844) is dropped. What's left must be exactly
// 10 digits. The same rule runs on the server (backend/app/phone.py), and
// the 10 digits are what duplicates are matched on.

export const PHONE_RULE = "must be 10 digits (a +91 or leading 0 is fine)";

export function phoneDigits(raw: string): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (!/^\+?[\d\s\-.()]+$/.test(s)) return null;
  let d = s.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.length === 10 ? d : null;
}

// The duplicate key of a saved lead's phone, or "" when it has none (or an
// old number that doesn't fit the rule).
export function phoneKey(raw: string): string {
  return phoneDigits(raw) ?? "";
}

export const EMAIL_RE = /^\S+@\S+\.\S+$/;
