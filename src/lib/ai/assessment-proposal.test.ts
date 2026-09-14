import { describe, expect, it } from "vitest";
import { validateAssessmentProposal, type AssessmentProposalInput } from "@/lib/ai/assessment-proposal";
import { sampleConfiguration } from "@/lib/seed";

function proposal(patch: Partial<AssessmentProposalInput["changes"][number]> = {}): AssessmentProposalInput {
  return {
    assistantMessage: "I prepared one change for review.",
    summary: "Supported update",
    changes: [{
      scenarioId: "scenario-cdd",
      applicable: true,
      values: [{ fieldId: "likelihood", value: "rare" }],
      rationale: "Supported by evidence.",
      citations: [],
      ...patch,
    }],
    warnings: [],
  };
}

describe("assessment proposal guardrails", () => {
  it("accepts known scenarios, editable fields, and option IDs", () => {
    expect(() => validateAssessmentProposal(sampleConfiguration, "scenario-cdd", proposal())).not.toThrow();
  });

  it("rejects changes outside the open scenario and calculated fields", () => {
    expect(() => validateAssessmentProposal(sampleConfiguration, "scenario-cdd", proposal({ scenarioId: "scenario-monitoring" }))).toThrow("outside the open risk scenario");
    expect(() => validateAssessmentProposal(sampleConfiguration, "scenario-cdd", proposal({
      values: [{ fieldId: "residual-risk", value: "low" }],
    }))).toThrow("unknown or calculated assessment field");
  });

  it("requires configured option IDs rather than labels", () => {
    expect(() => validateAssessmentProposal(sampleConfiguration, "scenario-cdd", proposal({
      values: [{ fieldId: "likelihood", value: "Rare" }],
    }))).toThrow("invalid option for Likelihood");
  });

  it("rejects multiple changes even when they target the open scenario", () => {
    const input = proposal();
    input.changes.push({ ...input.changes[0] });
    expect(() => validateAssessmentProposal(sampleConfiguration, "scenario-cdd", input)).toThrow("more than one change");
  });
});
