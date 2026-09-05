import { describe, expect, it } from "vitest";
import { validateAssessmentProposal, type AssessmentProposalInput } from "@/lib/ai/assessment-proposal";
import { sampleConfiguration } from "@/lib/seed";

function proposal(patch: Partial<AssessmentProposalInput["changes"][number]> = {}): AssessmentProposalInput {
  return {
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
    expect(() => validateAssessmentProposal(sampleConfiguration, proposal())).not.toThrow();
  });

  it("rejects unknown scenarios and calculated fields", () => {
    expect(() => validateAssessmentProposal(sampleConfiguration, proposal({ scenarioId: "unknown" }))).toThrow("unknown risk scenario");
    expect(() => validateAssessmentProposal(sampleConfiguration, proposal({
      values: [{ fieldId: "residual-risk", value: "low" }],
    }))).toThrow("unknown or calculated assessment field");
  });

  it("requires configured option IDs rather than labels", () => {
    expect(() => validateAssessmentProposal(sampleConfiguration, proposal({
      values: [{ fieldId: "likelihood", value: "Rare" }],
    }))).toThrow("invalid option for Likelihood");
  });
});
