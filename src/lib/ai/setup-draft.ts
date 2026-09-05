import { workspaceConfigurationSchema } from "@/lib/ai/schema";
import type { SetupAgentToolResult, SetupStage } from "@/lib/ai/setup-contract";
import { validateConfiguration } from "@/lib/scoring";
import type { SourceDocument, WorkspaceConfiguration } from "@/lib/types";

interface SetupDraftContext {
  stage: SetupStage;
  configuration: WorkspaceConfiguration;
  sources: SourceDocument[];
}

function stageWarnings(stage: SetupStage, configuration: WorkspaceConfiguration) {
  return validateConfiguration(configuration).filter((warning) => {
    if (stage === "ORGANIZATION") return /organization|unit|hierarchy|parent/i.test(warning);
    if (stage === "WORKFLOW") return /owner|reviewer|assessor/i.test(warning);
    if (stage === "SCENARIOS") return /scenario/i.test(warning);
    return !/organization|unit|hierarchy|parent|scenario/i.test(warning);
  });
}

export function createSetupDraftResult(
  context: SetupDraftContext,
  patch: Partial<WorkspaceConfiguration>,
  assistantMessage: string,
  warnings: string[],
): SetupAgentToolResult {
  const configuration = workspaceConfigurationSchema.parse({
    ...context.configuration,
    ...patch,
    review: {
      ...(patch.review ?? context.configuration.review),
      mode: "SOLO",
      reviewerName: "",
    },
  });
  return {
    stage: context.stage,
    assistantMessage,
    configuration,
    warnings: [...new Set([...warnings, ...stageWarnings(context.stage, configuration)])],
    sources: context.sources,
  };
}
