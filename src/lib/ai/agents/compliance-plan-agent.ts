import "server-only";

import { stepCountIs, tool, ToolLoopAgent, type ModelMessage } from "ai";
import { z } from "zod";
import { compliancePlanChangeSchema, compliancePlanToolName, type CompliancePlanAgentToolResult } from "@/lib/ai/compliance-plan-contract";
import { validateCompliancePlanChanges } from "@/lib/ai/compliance-plan-proposal";
import { getKimsyModel } from "@/lib/ai/models";
import type { AiSourceInput } from "@/lib/ai/source-types";
import type { CompliancePlan, SourceDocument } from "@/lib/types";

export interface CompliancePlanningContext {
  plan: CompliancePlan;
  unitId: string;
  unitName: string;
  complianceOwner: string;
  sources: SourceDocument[];
}

interface CompliancePlanningPromptInput extends CompliancePlanningContext {
  message: string;
  sourceInput: AiSourceInput;
}

const proposalSchema = z.object({
  assistantMessage: z.string().describe("A concise response summarizing what was drafted and reminding the owner to review it."),
  summary: z.string().describe("A concise audit-friendly summary of the proposed changes."),
  changes: z.array(compliancePlanChangeSchema).describe("Reviewable changes for the selected unit only."),
  warnings: z.array(z.string()).describe("Evidence gaps or planning judgments the owner should resolve."),
});

export function createCompliancePlanAgent(context: CompliancePlanningContext) {
  const tools = {
    proposeCompliancePlanChanges: tool({
      description: "Prepare reviewable compliance-plan changes for the selected organizational unit without applying them.",
      inputSchema: proposalSchema,
      strict: true,
      execute: async (proposal): Promise<CompliancePlanAgentToolResult> => {
        validateCompliancePlanChanges(context.plan, context.unitId, proposal.changes);
        return { ...proposal, sources: context.sources };
      },
    }),
  };

  return new ToolLoopAgent({
    id: "kimsy-compliance-planning-agent",
    model: getKimsyModel("planning"),
    instructions: [
      "You are Kimsy's compliance planning agent for one compliance professional and one selected organizational unit.",
      "Turn finalized risk assessment evidence into focused compliance-function work: monitoring or testing, policy reviews, training, advisory work, and reporting.",
      "Do not create business remediation tasks. Prioritize material residual risks, weak controls, and well-supported concerns; do not create an activity for every scenario.",
      "Use only the selected unit, source risk snapshots, existing unit activities, conversation, user request, and attached sources.",
      "You must call proposeCompliancePlanChanges. It creates a draft proposal only. Never claim changes were applied or the plan was activated.",
      "Every added or updated activity must cite at least one supplied scenario ID and explain why the activity belongs in the plan.",
      "Use ISO dates inside the plan period. Use an empty activityId for ADD and exact existing IDs for UPDATE or REMOVE.",
      "Prefer a small, realistic plan with clear objectives and proportionate cadence. When evidence is insufficient, warn instead of guessing.",
      "Put the short user-facing reply in assistantMessage before generating the larger change list so it can stream early.",
    ].join(" "),
    tools,
    activeTools: [compliancePlanToolName],
    toolChoice: { type: "tool", toolName: compliancePlanToolName },
    stopWhen: stepCountIs(1),
    maxOutputTokens: 16000,
  });
}

export function compliancePlanAgentMessages(input: CompliancePlanningPromptInput): ModelMessage[] {
  const source = input.plan.sources.find((item) => item.unitId === input.unitId);
  const activities = input.plan.activities.filter((activity) => activity.unitId === input.unitId);
  const thread = input.plan.unitThreads[input.unitId];
  const compactPlan = {
    id: input.plan.id,
    name: input.plan.name,
    startDate: input.plan.startDate,
    endDate: input.plan.endDate,
    status: input.plan.status,
    selectedUnit: { id: input.unitId, name: input.unitName },
    complianceOwner: input.complianceOwner,
    sourceAssessment: source,
    currentActivities: activities,
    priorConversation: thread?.messages ?? [],
  };
  const text = [
    `User request: ${input.message || "Draft a risk-prioritized compliance plan for this unit."}`,
    `Selected unit compliance-plan context:\n${JSON.stringify(compactPlan)}`,
    `Extracted new source material:\n${input.sourceInput.text || "No new text source supplied."}`,
  ].join("\n\n");
  return [{
    role: "user",
    content: [
      { type: "text", text },
      ...input.sourceInput.images.map((image) => ({ type: "file" as const, data: { type: "data" as const, data: image.data }, mediaType: image.mediaType, filename: image.filename })),
    ],
  }];
}
