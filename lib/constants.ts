import type { Rep, StageDef } from "./types";

// The people who can sign in. Filled from the server's user list when the app
// loads (lib/sync.ts); nobody is hard-coded here.
let directory: Rep[] = [];

export function setDirectory(reps: Rep[]) {
  directory = reps;
}

export const STAGES: StageDef[] = [
  { id: "new", name: "New", dot: "var(--muted)" },
  { id: "contacted", name: "Contacted", dot: "var(--accent)" },
  { id: "qualified", name: "Qualified", dot: "var(--warn)" },
  { id: "unqualified", name: "Unqualified", dot: "#8f8d80" },
  { id: "proposal", name: "Proposal sent", dot: "#8b5fbf" },
  { id: "won", name: "Won", dot: "var(--good)" },
  { id: "lost", name: "Lost", dot: "var(--crit)" },
];

export const MAIN_STAGE_PATH = ["new", "contacted", "qualified", "proposal", "won"] as const;

export const FIRST = [
  "Rahul", "Ananya", "Vikram", "Sanya", "Kabir", "Ishita", "Rohan", "Divya", "Aditya", "Neha",
  "Karan", "Pooja", "Sameer", "Tara", "Nikhil", "Riya", "Aakash", "Simran", "Varun", "Meghna",
  "Arnav", "Kavya",
];
export const LAST = [
  "Sharma", "Kapoor", "Reddy", "Iyer", "Malhotra", "Bose", "Chatterjee", "Pillai", "Rao", "Bhatt",
  "Menon", "Chawla", "Kulkarni", "Desai", "Verma",
];
export const BRANDS = [
  "Studio Weft", "Luma Home", "Northline Denim", "Copper & Clay", "Verve Eyewear",
  "Palette Kids", "Marrow & Co", "Fable Footwear", "Loom House", "Arden Living",
];
export const MALLS = [
  "UB City Mall", "Phoenix Marketcity", "Forum Sujana", "Select Citywalk", "Orion Mall",
  "Express Avenue", "VR Bengaluru", "Inorbit Mall",
];
export const STORES = [
  "Kavya Boutique, Indiranagar", "The Fitting Room, HSR", "Craft & Case, Koramangala",
  "Sole Story, Jayanagar", "Linen Loft, Whitefield", "Third Aisle, Bandra",
  "Anokhi Home, Vasant Kunj", "Saffron Thread, Banjara Hills", "Tanish Optics, Adyar",
  "The Denim Bar, Kalyani Nagar", "Clay & Cotton, Powai", "Rivaayat, Aundh",
  "Nine Yards, Anna Nagar", "Mud & Muse, Jubilee Hills",
];
export const FN_BRAND = ["Marketing Head", "Retail Ops Head", "Founder", "Category Manager", "Franchise Lead"];
export const FN_MALL = ["Leasing Head", "Centre Director", "Mall Marketing Manager", "Operations Head"];
export const FN_STORE = ["Owner", "Store Manager"];
export const CITIES = ["Bengaluru", "Mumbai", "Delhi NCR", "Chennai", "Hyderabad", "Pune"];

// Malls and single stores name a real locality, so their city is fixed, not
// random. Brands are chains — their city is the HQ, picked at seed time.
export const LOCALITY_CITY: Record<string, string> = {
  Indiranagar: "Bengaluru", HSR: "Bengaluru", Koramangala: "Bengaluru", Jayanagar: "Bengaluru",
  Whitefield: "Bengaluru", Bandra: "Mumbai", Powai: "Mumbai", "Vasant Kunj": "Delhi NCR",
  "Banjara Hills": "Hyderabad", "Jubilee Hills": "Hyderabad", Adyar: "Chennai", "Anna Nagar": "Chennai",
  "Kalyani Nagar": "Pune", Aundh: "Pune",
};
export const MALL_CITY: Record<string, string> = {
  "UB City Mall": "Bengaluru", "Phoenix Marketcity": "Pune", "Forum Sujana": "Hyderabad",
  "Select Citywalk": "Delhi NCR", "Orion Mall": "Bengaluru", "Express Avenue": "Chennai",
  "VR Bengaluru": "Bengaluru", "Inorbit Mall": "Mumbai",
};

export const PRIORITIES = ["Hot", "Warm", "Nurture", "Low"] as const;

export const MEETING_MODES = ["Call", "Video", "In-person"];
export const MEETING_NOTES = [
  "Intro call to walk through the ModenX platform.",
  "Discuss festive-season merchandising plan.",
  "Review leasing terms for the new wing.",
  "Pricing and proposal walkthrough.",
  "Site visit and space requirements.",
];

export const CONTACT_METHODS = ["Call", "WhatsApp", "Email", "NA"];
export const NOTES_BY_METHOD: Record<string, string[]> = {
  Call: ["Spoke with them about the proposal.", "Quick check-in call.", "Discussed pricing on the phone.", "Called to confirm the meeting.", "Follow-up call — no answer, left a voicemail."],
  WhatsApp: ["Sent a WhatsApp follow-up.", "Shared the catalog over WhatsApp.", "Confirmed details via WhatsApp.", "Nudge sent on WhatsApp."],
  Email: ["Sent a follow-up email.", "Emailed the proposal.", "Replied to their email query.", "Sent onboarding documents via email."],
  NA: ["Updated internal notes.", "Marked lead for review.", "Internal note — no direct contact made."],
};

// Reps can't edit a lead's — or an account's — details directly. Saving an
// edit files a request; the manager approves it from Follow-ups before it
// touches anything. Two scopes share one queue: "lead" edits one contact's
// fields, "account" edits a field shared by every contact at that account
// (renaming it, or changing its type) and applies to all of them at once.
export const EDITABLE_FIELDS = [
  { key: "name", label: "Contact name" },
  { key: "title", label: "Job title" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "Location" },
] as const;

export const ACCOUNT_EDITABLE_FIELDS = [
  { key: "account", label: "Account name" },
  { key: "type", label: "Account type" },
] as const;

export function repsList(): Rep[] {
  return directory.filter((r) => r.role === "Rep");
}

export function repById(id: string | null): Rep | undefined {
  if (!id) return undefined;
  return directory.find((r) => r.id === id);
}
