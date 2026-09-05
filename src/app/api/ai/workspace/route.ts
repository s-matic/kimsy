import { assessmentAgentMessages, createAssessmentAgent } from "@/lib/ai/agents/assessment-agent";
import { AiNotConfiguredError } from "@/lib/ai";
import { workspaceConfigurationSchema } from "@/lib/ai/schema";
import { prepareAiInput } from "@/lib/ai/source-input";
import type { Assessment } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const message = String(formData.get("message") ?? "");
    const configuration = workspaceConfigurationSchema.parse(JSON.parse(String(formData.get("configuration") ?? "{}")));
    const assessment = JSON.parse(String(formData.get("assessment") ?? "{}")) as Assessment;
    if (!assessment.id || !assessment.unitId || !Array.isArray(assessment.rows)) {
      throw new Error("A valid assessment is required.");
    }
    if (!message.trim() && !formData.getAll("files").length) throw new Error("Add a message or at least one source file.");

    const prepared = await prepareAiInput(formData);
    const agent = createAssessmentAgent({ configuration, assessment, sources: prepared.sources });
    const result = await agent.stream({
      messages: assessmentAgentMessages({
        message,
        configuration,
        assessment,
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
