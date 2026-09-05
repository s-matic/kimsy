import { z } from "zod";
import { onboardingStageSchema, workspaceConfigurationSchema } from "@/lib/ai/schema";

export const setupToolNames = [
  "askClarification",
  "proposeOrganization",
  "configureAssessmentOwner",
  "upsertRiskScenarios",
  "configureAssessmentMethod",
] as const;

export type SetupToolName = (typeof setupToolNames)[number];
export type SetupMutationToolName = Exclude<SetupToolName, "askClarification">;
export type SetupStage = z.infer<typeof onboardingStageSchema>;

export const setupStageToolName: Record<SetupStage, SetupMutationToolName> = {
  ORGANIZATION: "proposeOrganization",
  WORKFLOW: "configureAssessmentOwner",
  SCENARIOS: "upsertRiskScenarios",
  DESIGN: "configureAssessmentMethod",
};

export const sourceDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mediaType: z.string(),
  size: z.number(),
  locators: z.array(z.string()),
  addedAt: z.string(),
});

export const setupClarificationSchema = z.object({
  stage: onboardingStageSchema,
  assistantMessage: z.string(),
  missingInformation: z.array(z.string()),
});

export const setupAgentToolResultSchema = z.object({
  stage: onboardingStageSchema,
  assistantMessage: z.string(),
  configuration: workspaceConfigurationSchema,
  warnings: z.array(z.string()),
  sources: z.array(sourceDocumentSchema),
});

export type SetupAgentToolResult = z.infer<typeof setupAgentToolResultSchema>;
export type SetupClarification = z.infer<typeof setupClarificationSchema>;

export function isSetupToolPart(part: { type: string }) {
  return setupToolNames.some((name) => part.type === `tool-${name}`);
}
