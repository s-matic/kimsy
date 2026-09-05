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

function streamState(message: UIMessage): AssessmentAgentStreamState {
  let result: AssessmentAgentToolResult | undefined;
  for (const part of message.parts) {
    if (!isAssessmentToolPart(part)) continue;
    if ("state" in part && part.state === "output-error") {
      throw new Error(part.errorText || "Kimsy could not prepare the register proposal.");
    }
    if ("state" in part && part.state === "output-available") {
      const parsed = assessmentAgentToolResultSchema.safeParse(part.output);
      if (!parsed.success) throw new Error("Kimsy returned an invalid register proposal.");
      result = parsed.data;
    }
  }
  return {
    text: message.parts.filter((part) => part.type === "text").map((part) => part.text).join(""),
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
