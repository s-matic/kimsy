import {
  type UIMessage,
} from "ai";
import {
  isSetupToolPart,
  setupAgentToolResultSchema,
  setupClarificationSchema,
  type SetupAgentToolResult,
  type SetupClarification,
} from "@/lib/ai/setup-contract";
import { readResponseUIMessageStream } from "@/lib/ai/ui-message-response";

export interface SetupAgentStreamState {
  text: string;
  mode?: "clarification" | "update";
  result?: SetupAgentToolResult;
  clarification?: SetupClarification;
}

function assistantMessage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const message = (value as Record<string, unknown>).assistantMessage;
  return typeof message === "string" ? message : "";
}

function streamState(message: UIMessage): SetupAgentStreamState {
  let result: SetupAgentToolResult | undefined;
  let clarification: SetupClarification | undefined;
  let mode: SetupAgentStreamState["mode"];
  let toolText = "";
  for (const part of message.parts) {
    if (!isSetupToolPart(part)) continue;
    const isClarification = part.type === "tool-askClarification";
    mode = isClarification ? "clarification" : "update";
    if ("state" in part && part.state === "output-error") {
      throw new Error(part.errorText || (isClarification ? "Kimsy could not continue the setup conversation." : "Kimsy could not create the setup draft."));
    }
    if ("input" in part) toolText = assistantMessage(part.input) || toolText;
    if ("state" in part && part.state === "output-available") {
      if (isClarification) {
        const parsed = setupClarificationSchema.safeParse(part.output);
        if (!parsed.success) throw new Error("Kimsy returned an invalid clarification.");
        clarification = parsed.data;
        toolText = parsed.data.assistantMessage;
      } else {
        const parsed = setupAgentToolResultSchema.safeParse(part.output);
        if (!parsed.success) throw new Error("Kimsy returned an invalid setup draft.");
        result = parsed.data;
        toolText = parsed.data.assistantMessage;
      }
    }
  }
  const responseText = message.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
  return {
    text: responseText || toolText,
    mode,
    result,
    clarification,
  };
}

export async function consumeSetupAgentStream(
  response: Response,
  onUpdate: (state: SetupAgentStreamState) => void,
) {
  let finalState: SetupAgentStreamState = { text: "" };
  for await (const message of readResponseUIMessageStream(response)) {
    finalState = streamState(message);
    onUpdate(finalState);
  }
  return finalState;
}
