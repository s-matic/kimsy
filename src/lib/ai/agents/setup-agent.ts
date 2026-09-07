import "server-only";

import { stepCountIs, tool, ToolLoopAgent, type ModelMessage } from "ai";
import { getKimsyModel } from "@/lib/ai/models";
import type { AiSourceInput } from "@/lib/ai/source-types";
import { setupStageToolName, type SetupStage } from "@/lib/ai/setup-contract";
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

export function createSetupAgent(context: SetupAgentContext) {
  const tools = {
    askClarification: tool({
      description: "Ask a focused follow-up when the user has not provided enough information to create or meaningfully revise the current setup draft. This tool never changes the workspace.",
      inputSchema: setupToolInputSchemas.askClarification,
      strict: true,
      execute: async ({ assistantMessage, missingInformation }) => ({
        stage: context.stage,
        assistantMessage,
        missingInformation,
      }),
    }),
    proposeOrganization: tool({
      description: "Create or revise the organization's editable name and reporting hierarchy.",
      inputSchema: setupToolInputSchemas.proposeOrganization,
      strict: true,
      execute: async ({ assistantMessage, organizationName, units, warnings }) => createSetupDraftResult(context, { organizationName, units }, assistantMessage, warnings),
    }),
    configureAssessmentOwner: tool({
      description: "Configure the single assessment owner. Multiplayer and independent review are disabled for now.",
      inputSchema: setupToolInputSchemas.configureAssessmentOwner,
      strict: true,
      execute: async ({ assistantMessage, assessorName, warnings }) => createSetupDraftResult(context, {
        review: { mode: "SOLO", assessorName, reviewerName: "" },
      }, assistantMessage, warnings),
    }),
    upsertRiskScenarios: tool({
      description: "Create or revise the complete editable risk scenario library from the user's material.",
      inputSchema: setupToolInputSchemas.upsertRiskScenarios,
      strict: true,
      execute: async ({ assistantMessage, scenarios, warnings }) => createSetupDraftResult(context, { scenarios }, assistantMessage, warnings),
    }),
    configureAssessmentMethod: tool({
      description: "Create or revise assessment fields, options, transparent calculations, and the final rating field.",
      inputSchema: setupToolInputSchemas.configureAssessmentMethod,
      strict: true,
      execute: async ({ assistantMessage, fields, matrixCalculations, thresholdCalculations, finalRatingFieldId, warnings }) => createSetupDraftResult(context, {
        fields,
        calculations: [...matrixCalculations, ...thresholdCalculations],
        finalRatingFieldId,
      }, assistantMessage, warnings),
    }),
  };
  const activeTool = setupStageToolName[context.stage];

  return new ToolLoopAgent({
    id: "kimsy-setup-agent",
    model: getKimsyModel("setup"),
    instructions: [
      "You are Kimsy's setup agent for one primary compliance or risk professional.",
      `The current setup stage is ${context.stage}.`,
      "You must call exactly one available tool.",
      `Call ${activeTool} only when the message, conversation, existing configuration, or supplied source material contains enough information to create a meaningful change to the current draft.`,
      "Call askClarification for greetings, vague requests, unrelated messages, or whenever essential information is missing. Ask one focused follow-up and do not manufacture draft values.",
      "Preserve existing content and IDs unless the user asks to change it. Use stable lowercase kebab-case IDs for new items.",
      "Parent IDs must reference units in the proposed organization. Keep source names and precise locators on risk scenarios.",
      "Do not invent legal requirements. Put concrete ambiguity or missing information in tool warnings.",
      "Multiplayer is not enabled: configure exactly one assessment owner and never add a reviewer.",
      "For the assessment method, follow the user's existing terminology and keep the form compact. Every calculated field needs an explicit MATRIX or THRESHOLD definition, and matrices must cover every option combination.",
      "Use output option IDs—not labels—for every matrix cell result and threshold band result.",
      "Put the short user-facing reply in assistantMessage before generating the larger draft fields. The interface streams that field while the rest of the tool input is generated.",
    ].join(" "),
    tools,
    activeTools: [activeTool, "askClarification"],
    toolChoice: "required",
    stopWhen: stepCountIs(1),
    maxOutputTokens: 30000,
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
