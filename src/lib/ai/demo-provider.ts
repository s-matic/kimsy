import type { AiProvider } from "@/lib/ai/provider";
import type { AssessmentRequest } from "@/lib/ai/schema";

export class DemoAiProvider implements AiProvider {
  async buildAssessment(input: AssessmentRequest) {
    const facts = input.questions.map((question) => question.answer.toLowerCase()).join(" ");
    const proposals = input.scenarios.map((scenario) => {
      const financialCrime = scenario.category === "Financial crime";
      const controlConcern = /backlog|below|manual|overdue|left/.test(facts);
      const relevant =
        financialCrime ||
        scenario.category === "Customer conduct" ||
        scenario.category === "Regulatory obligations";
      const proposedRating = !relevant
        ? ("Low" as const)
        : financialCrime && controlConcern
          ? ("High" as const)
          : ("Moderate" as const);
      return {
        scenarioId: scenario.id,
        relevant,
        proposedRating,
        rationale: relevant
          ? `The submitted facts indicate exposure to ${scenario.title.toLowerCase()}. The proposal reflects the described business activity and current control performance.`
          : `The submitted business activities do not indicate that ${scenario.title.toLowerCase()} is applicable.`,
        confidence: financialCrime ? 88 : relevant ? 72 : 91,
        controlEffectiveness: controlConcern && financialCrime
          ? ("Partially effective" as const)
          : ("Effective" as const),
        evidenceGaps: relevant ? scenario.evidenceRequired.slice(0, 1) : [],
        citations: [scenario.sourceCitation, "Submitted business facts"],
      };
    });
    return {
      draft: {
        proposals,
        managementSummary:
          "The principal exposure arises from customer and transaction activity combined with current control performance. Human review is required before any proposal becomes effective.",
        materialChanges: ["Customer profile or operating model changed since the prior review."],
        limitations: ["Generated in demo mode without an external model call."],
      },
      metadata: {
        provider: "demo",
        model: "deterministic-rules-v1",
        promptVersion: "assessment-v1",
        generatedAt: new Date().toISOString(),
        fallback: true,
      },
    };
  }
}
