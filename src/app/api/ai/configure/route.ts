import { createSetupAgent, setupAgentMessages } from "@/lib/ai/agents/setup-agent";
import { AiNotConfiguredError } from "@/lib/ai";
import { onboardingStageSchema, workspaceConfigurationSchema } from "@/lib/ai/schema";
import { prepareAiInput } from "@/lib/ai/source-input";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const stage = onboardingStageSchema.parse(formData.get("stage"));
    const message = String(formData.get("message") ?? "");
    const conversation = String(formData.get("conversation") ?? "");
    const configuration = workspaceConfigurationSchema.parse(JSON.parse(String(formData.get("configuration") ?? "{}")));
    const prepared = await prepareAiInput(formData);
    const agent = createSetupAgent({ stage, configuration, sources: prepared.sources });
    const result = await agent.stream({
      messages: setupAgentMessages({
        stage,
        message,
        conversation,
        configuration,
        sourceInput: prepared.input,
        sources: prepared.sources,
      }),
      abortSignal: request.signal,
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => error instanceof Error ? error.message : "Kimsy could not configure the workspace.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to configure the workspace.";
    const status = error instanceof AiNotConfiguredError ? 503 : 422;
    return Response.json({
      error: message,
      code: error instanceof AiNotConfiguredError ? "AI_NOT_CONFIGURED" : "INVALID_REQUEST",
    }, { status });
  }
}
