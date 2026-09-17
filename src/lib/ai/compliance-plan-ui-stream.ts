import type { UIMessage } from "ai";
import { compliancePlanAgentToolResultSchema, isCompliancePlanToolPart, type CompliancePlanAgentToolResult } from "@/lib/ai/compliance-plan-contract";
import { readResponseUIMessageStream } from "@/lib/ai/ui-message-response";

export interface CompliancePlanAgentStreamState {
  text: string;
  result?: CompliancePlanAgentToolResult;
}

function assistantMessage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const message = (value as Record<string, unknown>).assistantMessage;
  return typeof message === "string" ? message : "";
}

function streamState(message: UIMessage): CompliancePlanAgentStreamState {
  let result: CompliancePlanAgentToolResult | undefined;
  let toolText = "";
  for (const part of message.parts) {
    if (!isCompliancePlanToolPart(part)) continue;
    if ("state" in part && part.state === "output-error") throw new Error(part.errorText || "Kimsy could not prepare the compliance plan proposal.");
    if ("input" in part) toolText = assistantMessage(part.input) || toolText;
    if ("state" in part && part.state === "output-available") {
      const parsed = compliancePlanAgentToolResultSchema.safeParse(part.output);
      if (!parsed.success) throw new Error("Kimsy returned an invalid compliance plan proposal.");
      result = parsed.data;
      toolText = parsed.data.assistantMessage;
    }
  }
  const responseText = message.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
  return { text: responseText || toolText, result };
}

export async function consumeCompliancePlanAgentStream(response: Response, onUpdate: (state: CompliancePlanAgentStreamState) => void) {
  let finalState: CompliancePlanAgentStreamState = { text: "" };
  for await (const message of readResponseUIMessageStream(response)) {
    finalState = streamState(message);
    onUpdate(finalState);
  }
  return finalState;
}
