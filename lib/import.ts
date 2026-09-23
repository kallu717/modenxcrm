import type { AccountType } from "./types";

export const IMPORT_COLUMNS = [
  { key: "name", header: "Contact name", required: true, example: "Ananya Sharma" },
  { key: "title", header: "Job title", required: true, example: "Marketing Head" },
  { key: "account", header: "Account name", required: true, example: "Studio Weft" },
  { key: "type", header: "Account type", required: true, example: "Brand" },
  { key: "email", header: "Email", required: false, example: "ananya@studioweft.com" },
  { key: "verified", header: "Email verified", required: false, example: "Yes" },
  { key: "phone", header: "Phone", required: false, example: "+91 9812345678" },
  { key: "city", header: "City", required: false, example: "Bengaluru" },
  { key: "notes", header: "Notes", required: false, example: "Met at retail expo" },
] as const;

export const VALID_TYPES: AccountType[] = ["Brand", "Mall", "Store"];

export interface ImportRow {
  name: string;
  title: string;
  account: string;
  type: AccountType;
  email: string;
  verified: string;
  phone: string;
  city: string;
  notes: string;
}

function splitDelimited(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface ParsedImport {
  rows: ImportRow[];
  errors: string[];
}

// Accepts CSV or tab-separated (pasted from a spreadsheet). The header row
// must match IMPORT_COLUMNS' headers, in any order.
export function parseImportText(text: string): ParsedImport {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length);
  if (!lines.length) return { rows: [], errors: ["No data found."] };

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const header = splitDelimited(lines[0], delimiter).map((h) => h.toLowerCase());
  const colIndex: Partial<Record<string, number>> = {};
  IMPORT_COLUMNS.forEach((c) => {
    const idx = header.findIndex((h) => h === c.header.toLowerCase());
    if (idx >= 0) colIndex[c.key] = idx;
  });

  const missingRequired = IMPORT_COLUMNS.filter((c) => c.required && colIndex[c.key] === undefined);
  if (missingRequired.length) {
    return {
      rows: [],
      errors: [`Missing required column(s): ${missingRequired.map((c) => c.header).join(", ")}`],
    };
  }

  const rows: ImportRow[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, i) => {
    const cells = splitDelimited(line, delimiter);
    const get = (key: string) => {
      const idx = colIndex[key];
      return idx === undefined ? "" : (cells[idx] || "").trim();
    };
    const name = get("name");
    const title = get("title");
    const account = get("account");
    const typeRaw = get("type");
    const type = VALID_TYPES.find((t) => t.toLowerCase() === typeRaw.toLowerCase());

    if (!name || !title || !account || !type) {
      errors.push(`Row ${i + 2}: missing a required field or invalid account type ("${typeRaw}").`);
      return;
    }
    rows.push({
      name,
      title,
      account,
      type,
      email: get("email"),
      verified: get("verified"),
      phone: get("phone"),
      city: get("city"),
      notes: get("notes"),
    });
  });

  return { rows, errors };
}
