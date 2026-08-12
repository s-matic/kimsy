import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { assessmentDraftSchema, type AssessmentRequest } from "@/lib/ai/schema";
import type { AiProvider } from "@/lib/ai/provider";

const PROMPT_VERSION = "assessment-v1";

export class OpenAiProvider implements AiProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = process.env.OPENAI_MODEL ?? "gpt-5.4-nano") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async buildAssessment(input: AssessmentRequest) {
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: [
        "You are assisting with a regulated firm's compliance risk assessment.",
        "Use only the supplied customer risk scenarios and submitted business facts.",
        "Never invent, rename, merge, or add risk scenarios.",
        "Treat every output as a draft proposal requiring human acceptance.",
        "Cite the supplied sourceCitation and the relevant fact section for each conclusion.",
        "When facts are insufficient, lower confidence and state the limitation rather than guessing.",
      ].join(" "),
      input: JSON.stringify(input),
      text: { format: zodTextFormat(assessmentDraftSchema, "compliance_assessment_draft") },
    });

    if (!response.output_parsed) {
      throw new Error("The model did not return a valid structured assessment draft.");
    }

    const allowedScenarioIds = new Set(input.scenarios.map((scenario) => scenario.id));
    if (response.output_parsed.proposals.some((proposal) => !allowedScenarioIds.has(proposal.scenarioId))) {
      throw new Error("The model returned a scenario outside the published customer framework.");
    }

    return {
      draft: response.output_parsed,
      metadata: {
        provider: "openai",
        model: this.model,
        promptVersion: PROMPT_VERSION,
        generatedAt: new Date().toISOString(),
        fallback: false,
      },
    };
  }
}
