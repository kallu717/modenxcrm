import { isoToday, isoPlusDays, fmtShortDate } from "./dates";
import { scoreLead, bandForScore, isClosedStage } from "./scoring";
import {
  REPS, STAGES, MAIN_STAGE_PATH, FIRST, LAST, BRANDS, MALLS, STORES,
  FN_BRAND, FN_MALL, FN_STORE, CITIES, LOCALITY_CITY, MALL_CITY,
  MEETING_MODES, MEETING_NOTES, NOTES_BY_METHOD, repsList, repById,
} from "./constants";
import type { AccountType, CompanyHoliday, Lead, RepLeave, Stage } from "./types";

function seedRand(seed: number) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildStageHistory(rnd: () => number, createdAt: string, finalStage: Stage) {
  const history = [{ stage: "new" as Stage, date: createdAt }];
  if (finalStage === "new") return { history, wonAt: null as string | null };
  let steps: Stage[];
  if (finalStage === "lost" || finalStage === "unqualified") {
    const upto = 1 + Math.floor(rnd() * 3); // reaches 1-3 real stages before exiting
    steps = [...MAIN_STAGE_PATH.slice(1, 1 + upto), finalStage] as Stage[];
  } else {
    steps = MAIN_STAGE_PATH.slice(1, MAIN_STAGE_PATH.indexOf(finalStage) + 1) as unknown as Stage[];
  }
  let prevDate = createdAt;
  steps.forEach((s) => {
    let d = isoPlusDays(prevDate, 1 + Math.floor(rnd() * 12));
    if (d > isoToday()) d = isoToday();
    history.push({ stage: s, date: d });
    prevDate = d;
  });
  return { history, wonAt: finalStage === "won" ? prevDate : null };
}

export interface SeedResult {
  leads: Lead[];
  companyHolidays: CompanyHoliday[];
  repLeaves: RepLeave[];
}

// Deterministic seed (42) so the demo dataset is stable across reloads —
// matches the wireframe's behavior exactly.
export function generateSeed(): SeedResult {
  const rnd = seedRand(42);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];

  let n = 0;
  const leads: Lead[] = [];

  // Location belongs to the company, not the person — every contact at an
  // account shares its city, the way they would in real data.
  const accountCity = new Map<string, string>();
  function cityFor(account: string): string {
    if (!accountCity.has(account)) {
      const locality = account.includes(", ") ? account.split(", ").pop()! : null;
      accountCity.set(
        account,
        MALL_CITY[account] || (locality && LOCALITY_CITY[locality]) || pick(CITIES)
      );
    }
    return accountCity.get(account)!;
  }

  function makeLead(type: AccountType): Lead {
    n++;
    const first = pick(FIRST);
    const last = pick(LAST);
    const name = first + " " + last;
    let account: string, fn: string;
    if (type === "Brand") { account = pick(BRANDS); fn = pick(FN_BRAND); }
    else if (type === "Mall") { account = pick(MALLS); fn = pick(FN_MALL); }
    else { account = pick(STORES); fn = pick(FN_STORE); }

    const stageIdx = n <= 4 ? 0 : Math.floor(rnd() * STAGES.length);
    const finalStage = STAGES[stageIdx].id;
    // A lead can only sit unassigned while it's still New — anything further
    // along the pipeline was necessarily worked by a rep. Managers never own leads.
    const assignee = finalStage === "new" && rnd() < 0.62 ? null : pick(repsList()).id;
    const city = cityFor(account);
    const email = (
      first + "." + last + "@" + account.toLowerCase().replace(/[^a-z]/g, "").slice(0, 10) + ".com"
    ).toLowerCase();
    const phone = "+91 9" + Math.floor(100000000 + rnd() * 899999999).toString().slice(0, 8);
    const emailQuality = rnd() < 0.65 ? "verified" : rnd() < 0.7 ? "catchall" : "none";
    const multiSource = rnd() < 0.3;
    const isOpen = !isClosedStage(finalStage);
    const fuRoll = rnd();
    let nextFollowup: string | null = null;
    if (isOpen && fuRoll < 0.55) {
      const offset = Math.floor(rnd() * 17) - 4; // -4 (overdue) .. +12 (upcoming)
      nextFollowup = isoPlusDays(isoToday(), offset);
    }
    const meetings: Lead["meetings"] = [];
    if (isOpen && rnd() < 0.25) {
      const offset = Math.floor(rnd() * 15) - 3;
      meetings.push({
        id: "MTG" + n,
        date: isoPlusDays(isoToday(), offset),
        time: pick(["10:00 AM", "11:30 AM", "2:00 PM", "3:30 PM", "4:45 PM"]),
        mode: pick(MEETING_MODES),
        notes: pick(MEETING_NOTES),
        status: offset < 0 ? "done" : "scheduled",
      });
    }

    // Spread creation over ~15 months so subscription mandates land across
    // several quarters and the quarterly billing trend has real shape.
    const createdAt = isoPlusDays(isoToday(), -(5 + Math.floor(rnd() * 450)));
    const { history: stageHistory, wonAt } = buildStageHistory(rnd, createdAt, finalStage);

    // Plan and mandate only exist once a deal is won. A few won accounts are
    // deliberately left blank so the "needs revenue details" state is visible.
    let plan: string | null = null;
    let mandateDate: string | null = null;
    if (finalStage === "won" && rnd() < 0.8) {
      const pr = rnd();
      plan = pr < 0.3 ? "starter" : pr < 0.75 ? "growth" : "professional";
      mandateDate = wonAt;
    }

    const histEntries: Lead["activity"] = [];
    if (assignee) {
      const histCount = Math.floor(rnd() * 5);
      const daysSpan = Math.max(
        1,
        Math.floor((new Date(isoToday()).getTime() - new Date(createdAt + "T00:00:00").getTime()) / 86400000)
      );
      for (let i = 0; i < histCount; i++) {
        const date = isoPlusDays(createdAt, 1 + Math.floor(rnd() * daysSpan));
        const r = rnd();
        const method = r < 0.45 ? "Call" : r < 0.7 ? "WhatsApp" : r < 0.9 ? "Email" : "NA";
        histEntries.push({
          who: repById(assignee)!.name,
          txt: pick(NOTES_BY_METHOD[method]),
          t: fmtShortDate(date),
          date,
          method,
        });
      }
      histEntries.sort((a, b) => (a.date < b.date ? 1 : -1));
    }

    const lead: Lead = {
      id: "L" + String(n).padStart(3, "0"),
      name,
      title: fn,
      account,
      type,
      stage: finalStage,
      assignee,
      ownerSince: assignee ? createdAt : null,
      city,
      email,
      phone,
      emailQuality,
      multiSource,
      priorityOverride: null,
      priorityAuto: "Low",
      score: 0,
      scoreReasons: [],
      nextFollowup,
      meetings,
      createdAt,
      plan,
      mandateDate,
      stageHistory,
      wonAt,
      activity: [
        ...histEntries,
        {
          who: "System",
          txt: "Lead imported from ModenX Lead Desk export.",
          t: fmtShortDate(createdAt),
          date: createdAt,
          method: null,
        },
      ],
    };
    const { score, reasons } = scoreLead(lead);
    lead.score = score;
    lead.scoreReasons = reasons;
    lead.priorityAuto = bandForScore(score);
    return lead;
  }

  for (let i = 0; i < 55; i++) leads.push(makeLead("Brand"));
  for (let i = 0; i < 35; i++) leads.push(makeLead("Mall"));
  for (let i = 0; i < 28; i++) leads.push(makeLead("Store"));

  // 1 account = 1 rep. Seed data assigned contacts independently, so some
  // accounts came out multi-threaded — reconcile every account onto whichever
  // rep already covers the most contacts there (ties go to whoever appears
  // first, which is stable given the fixed seed).
  const byAccount = new Map<string, Lead[]>();
  leads.forEach((l) => {
    const group = byAccount.get(l.account) || [];
    group.push(l);
    byAccount.set(l.account, group);
  });
  byAccount.forEach((group) => {
    const counts: Record<string, number> = {};
    group.forEach((l) => {
      if (l.assignee) counts[l.assignee] = (counts[l.assignee] || 0) + 1;
    });
    const repIds = Object.keys(counts);
    if (!repIds.length) return; // whole account is genuinely unassigned — leave it
    let winner = repIds[0];
    repIds.forEach((id) => {
      if (counts[id] > counts[winner]) winner = id;
    });
    const earliestOwnerSince =
      group.map((l) => l.ownerSince).filter(Boolean).sort()[0] ||
      group.map((l) => l.createdAt).sort()[0];
    group.forEach((l) => {
      l.assignee = winner;
      l.ownerSince = earliestOwnerSince;
    });
  });

  // A handful of Indian holidays spanning back through the seeded lead
  // history, so the working-day math visibly differs from calendar days.
  const y = new Date().getFullYear();
  const companyHolidays: CompanyHoliday[] = [
    [`${y - 1}-10-02`, "Gandhi Jayanti"],
    [`${y - 1}-10-24`, "Dussehra"],
    [`${y - 1}-11-12`, "Diwali"],
    [`${y - 1}-12-25`, "Christmas"],
    [`${y}-01-26`, "Republic Day"],
    [`${y}-03-14`, "Holi"],
    [`${y}-08-15`, "Independence Day"],
  ].map(([date, name]) => ({ date, name }));

  const isWeekend = (iso: string) => {
    const dow = new Date(iso + "T00:00:00").getDay();
    return dow === 0 || dow === 6;
  };
  const isCompanyHoliday = (iso: string) => companyHolidays.some((h) => h.date === iso);

  let leaveSeq = 0;
  const repLeaves: RepLeave[] = [];
  repsList().forEach((r) => {
    const leaveCount = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < leaveCount; i++) {
      const date = isoPlusDays(isoToday(), -Math.floor(rnd() * 85));
      if (isWeekend(date) || isCompanyHoliday(date)) continue;
      leaveSeq++;
      repLeaves.push({
        id: "LV" + leaveSeq,
        repId: r.id,
        date,
        reason: pick(["Personal leave", "Sick leave", "Festival leave", "Family function"]),
      });
    }
  });

  return { leads, companyHolidays, repLeaves };
}

export { REPS };
