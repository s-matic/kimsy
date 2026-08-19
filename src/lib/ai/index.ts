import "server-only";
import { OpenAiWorkspaceProvider } from "@/lib/ai/openai-provider";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("Add OPENAI_API_KEY to .env.local and restart Kimsy to use AI setup and assessment.");
    this.name = "AiNotConfiguredError";
  }
}

export function getWorkspaceAiProvider() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();
  return new OpenAiWorkspaceProvider(apiKey);
}
