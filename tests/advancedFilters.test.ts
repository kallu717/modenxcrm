import { describe, expect, it } from "vitest";
import {
  applyFieldCriteria,
  buildFilterFields,
  fieldsByKeyMap,
  parseFieldCriteria,
  type FieldCriterion,
} from "../lib/advancedFilters";
import { STAGES, assignableList } from "../lib/constants";
import { makeLead } from "./helpers";

// "Filter leads by" (NAME-of-the-feature: FIELDFILTER): any field, any of its
// operators, several stacked together — every lead must match all of them.

const fields = buildFilterFields(STAGES, assignableList());
const byKey = fieldsByKeyMap(fields);
const apply = (leads: ReturnType<typeof makeLead>[], criteria: FieldCriterion[]) =>
  applyFieldCriteria(leads, criteria, byKey);

describe("FIELDFILTER. Filter leads by field", () => {
  it("FF1 no criteria returns every lead unchanged", () => {
    const leads = [makeLead(), makeLead()];
    expect(apply(leads, [])).toEqual(leads);
  });

  it("FF2 text: is / is not / contains / doesn't contain / starts / ends", () => {
    const a = makeLead({ name: "Ananya Sharma" });
    const b = makeLead({ name: "Rohan Rao" });
    const leads = [a, b];
    expect(apply(leads, [{ field: "name", operator: "is", value: "Ananya Sharma" }])).toEqual([a]);
    expect(apply(leads, [{ field: "name", operator: "isNot", value: "Ananya Sharma" }])).toEqual([b]);
    expect(apply(leads, [{ field: "name", operator: "contains", value: "sharma" }])).toEqual([a]);
    expect(apply(leads, [{ field: "name", operator: "notContains", value: "sharma" }])).toEqual([b]);
    expect(apply(leads, [{ field: "name", operator: "startsWith", value: "roh" }])).toEqual([b]);
    expect(apply(leads, [{ field: "name", operator: "endsWith", value: "rao" }])).toEqual([b]);
  });

  it("FF3 text: is empty / is not empty", () => {
    const withPhone = makeLead({ phone: "9876543210" });
    const noPhone = makeLead({ phone: "" });
    const leads = [withPhone, noPhone];
    expect(apply(leads, [{ field: "phone", operator: "isEmpty", value: "" }])).toEqual([noPhone]);
    expect(apply(leads, [{ field: "phone", operator: "isNotEmpty", value: "" }])).toEqual([withPhone]);
  });

  it("FF4 select: account type is / is not", () => {
    const brand = makeLead({ type: "Brand" });
    const mall = makeLead({ type: "Mall" });
    const leads = [brand, mall];
    expect(apply(leads, [{ field: "type", operator: "is", value: "Mall" }])).toEqual([mall]);
    expect(apply(leads, [{ field: "type", operator: "isNot", value: "Mall" }])).toEqual([brand]);
  });

  it("FF5 select: priority looks at the override first, same as everywhere else", () => {
    const hot = makeLead({ priorityAuto: "Warm", priorityOverride: "Hot" });
    const warm = makeLead({ priorityAuto: "Warm", priorityOverride: null });
    const leads = [hot, warm];
    expect(apply(leads, [{ field: "priority", operator: "is", value: "Hot" }])).toEqual([hot]);
  });

  it("FF6 number: =, ≠, >, <, between", () => {
    const low = makeLead({ score: 10 });
    const mid = makeLead({ score: 50 });
    const high = makeLead({ score: 90 });
    const leads = [low, mid, high];
    expect(apply(leads, [{ field: "score", operator: "eq", value: "50" }])).toEqual([mid]);
    expect(apply(leads, [{ field: "score", operator: "neq", value: "50" }])).toEqual([low, high]);
    expect(apply(leads, [{ field: "score", operator: "gt", value: "50" }])).toEqual([high]);
    expect(apply(leads, [{ field: "score", operator: "lt", value: "50" }])).toEqual([low]);
    expect(apply(leads, [{ field: "score", operator: "between", value: "20", value2: "80" }])).toEqual([mid]);
  });

  it("FF7 date: on / before / after / between, and reversed between bounds still work", () => {
    const early = makeLead({ createdAt: "2026-01-10" });
    const mid = makeLead({ createdAt: "2026-06-01" });
    const late = makeLead({ createdAt: "2026-11-20" });
    const leads = [early, mid, late];
    expect(apply(leads, [{ field: "createdAt", operator: "on", value: "2026-06-01" }])).toEqual([mid]);
    expect(apply(leads, [{ field: "createdAt", operator: "before", value: "2026-06-01" }])).toEqual([early]);
    expect(apply(leads, [{ field: "createdAt", operator: "after", value: "2026-06-01" }])).toEqual([late]);
    expect(apply(leads, [{ field: "createdAt", operator: "between", value: "2026-02-01", value2: "2026-09-01" }])).toEqual([mid]);
    // bounds given the other way round still work
    expect(apply(leads, [{ field: "createdAt", operator: "between", value: "2026-09-01", value2: "2026-02-01" }])).toEqual([mid]);
  });

  it("FF8 date: is empty / is not empty", () => {
    const due = makeLead({ nextFollowup: "2026-12-01" });
    const none = makeLead({ nextFollowup: null });
    const leads = [due, none];
    expect(apply(leads, [{ field: "nextFollowup", operator: "isEmpty", value: "" }])).toEqual([none]);
    expect(apply(leads, [{ field: "nextFollowup", operator: "isNotEmpty", value: "" }])).toEqual([due]);
  });

  it("FF9 boolean: multiple sources is Yes / No", () => {
    const multi = makeLead({ multiSource: true });
    const single = makeLead({ multiSource: false });
    const leads = [multi, single];
    expect(apply(leads, [{ field: "multiSource", operator: "is", value: "true" }])).toEqual([multi]);
    expect(apply(leads, [{ field: "multiSource", operator: "is", value: "false" }])).toEqual([single]);
  });

  it("FF10 owner: unassigned is its own choice, separate from a real rep", () => {
    const mine = makeLead({ assignee: "priya" });
    const unassigned = makeLead({ assignee: null });
    const leads = [mine, unassigned];
    expect(apply(leads, [{ field: "assignee", operator: "is", value: "__unassigned" }])).toEqual([unassigned]);
    expect(apply(leads, [{ field: "assignee", operator: "is", value: "priya" }])).toEqual([mine]);
  });

  it("FF11 several fields stack — every one must match (an AND)", () => {
    const match = makeLead({ type: "Brand", city: "Mumbai", score: 60 });
    const wrongCity = makeLead({ type: "Brand", city: "Pune", score: 60 });
    const wrongScore = makeLead({ type: "Brand", city: "Mumbai", score: 5 });
    const leads = [match, wrongCity, wrongScore];
    const criteria: FieldCriterion[] = [
      { field: "type", operator: "is", value: "Brand" },
      { field: "city", operator: "is", value: "Mumbai" },
      { field: "score", operator: "gt", value: "50" },
    ];
    expect(apply(leads, criteria)).toEqual([match]);
  });

  it("FF12 a checked field with nothing useful entered yet is ignored, not treated as 'match nothing'", () => {
    const leads = [makeLead(), makeLead()];
    expect(apply(leads, [{ field: "name", operator: "contains", value: "" }])).toEqual(leads);
    expect(apply(leads, [{ field: "score", operator: "between", value: "10", value2: "" }])).toEqual(leads);
  });

  it("FF13 manager-only fields (Owner) are left out for a rep's own list", () => {
    const repFields = buildFilterFields(STAGES, assignableList()).filter((f) => !f.managerOnly);
    expect(repFields.some((f) => f.key === "assignee")).toBe(false);
    expect(fields.some((f) => f.key === "assignee")).toBe(true);
  });

  it("FF14 parseFieldCriteria drops anything malformed instead of breaking the page", () => {
    expect(parseFieldCriteria(null)).toBeUndefined();
    expect(parseFieldCriteria("nope")).toBeUndefined();
    const ok = parseFieldCriteria([
      { field: "score", operator: "gt", value: "10" },
      { nonsense: true },
      { field: "score" }, // missing operator/value
    ]);
    expect(ok).toEqual([{ field: "score", operator: "gt", value: "10" }]);
  });
});
