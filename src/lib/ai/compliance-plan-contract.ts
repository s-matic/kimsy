import { z } from "zod";
import { sourceDocumentSchema } from "@/lib/ai/setup-contract";

export const compliancePlanToolName = "proposeCompliancePlanChanges" as const;

export const compliancePlanChangeSchema = z.object({
  operation: z.enum(["ADD", "UPDATE", "REMOVE"]),
  activityId: z.string().describe("Empty for ADD. The existing activity ID for UPDATE or REMOVE."),
  type: z.enum(["MONITORING", "POLICY_REVIEW", "TRAINING", "ADVISORY", "REPORTING"]),
  title: z.string(),
  objective: z.string(),
  owner: z.string(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  inclusionRationale: z.string(),
  sourceScenarioIds: z.array(z.string()),
  cadence: z.enum(["ONCE", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]),
  startDate: z.string().describe("ISO date formatted YYYY-MM-DD."),
  endDate: z.string().describe("ISO date formatted YYYY-MM-DD."),
});

export const compliancePlanAgentToolResultSchema = z.object({
  assistantMessage: z.string(),
  summary: z.string(),
  changes: z.array(compliancePlanChangeSchema),
  warnings: z.array(z.string()),
  sources: z.array(sourceDocumentSchema),
});

export type CompliancePlanAgentToolResult = z.infer<typeof compliancePlanAgentToolResultSchema>;

export function isCompliancePlanToolPart(part: { type: string }) {
  return part.type === `tool-${compliancePlanToolName}`;
}
