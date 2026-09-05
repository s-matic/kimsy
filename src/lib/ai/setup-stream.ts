import type { OnboardingAiOutput } from "@/lib/ai/schema";
import type { SourceDocument } from "@/lib/types";

export type SetupStreamResult = OnboardingAiOutput & { sources: SourceDocument[] };

export type SetupStreamEvent =
  | { type: "assistant-delta"; delta: string }
  | { type: "result"; result: SetupStreamResult }
  | { type: "error"; error: string; code: string };

export function encodeSetupStreamEvent(event: SetupStreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

function parseSetupStreamEvent(line: string): SetupStreamEvent {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error("Kimsy received an invalid streaming response.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Kimsy received an invalid streaming response.");
  }
  const event = value as Record<string, unknown>;
  if (event.type === "assistant-delta" && typeof event.delta === "string") {
    return { type: "assistant-delta", delta: event.delta };
  }
  if (event.type === "result" && event.result && typeof event.result === "object") {
    return { type: "result", result: event.result as SetupStreamResult };
  }
  if (event.type === "error" && typeof event.error === "string") {
    return { type: "error", error: event.error, code: typeof event.code === "string" ? event.code : "STREAM_ERROR" };
  }
  throw new Error("Kimsy received an invalid streaming response.");
}

export async function consumeSetupStream(
  response: Response,
  onEvent: (event: Exclude<SetupStreamEvent, { type: "error" }>) => void,
) {
  if (!response.body) throw new Error("Kimsy received an empty streaming response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    const event = parseSetupStreamEvent(line);
    if (event.type === "error") throw new Error(event.error);
    onEvent(event);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      consumeLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }

  buffer += decoder.decode();
  consumeLine(buffer);
}
