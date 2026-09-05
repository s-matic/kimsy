import { z } from "zod";
import {
  fieldDefinitionSchema,
  matrixCalculationSchema,
  organizationUnitSchema,
  riskScenarioSchema,
  thresholdCalculationSchema,
} from "@/lib/ai/schema";

const warningsSchema = z.array(z.string()).describe("Only concrete ambiguities or missing details the user should resolve.");

export const setupToolInputSchemas = {
  proposeOrganization: z.object({
    assistantMessage: z.string().describe("A concise message explaining the proposed organization and asking the user to review the inline draft."),
    organizationName: z.string().describe("The organization's name, preserving the current value when no change was requested."),
    units: z.array(organizationUnitSchema).describe("The complete proposed organizational hierarchy for this workspace."),
    warnings: warningsSchema,
  }),
  configureAssessmentOwner: z.object({
    assistantMessage: z.string().describe("A concise message explaining the proposed ownership and asking the user to review the inline draft."),
    assessorName: z.string().describe("The one person or role responsible for completing assessments."),
    warnings: warningsSchema,
  }),
  upsertRiskScenarios: z.object({
    assistantMessage: z.string().describe("A concise message explaining the proposed scenario library and asking the user to review the inline draft."),
    scenarios: z.array(riskScenarioSchema).describe("The complete proposed risk scenario library, including unchanged existing scenarios."),
    warnings: warningsSchema,
  }),
  configureAssessmentMethod: z.object({
    assistantMessage: z.string().describe("A concise message explaining the proposed assessment method and asking the user to review the inline draft."),
    fields: z.array(fieldDefinitionSchema).describe("The complete proposed assessment field list, including calculated fields."),
    matrixCalculations: z.array(matrixCalculationSchema).describe("All matrix calculations for calculated ratings."),
    thresholdCalculations: z.array(thresholdCalculationSchema).describe("All weighted threshold calculations for calculated ratings."),
    finalRatingFieldId: z.string().describe("The ID of the field used as the assessment's final rating."),
    warnings: warningsSchema,
  }),
};
