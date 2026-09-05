import "server-only";

import { stepCountIs, tool, ToolLoopAgent, type ModelMessage } from "ai";
import { getKimsyModel } from "@/lib/ai/models";
import type { AiSourceInput } from "@/lib/ai/source-types";
import { setupStageToolName, type SetupAgentToolResult, type SetupStage } from "@/lib/ai/setup-contract";
import { createSetupDraftResult } from "@/lib/ai/setup-draft";
import { setupToolInputSchemas } from "@/lib/ai/setup-tool-schemas";
import type { SourceDocument, WorkspaceConfiguration } from "@/lib/types";

interface SetupAgentContext {
  stage: SetupStage;
  configuration: WorkspaceConfiguration;
  sources: SourceDocument[];
}

interface SetupPromptInput extends SetupAgentContext {
  message: string;
  conversation: string;
  sourceInput: AiSourceInput;
}

function compactToolOutput(output: SetupAgentToolResult) {
  const count = output.stage === "ORGANIZATION"
    ? `${output.configuration.units.length} organizational units`
    : output.stage === "WORKFLOW"
      ? `assessment owner ${output.configuration.review.assessorName || "not yet named"}`
      : output.stage === "SCENARIOS"
        ? `${output.configuration.scenarios.length} risk scenarios`
        : `${output.configuration.fields.length} fields and ${output.configuration.calculations.length} calculations`;
  return {
    type: "text" as const,
    value: `The editable ${output.stage.toLowerCase()} draft is ready with ${count}. There are ${output.warnings.length} validation warnings. Briefly tell the user what you changed and ask them to review the inline draft. Do not repeat the full draft or the warnings list.`,
  };
}

export function createSetupAgent(context: SetupAgentContext) {
  const tools = {
    proposeOrganization: tool({
      description: "Create or revise the organization's editable name and reporting hierarchy.",
      inputSchema: setupToolInputSchemas.proposeOrganization,
      strict: true,
      execute: async ({ organizationName, units, warnings }) => createSetupDraftResult(context, { organizationName, units }, warnings),
      toModelOutput: ({ output }) => compactToolOutput(output),
    }),
    configureAssessmentOwner: tool({
      description: "Configure the single assessment owner. Multiplayer and independent review are disabled for now.",
      inputSchema: setupToolInputSchemas.configureAssessmentOwner,
      strict: true,
      execute: async ({ assessorName, warnings }) => createSetupDraftResult(context, {
        review: { mode: "SOLO", assessorName, reviewerName: "" },
      }, warnings),
      toModelOutput: ({ output }) => compactToolOutput(output),
    }),
    upsertRiskScenarios: tool({
      description: "Create or revise the complete editable risk scenario library from the user's material.",
      inputSchema: setupToolInputSchemas.upsertRiskScenarios,
      strict: true,
      execute: async ({ scenarios, warnings }) => createSetupDraftResult(context, { scenarios }, warnings),
      toModelOutput: ({ output }) => compactToolOutput(output),
    }),
    configureAssessmentMethod: tool({
      description: "Create or revise assessment fields, options, transparent calculations, and the final rating field.",
      inputSchema: setupToolInputSchemas.configureAssessmentMethod,
      strict: true,
      execute: async ({ fields, matrixCalculations, thresholdCalculations, finalRatingFieldId, warnings }) => createSetupDraftResult(context, {
        fields,
        calculations: [...matrixCalculations, ...thresholdCalculations],
        finalRatingFieldId,
      }, warnings),
      toModelOutput: ({ output }) => compactToolOutput(output),
    }),
  };
  const activeTool = setupStageToolName[context.stage];

  return new ToolLoopAgent({
    id: "kimsy-setup-agent",
    model: getKimsyModel("setup"),
    instructions: [
      "You are Kimsy's setup agent for one primary compliance or risk professional.",
      `The current setup stage is ${context.stage}.`,
      "You must use the one available setup tool to turn the user's request and source material into an editable draft.",
      "Preserve existing content and IDs unless the user asks to change it. Use stable lowercase kebab-case IDs for new items.",
      "Parent IDs must reference units in the proposed organization. Keep source names and precise locators on risk scenarios.",
      "Do not invent legal requirements. Put concrete ambiguity or missing information in tool warnings.",
      "Multiplayer is not enabled: configure exactly one assessment owner and never add a reviewer.",
      "For the assessment method, follow the user's existing terminology and keep the form compact. Every calculated field needs an explicit MATRIX or THRESHOLD definition, and matrices must cover every option combination.",
      "After the tool succeeds, respond in one or two natural sentences. The draft itself appears separately in the interface.",
    ].join(" "),
    tools,
    activeTools: [activeTool],
    stopWhen: stepCountIs(2),
    maxOutputTokens: 30000,
    prepareStep: ({ stepNumber }) => stepNumber === 0
      ? { activeTools: [activeTool], toolChoice: { type: "tool", toolName: activeTool } }
      : { activeTools: [], toolChoice: "none", maxOutputTokens: 250 },
  });
}

export function setupAgentMessages(input: SetupPromptInput): ModelMessage[] {
  const text = [
    `User request: ${input.message || "Interpret the supplied material and propose this onboarding step."}`,
    `Conversation so far:\n${input.conversation || "This is the first user message."}`,
    `Current workspace configuration:\n${JSON.stringify(input.configuration)}`,
    `Extracted source material:\n${input.sourceInput.text || "No text source supplied."}`,
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
