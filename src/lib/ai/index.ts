import { DemoAiProvider } from "@/lib/ai/demo-provider";
import { OpenAiProvider } from "@/lib/ai/openai-provider";
import type { AiProvider } from "@/lib/ai/provider";

export function getAiProvider(): AiProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAiProvider(apiKey) : new DemoAiProvider();
}
