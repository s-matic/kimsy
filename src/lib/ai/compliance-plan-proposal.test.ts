import { describe, expect, it } from "vitest";
import { validateCompliancePlanChanges } from "@/lib/ai/compliance-plan-proposal";
import type { CompliancePlan, CompliancePlanChange } from "@/lib/types";

const plan = {
  id: "plan",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  unitIds: ["unit-a", "unit-b"],
  sources: [{ unitId: "unit-a", risks: [{ scenarioId: "risk-a" }] }, { unitId: "unit-b", risks: [{ scenarioId: "risk-b" }] }],
  activities: [{ id: "activity-a", unitId: "unit-a" }, { id: "activity-b", unitId: "unit-b" }],
} as CompliancePlan;

function change(patch: Partial<CompliancePlanChange> = {}): CompliancePlanChange {
  return { operation: "ADD", activityId: "", type: "MONITORING", title: "Test controls", objective: "Establish whether controls operate effectively.", owner: "Compliance owner", priority: "HIGH", inclusionRationale: "Residual risk remains high.", sourceScenarioIds: ["risk-a"], cadence: "QUARTERLY", startDate: "2026-03-31", endDate: "2026-12-31", ...patch };
}

describe("compliance plan proposal guardrails", () => {
  it("accepts supported changes for the selected unit", () => {
    expect(() => validateCompliancePlanChanges(plan, "unit-a", [change()])).not.toThrow();
  });

  it("rejects cross-unit activities and source scenarios", () => {
    expect(() => validateCompliancePlanChanges(plan, "unit-a", [change({ operation: "UPDATE", activityId: "activity-b" })])).toThrow("outside the selected unit");
    expect(() => validateCompliancePlanChanges(plan, "unit-a", [change({ sourceScenarioIds: ["risk-b"] })])).toThrow("unknown assessment scenario");
  });

  it("rejects schedules outside the plan period", () => {
    expect(() => validateCompliancePlanChanges(plan, "unit-a", [change({ endDate: "2027-03-31" })])).toThrow("outside the compliance plan period");
  });
});
