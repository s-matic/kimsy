import { describe, expect, it } from "vitest";
import { generateOccurrences, latestFinalizedAssessments, planActivationErrors, snapshotAssessment } from "@/lib/compliance-plan";
import { sampleConfiguration, sampleState } from "@/lib/seed";
import type { Assessment, CompliancePlan } from "@/lib/types";

describe("compliance planning", () => {
  it("suggests only the newest finalized assessment for each unit", () => {
    const base = sampleState.assessments[0];
    const assessments: Assessment[] = [
      { ...base, id: "new-retail", status: "COMPLETED", unitId: "unit-retail" },
      { ...base, id: "draft-wealth", status: "DRAFT", unitId: "unit-wealth" },
      { ...base, id: "old-retail", status: "APPROVED", unitId: "unit-retail" },
      { ...base, id: "approved-wealth", status: "APPROVED", unitId: "unit-wealth" },
    ];
    expect(latestFinalizedAssessments(assessments).map((item) => item.id)).toEqual(["new-retail", "approved-wealth"]);
  });

  it("snapshots applicable risks and their display rating", () => {
    const assessment = { ...sampleState.assessments[0], status: "COMPLETED" as const };
    const source = snapshotAssessment(assessment, sampleConfiguration);
    expect(source.risks[0]).toMatchObject({ assessmentId: assessment.id, code: "AML-01", finalRating: "high", finalRatingLabel: "High" });
  });

  it("generates stable monthly occurrences across a fiscal year and short months", () => {
    const occurrences = generateOccurrences("activity", { cadence: "MONTHLY", startDate: "2026-01-31", endDate: "2026-04-30" }, "2026-01-01", "2026-12-31");
    expect(occurrences.map((item) => item.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("generates exactly one occurrence for a one-off activity", () => {
    const occurrences = generateOccurrences("activity", { cadence: "ONCE", startDate: "2026-05-20", endDate: "2026-05-20" }, "2026-01-01", "2026-12-31");
    expect(occurrences.map((item) => item.dueDate)).toEqual(["2026-05-20"]);
  });

  it("preserves tracked occurrences when a schedule is regenerated", () => {
    const first = generateOccurrences("activity", { cadence: "QUARTERLY", startDate: "2026-07-15", endDate: "2027-06-30" }, "2026-07-01", "2027-06-30");
    first[0] = { ...first[0], status: "COMPLETED", outcome: "Testing completed." };
    const next = generateOccurrences("activity", { cadence: "QUARTERLY", startDate: "2026-07-15", endDate: "2027-06-30" }, "2026-07-01", "2027-06-30", first);
    expect(next[0]).toMatchObject({ dueDate: "2026-07-15", status: "COMPLETED", outcome: "Testing completed." });
    expect(next).toHaveLength(4);
  });

  it("requires complete activities before activation", () => {
    const plan = { activities: [] } as unknown as CompliancePlan;
    expect(planActivationErrors(plan)).toContain("Add at least one compliance activity.");
    plan.activities = [{ title: "Review policy", owner: "", occurrences: [] }] as never;
    expect(planActivationErrors(plan)).toEqual(expect.arrayContaining(["Review policy needs an owner.", "Review policy needs a date inside the plan period."]));
  });
});
