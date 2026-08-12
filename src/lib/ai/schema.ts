import { z } from "zod";

export const scenarioProposalSchema = z.object({
  scenarioId: z.string(),
  relevant: z.boolean(),
  proposedRating: z.enum(["Low", "Moderate", "High", "Severe"]),
  rationale: z.string(),
  confidence: z.number().min(0).max(100),
  controlEffectiveness: z.enum(["Effective", "Partially effective", "Ineffective"]),
  evidenceGaps: z.array(z.string()),
  citations: z.array(z.string()),
});

export const assessmentDraftSchema = z.object({
  proposals: z.array(scenarioProposalSchema),
  managementSummary: z.string(),
  materialChanges: z.array(z.string()),
  limitations: z.array(z.string()),
});

export type AssessmentDraft = z.infer<typeof assessmentDraftSchema>;

export const assessmentRequestSchema = z.object({
  assessmentId: z.string(),
  questions: z.array(
    z.object({
      id: z.string(),
      prompt: z.string(),
      answer: z.string(),
      section: z.string(),
    }),
  ),
  scenarios: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      title: z.string(),
      category: z.string(),
      definition: z.string(),
      appetite: z.enum(["Low", "Moderate", "High", "Severe"]),
      controls: z.array(z.string()),
      evidenceRequired: z.array(z.string()),
      sourceCitation: z.string(),
    }),
  ),
});

export type AssessmentRequest = z.infer<typeof assessmentRequestSchema>;
