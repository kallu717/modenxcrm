import * as XLSX from "xlsx";
import type { AccountType, Lead } from "./types";
import { EMAIL_RE, PHONE_RULE, phoneDigits, phoneKey } from "./phone";

export const IMPORT_COLUMNS = [
  { key: "firstName", header: "First name", required: true, example: "Ananya" },
  { key: "lastName", header: "Last name", required: true, example: "Sharma" },
  { key: "title", header: "Job title", required: true, example: "Marketing Head" },
  { key: "account", header: "Account name", required: true, example: "Studio Weft" },
  { key: "type", header: "Account type", required: true, example: "Brand" },
  // Email and Phone: each is optional, but every row needs at least one.
  { key: "email", header: "Email", required: false, example: "ananya@studioweft.com" },
  { key: "verified", header: "Email verified", required: false, example: "Yes" },
  { key: "phone", header: "Phone", required: false, example: "+91 9812345678" },
  { key: "city", header: "City", required: false, example: "Bengaluru" },
  { key: "notes", header: "Notes", required: false, example: "Met at retail expo" },
] as const;

export const VALID_TYPES: AccountType[] = ["Brand", "Mall", "Store"];

export interface ImportRow {
  firstName: string;
  lastName: string;
  title: string;
  account: string;
  type: AccountType;
  email: string;
  verified: string;
  phone: string;
  city: string;
  notes: string;
}

export interface StagedImport {
  rows: ImportRow[];
  filename: string;
  newAccounts: number;
  duplicates: number;
  rejected: number;
  issues: string[];
}

export function templateTsv(withExample: boolean): string {
  const head = IMPORT_COLUMNS.map((c) => c.header).join("\t");
  return withExample ? head + "\n" + IMPORT_COLUMNS.map((c) => c.example).join("\t") : head;
}

// Reads .xlsx, .xls or .csv — first sheet, row 1 as headers.
export async function readSheet(file: File): Promise<Record<string, unknown>[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
}

// Validate everything before touching app state, so a bad sheet can't
// half-import. Every row needs an email or a phone number (or both). Emails
// and phone numbers already in the CRM (or repeated within the sheet) are
// skipped as duplicates.
export function stageImport(raw: Record<string, unknown>[], filename: string, existing: Lead[]): StagedImport {
  const headerFor: Record<string, string> = {};
  IMPORT_COLUMNS.forEach((c) => (headerFor[c.header.toLowerCase()] = c.key));
  const existingEmails = new Set(existing.map((l) => (l.email || "").toLowerCase()).filter(Boolean));
  const existingPhones = new Set(existing.map((l) => phoneKey(l.phone || "")).filter(Boolean));
  const seen = new Set<string>();
  const seenPhones = new Set<string>();
  const rows: ImportRow[] = [];
  const issues: string[] = [];
  let duplicates = 0;

  raw.forEach((obj, i) => {
    const rowNo = i + 2; // row 1 is the header
    const r: Record<string, string> = {};
    Object.entries(obj).forEach(([k, v]) => {
      const key = headerFor[String(k).trim().toLowerCase()];
      if (key) r[key] = String(v ?? "").trim();
    });
    const missing = IMPORT_COLUMNS.filter((c) => c.required && !r[c.key]).map((c) => c.header);
    if (missing.length) {
      issues.push(`Row ${rowNo}: missing ${missing.join(", ")}`);
      return;
    }
    const type = VALID_TYPES.find((t) => t.toLowerCase() === r.type.toLowerCase());
    if (!type) {
      issues.push(`Row ${rowNo}: account type "${r.type}" must be Brand, Mall or Store`);
      return;
    }
    if (!r.email && !r.phone) {
      issues.push(`Row ${rowNo}: needs an email or a phone number`);
      return;
    }
    if (r.email && !EMAIL_RE.test(r.email)) {
      issues.push(`Row ${rowNo}: ${r.email} doesn't look like an email address`);
      return;
    }
    const phone = r.phone ? phoneDigits(r.phone) : "";
    if (phone === null) {
      issues.push(`Row ${rowNo}: phone ${r.phone} ${PHONE_RULE}`);
      return;
    }
    const email = (r.email || "").toLowerCase();
    if (email && (existingEmails.has(email) || seen.has(email))) {
      duplicates++;
      issues.push(`Row ${rowNo}: ${r.email} already exists — skipped`);
      return;
    }
    if (phone && (existingPhones.has(phone) || seenPhones.has(phone))) {
      duplicates++;
      issues.push(`Row ${rowNo}: phone ${phone} already exists — skipped`);
      return;
    }
    if (email) seen.add(email);
    if (phone) seenPhones.add(phone);
    rows.push({
      firstName: r.firstName,
      lastName: r.lastName,
      title: r.title,
      account: r.account,
      type,
      email: r.email || "",
      verified: r.verified || "",
      phone,
      city: r.city || "",
      notes: r.notes || "",
    });
  });

  const existingAccounts = new Set(existing.map((l) => l.account.toLowerCase()));
  const newAccounts = new Set(
    rows.map((r) => r.account).filter((a) => !existingAccounts.has(a.toLowerCase()))
  ).size;

  return { rows, filename, newAccounts, duplicates, rejected: issues.length - duplicates, issues };
}
