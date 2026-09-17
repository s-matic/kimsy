import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type KimsyAgentId = "setup" | "assessment" | "planning";

export class AiNotConfiguredError extends Error {
  constructor(message = "Add OPENAI_API_KEY to .env.local and restart Kimsy to use AI setup and assessment.") {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

function configuredProvider() {
  return (process.env.AI_PROVIDER ?? "openai").trim().toLowerCase();
}

export function isAiConfigured() {
  const provider = configuredProvider();
  return provider === "openai" && Boolean(process.env.OPENAI_API_KEY);
}

export function getKimsyModel(agentId: KimsyAgentId): LanguageModel {
  const provider = configuredProvider();
  if (provider !== "openai") {
    throw new AiNotConfiguredError(`AI_PROVIDER=${provider} is not configured. Kimsy currently has an OpenAI adapter installed.`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();

  const sharedModel = process.env.OPENAI_MODEL?.trim() || "gpt-5.4-nano";
  const modelId = agentId === "setup"
    ? process.env.AI_SETUP_MODEL?.trim() || sharedModel
    : agentId === "planning"
      ? process.env.AI_PLANNING_MODEL?.trim() || sharedModel
      : process.env.AI_ASSESSMENT_MODEL?.trim() || sharedModel;
  const openai = createOpenAI({ apiKey });
  return openai.responses(modelId);
}
