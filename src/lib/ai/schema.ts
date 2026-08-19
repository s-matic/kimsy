import { z } from "zod";

export const fieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

export const sourceCitationSchema = z.object({
  sourceName: z.string(),
  locator: z.string(),
});

export const organizationUnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  description: z.string(),
});

export const riskScenarioSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  category: z.string(),
  description: z.string(),
  sourceCitations: z.array(sourceCitationSchema),
});

export const selectOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  score: z.number(),
});

export const fieldDefinitionSchema = z.object({
  id: z.string(),
  label: z.string(),
  helpText: z.string(),
  type: z.enum(["SHORT_TEXT", "LONG_TEXT", "NUMBER", "BOOLEAN", "SINGLE_SELECT", "MULTI_SELECT", "CALCULATED"]),
  required: z.boolean(),
  options: z.array(selectOptionSchema),
});

export const matrixCalculationSchema = z.object({
  id: z.string(),
  type: z.literal("MATRIX"),
  outputFieldId: z.string(),
  rowFieldId: z.string(),
  columnFieldId: z.string(),
  cells: z.array(z.object({
    rowValue: z.string(),
    columnValue: z.string(),
    result: fieldValueSchema,
  })),
});

export const thresholdCalculationSchema = z.object({
  id: z.string(),
  type: z.literal("THRESHOLD"),
  outputFieldId: z.string(),
  terms: z.array(z.object({ fieldId: z.string(), weight: z.number() })),
  bands: z.array(z.object({ min: z.number(), max: z.number(), result: fieldValueSchema })),
});

export const workspaceConfigurationSchema = z.object({
  organizationName: z.string(),
  units: z.array(organizationUnitSchema),
  review: z.object({
    mode: z.enum(["SOLO", "REVIEWER"]),
    assessorName: z.string(),
    reviewerName: z.string(),
  }),
  scenarios: z.array(riskScenarioSchema),
  fields: z.array(fieldDefinitionSchema),
  calculations: z.array(z.discriminatedUnion("type", [matrixCalculationSchema, thresholdCalculationSchema])),
  finalRatingFieldId: z.string(),
});

export const onboardingStageSchema = z.enum(["ORGANIZATION", "WORKFLOW", "SCENARIOS", "DESIGN"]);

export const onboardingAiOutputSchema = z.object({
  assistantMessage: z.string(),
  configuration: workspaceConfigurationSchema,
  warnings: z.array(z.string()),
});

export const assessmentRowInputSchema = z.object({
  scenarioId: z.string(),
  applicable: z.boolean(),
  values: z.array(z.object({ fieldId: z.string(), value: fieldValueSchema })),
  rationale: z.string(),
  citations: z.array(sourceCitationSchema),
});

export const assessmentAiOutputSchema = z.object({
  assistantMessage: z.string(),
  summary: z.string(),
  changes: z.array(assessmentRowInputSchema),
  warnings: z.array(z.string()),
});

export type OnboardingAiOutput = z.infer<typeof onboardingAiOutputSchema>;
export type AssessmentAiOutput = z.infer<typeof assessmentAiOutputSchema>;
