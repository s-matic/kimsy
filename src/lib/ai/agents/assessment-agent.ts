import "server-only";

import { stepCountIs, tool, ToolLoopAgent, type ModelMessage } from "ai";
import { z } from "zod";
import {
  assessmentToolName,
  type AssessmentAgentToolResult,
} from "@/lib/ai/assessment-contract";
import { validateAssessmentProposal } from "@/lib/ai/assessment-proposal";
import { getKimsyModel } from "@/lib/ai/models";
import type { AiSourceInput } from "@/lib/ai/source-types";
import { assessmentRowInputSchema } from "@/lib/ai/schema";
import type { AssessmentRow, AssessmentStatus, ScenarioThread, SourceDocument, WorkspaceConfiguration } from "@/lib/types";

export interface ScenarioAssessmentContext {
  id: string;
  unitId: string;
  period: string;
  status: AssessmentStatus;
  initialBrief: string;
  row: AssessmentRow;
  thread: ScenarioThread;
}

interface AssessmentAgentContext {
  configuration: WorkspaceConfiguration;
  assessment: ScenarioAssessmentContext;
  scenarioId: string;
  sources: SourceDocument[];
}

interface AssessmentPromptInput extends AssessmentAgentContext {
  message: string;
  sourceInput: AiSourceInput;
}

const proposalInputSchema = z.object({
  assistantMessage: z.string().describe("A concise message summarizing the proposed register update and reminding the assessor to review it before applying."),
  summary: z.string().describe("A concise summary of the proposed register changes."),
  changes: z.array(assessmentRowInputSchema).describe("Only rows supported by the user's request and supplied evidence."),
  warnings: z.array(z.string()).describe("Information gaps or ambiguities the assessor should resolve."),
});

export function createAssessmentAgent(context: AssessmentAgentContext) {
  const tools = {
    proposeRegisterChanges: tool({
      description: "Prepare reviewable changes to the assessment register without applying or approving them.",
      inputSchema: proposalInputSchema,
      strict: true,
      execute: async (proposal): Promise<AssessmentAgentToolResult> => {
        validateAssessmentProposal(context.configuration, context.scenarioId, proposal);
        return { ...proposal, sources: context.sources };
      },
    }),
  };

  return new ToolLoopAgent({
    id: "kimsy-assessment-agent",
    model: getKimsyModel("assessment"),
    instructions: [
      "You are Kimsy's assessment agent for one compliance or risk professional and one open risk scenario.",
      "Use only the supplied organizational unit, open scenario, editable assessment fields, current scenario row, scenario conversation, user message, and source material.",
      "You must call proposeRegisterChanges. It creates a draft only; never claim values were saved, applied, approved, or legally conclusive.",
      "Propose changes only for the supplied open scenario ID. Never mention or change another scenario. Use only editable field IDs. Never set calculated fields. Use select option IDs, not labels.",
      "Mark a scenario not applicable only when the supplied facts support that conclusion.",
      "Give concise judgment-based rationales and precise page, paragraph, sheet, row, or image citations.",
      "When evidence is insufficient, omit unsupported field changes and explain the gap in warnings rather than guessing.",
      "Put the short user-facing reply in assistantMessage before generating the larger proposal fields. The interface streams that field while the rest of the tool input is generated.",
    ].join(" "),
    tools,
    activeTools: [assessmentToolName],
    toolChoice: { type: "tool", toolName: assessmentToolName },
    stopWhen: stepCountIs(1),
    maxOutputTokens: 20000,
  });
}

export function assessmentAgentMessages(input: AssessmentPromptInput): ModelMessage[] {
  const editableFields = input.configuration.fields.filter((field) => field.type !== "CALCULATED");
  const scenario = input.configuration.scenarios.find((item) => item.id === input.scenarioId);
  const unit = input.configuration.units.find((item) => item.id === input.assessment.unitId);
  const text = [
    `User request: ${input.message || "Assess the attached source material."}`,
    `Open organizational unit:\n${JSON.stringify(unit)}`,
    `Open risk scenario:\n${JSON.stringify(scenario)}`,
    `Assessment method:\n${JSON.stringify({ fields: editableFields, calculations: input.configuration.calculations, finalRatingFieldId: input.configuration.finalRatingFieldId })}`,
    `Current scenario assessment and its prior conversation:\n${JSON.stringify(input.assessment)}`,
    `Extracted new source material:\n${input.sourceInput.text || "No new text source supplied."}`,
  ].join("\n\n");

  return [{
    role: "user",
    content: [
      { type: "text", text },
      ...input.sourceInput.images.map((image) => ({
        type: "file" as const,
        data: { type: "data" as const, data: image.data },
        mediaType: image.mediaType,
        filename: image.filename,
      })),
    ],
  }];
}
