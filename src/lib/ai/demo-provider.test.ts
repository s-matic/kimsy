import { describe, expect, it } from "vitest";
import { DemoAiProvider } from "@/lib/ai/demo-provider";
import { seedScenarios } from "@/lib/seed";

describe("DemoAiProvider", () => {
  it("returns proposals only for scenario ids in the supplied framework", async () => {
    const scenarios = seedScenarios.slice(0, 2);
    const result = await new DemoAiProvider().buildAssessment({
      assessmentId: "test-assessment",
      questions: [
        {
          id: "q1",
          section: "Controls",
          prompt: "What is causing concern?",
          answer: "An overdue backlog and manual review process are below threshold.",
        },
      ],
      scenarios,
    });

    expect(result.metadata.fallback).toBe(true);
    expect(result.draft.proposals.map((proposal) => proposal.scenarioId)).toEqual(
      scenarios.map((scenario) => scenario.id),
    );
    expect(result.draft.proposals[0].proposedRating).toBe("High");
  });
});
