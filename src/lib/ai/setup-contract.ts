import { z } from "zod";
import { onboardingStageSchema, workspaceConfigurationSchema } from "@/lib/ai/schema";

export const setupToolNames = [
  "proposeOrganization",
  "configureAssessmentOwner",
  "upsertRiskScenarios",
  "configureAssessmentMethod",
] as const;

export type SetupToolName = (typeof setupToolNames)[number];
export type SetupStage = z.infer<typeof onboardingStageSchema>;

export const setupStageToolName: Record<SetupStage, SetupToolName> = {
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

export const setupAgentToolResultSchema = z.object({
  stage: onboardingStageSchema,
  configuration: workspaceConfigurationSchema,
  warnings: z.array(z.string()),
  sources: z.array(sourceDocumentSchema),
});

export type SetupAgentToolResult = z.infer<typeof setupAgentToolResultSchema>;

export function isSetupToolPart(part: { type: string }) {
  return setupToolNames.some((name) => part.type === `tool-${name}`);
}
