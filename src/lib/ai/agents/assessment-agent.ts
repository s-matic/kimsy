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
import type { Assessment, SourceDocument, WorkspaceConfiguration } from "@/lib/types";

interface AssessmentAgentContext {
  configuration: WorkspaceConfiguration;
  assessment: Assessment;
  sources: SourceDocument[];
}

interface AssessmentPromptInput extends AssessmentAgentContext {
  message: string;
  sourceInput: AiSourceInput;
}

const proposalInputSchema = z.object({
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
        validateAssessmentProposal(context.configuration, proposal);
        return { ...proposal, sources: context.sources };
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: `Prepared ${output.changes.length} reviewable register changes with ${output.warnings.length} warnings. Briefly summarize the result and remind the assessor to review the proposal before applying it.`,
      }),
    }),
  };

  return new ToolLoopAgent({
    id: "kimsy-assessment-agent",
    model: getKimsyModel("assessment"),
    instructions: [
      "You are Kimsy's assessment agent for one compliance or risk professional.",
      "Use only the supplied organizational unit, configured scenarios, editable assessment fields, current assessment, user message, and source material.",
      "You must call proposeRegisterChanges. It creates a draft only; never claim values were saved, applied, approved, or legally conclusive.",
      "Use only supplied scenario IDs and editable field IDs. Never set calculated fields. Use select option IDs, not labels.",
      "Mark a scenario not applicable only when the supplied facts support that conclusion.",
      "Give concise judgment-based rationales and precise page, paragraph, sheet, row, or image citations.",
      "When evidence is insufficient, omit unsupported field changes and explain the gap in warnings rather than guessing.",
      "After the tool succeeds, respond in one or two natural sentences. The detailed proposal appears separately in the interface.",
    ].join(" "),
    tools,
    activeTools: [assessmentToolName],
    stopWhen: stepCountIs(2),
    maxOutputTokens: 20000,
    prepareStep: ({ stepNumber }) => stepNumber === 0
      ? { activeTools: [assessmentToolName], toolChoice: { type: "tool", toolName: assessmentToolName } }
      : { activeTools: [], toolChoice: "none", maxOutputTokens: 250 },
  });
}

export function assessmentAgentMessages(input: AssessmentPromptInput): ModelMessage[] {
  const editableFields = input.configuration.fields.filter((field) => field.type !== "CALCULATED");
  const text = [
    `User request: ${input.message || "Assess the attached source material."}`,
    `Workspace configuration:\n${JSON.stringify({ ...input.configuration, fields: editableFields })}`,
    `Current assessment and prior conversation:\n${JSON.stringify(input.assessment)}`,
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
