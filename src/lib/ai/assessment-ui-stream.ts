import type { UIMessage } from "ai";
import {
  assessmentAgentToolResultSchema,
  isAssessmentToolPart,
  type AssessmentAgentToolResult,
} from "@/lib/ai/assessment-contract";
import { readResponseUIMessageStream } from "@/lib/ai/ui-message-response";

export interface AssessmentAgentStreamState {
  text: string;
  result?: AssessmentAgentToolResult;
}

function assistantMessage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const message = (value as Record<string, unknown>).assistantMessage;
  return typeof message === "string" ? message : "";
}

function streamState(message: UIMessage): AssessmentAgentStreamState {
  let result: AssessmentAgentToolResult | undefined;
  let toolText = "";
  for (const part of message.parts) {
    if (!isAssessmentToolPart(part)) continue;
    if ("state" in part && part.state === "output-error") {
      throw new Error(part.errorText || "Kimsy could not prepare the register proposal.");
    }
    if ("input" in part) toolText = assistantMessage(part.input) || toolText;
    if ("state" in part && part.state === "output-available") {
      const parsed = assessmentAgentToolResultSchema.safeParse(part.output);
      if (!parsed.success) throw new Error("Kimsy returned an invalid register proposal.");
      result = parsed.data;
      toolText = parsed.data.assistantMessage;
    }
  }
  const responseText = message.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
  return {
    text: responseText || toolText,
    result,
  };
}

export async function consumeAssessmentAgentStream(
  response: Response,
  onUpdate: (state: AssessmentAgentStreamState) => void,
) {
  let finalState: AssessmentAgentStreamState = { text: "" };
  for await (const message of readResponseUIMessageStream(response)) {
    finalState = streamState(message);
    onUpdate(finalState);
  }
  return finalState;
}
