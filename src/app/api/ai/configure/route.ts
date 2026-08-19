import { AiNotConfiguredError, getWorkspaceAiProvider } from "@/lib/ai";
import { onboardingStageSchema, workspaceConfigurationSchema } from "@/lib/ai/schema";
import { prepareAiInput } from "@/lib/ai/source-input";
import { validateConfiguration } from "@/lib/scoring";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const stage = onboardingStageSchema.parse(formData.get("stage"));
    const message = String(formData.get("message") ?? "");
    const configuration = workspaceConfigurationSchema.parse(JSON.parse(String(formData.get("configuration") ?? "{}")));
    const prepared = await prepareAiInput(formData);
    const result = await getWorkspaceAiProvider().configure({ stage, message, configuration, sources: prepared.input });
    const semanticWarnings = validateConfiguration(result.configuration);
    return Response.json({
      ...result,
      warnings: [...new Set([...result.warnings, ...semanticWarnings])],
      sources: prepared.sources,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to configure the workspace.";
    const status = error instanceof AiNotConfiguredError ? 503 : 422;
    return Response.json({ error: message, code: error instanceof AiNotConfiguredError ? "AI_NOT_CONFIGURED" : "INVALID_REQUEST" }, { status });
  }
}
