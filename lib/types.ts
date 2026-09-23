export type Role = "Rep" | "Manager";

export interface Rep {
  id: string;
  name: string;
  role: Role;
  color: string;
}

export type AccountType = "Brand" | "Mall" | "Store";

export interface StageDef {
  id: Stage;
  name: string;
  dot: string;
}

export interface Meeting {
  id: string;
  date: string;
  time: string;
  mode: string;
  notes: string;
  status: "done" | "scheduled" | "cancelled";
}

export type EmailQuality = "verified" | "catchall" | "none";
export type Priority = "Hot" | "Warm" | "Nurture" | "Low";
export type Stage =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "won"
  | "lost"
  | "unqualified";

export interface StageHistoryEntry {
  stage: Stage;
  date: string; // ISO date
}

export interface ActivityEntry {
  who: string;
  txt: string;
  t: string;
  date: string; // ISO date
  method: string | null;
}

export interface Lead {
  id: string;
  name: string;
  account: string;
  type: AccountType;
  city: string;
  title: string;
  email: string;
  phone: string;
  emailQuality: EmailQuality;
  multiSource: boolean;
  priorityAuto: Priority;
  priorityOverride: Priority | null;
  score: number;
  scoreReasons: string[];
  stage: Stage;
  stageHistory: StageHistoryEntry[];
  wonAt: string | null;
  assignee: string | null; // rep id
  ownerSince: string | null; // ISO date
  plan: string | null; // plan id
  mandateDate: string | null; // ISO date
  createdAt: string; // ISO date
  nextFollowup: string | null;
  meetings: Meeting[];
  activity: ActivityEntry[];
}

export interface Plan {
  id: string;
  name: string;
  mrr: number;
}

export interface CompanyHoliday {
  date: string;
  name: string;
}

export interface RepLeave {
  id: string;
  repId: string;
  date: string;
  reason: string;
}

export type LeaveRequestStatus = "pending" | "approved" | "rejected";

export interface LeaveRequest {
  id: string;
  repId: string;
  date: string;
  reason: string;
  status: LeaveRequestStatus;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface RangePreset {
  id: string;
  label: string;
  days: number | null;
}

export interface DateRange {
  from: string | null;
  to: string;
  days: number | null;
}

export interface WorkingRange {
  from: string | null;
  to: string;
  workingDays: number | null;
}
