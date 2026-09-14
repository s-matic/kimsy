import { assessmentAgentMessages, createAssessmentAgent } from "@/lib/ai/agents/assessment-agent";
import { AiNotConfiguredError } from "@/lib/ai";
import { workspaceConfigurationSchema } from "@/lib/ai/schema";
import { prepareAiInput } from "@/lib/ai/source-input";
import type { ScenarioAssessmentContext } from "@/lib/ai/agents/assessment-agent";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const message = String(formData.get("message") ?? "");
    const scenarioId = String(formData.get("scenarioId") ?? "");
    const configuration = workspaceConfigurationSchema.parse(JSON.parse(String(formData.get("configuration") ?? "{}")));
    const assessment = JSON.parse(String(formData.get("assessment") ?? "{}")) as ScenarioAssessmentContext;
    if (!assessment.id || !assessment.unitId || !assessment.row || !assessment.thread || assessment.row.scenarioId !== scenarioId || assessment.thread.scenarioId !== scenarioId) {
      throw new Error("A valid scenario-scoped assessment is required.");
    }
    if (!configuration.scenarios.some((scenario) => scenario.id === scenarioId)) throw new Error("The open risk scenario is not configured.");
    if (!message.trim() && !formData.getAll("files").length) throw new Error("Add a message or at least one source file.");

    const prepared = await prepareAiInput(formData);
    const agent = createAssessmentAgent({ configuration, assessment, scenarioId, sources: prepared.sources });
    const result = await agent.stream({
      messages: assessmentAgentMessages({
        message,
        configuration,
        assessment,
        scenarioId,
        sourceInput: prepared.input,
        sources: prepared.sources,
      }),
      abortSignal: request.signal,
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => error instanceof Error ? error.message : "Kimsy could not assess the supplied material.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to assess the supplied material.";
    const status = error instanceof AiNotConfiguredError ? 503 : 422;
    return Response.json({
      error: message,
      code: error instanceof AiNotConfiguredError ? "AI_NOT_CONFIGURED" : "INVALID_REQUEST",
    }, { status });
  }
}
