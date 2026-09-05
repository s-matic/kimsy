import { z } from "zod";
import { assessmentRowInputSchema } from "@/lib/ai/schema";
import { sourceDocumentSchema } from "@/lib/ai/setup-contract";

export const assessmentToolName = "proposeRegisterChanges" as const;

export const assessmentAgentToolResultSchema = z.object({
  summary: z.string(),
  changes: z.array(assessmentRowInputSchema),
  warnings: z.array(z.string()),
  sources: z.array(sourceDocumentSchema),
});

export type AssessmentAgentToolResult = z.infer<typeof assessmentAgentToolResultSchema>;

export function isAssessmentToolPart(part: { type: string }) {
  return part.type === `tool-${assessmentToolName}`;
}
