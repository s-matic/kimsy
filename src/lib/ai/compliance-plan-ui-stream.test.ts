import { describe, expect, it } from "vitest";
import type { UIMessageChunk } from "ai";
import { consumeCompliancePlanAgentStream } from "@/lib/ai/compliance-plan-ui-stream";

function event(chunk: UIMessageChunk) {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

describe("compliance planning agent UI stream", () => {
  it("preserves the proposal while assistant text streams across arbitrary chunks", async () => {
    const result = {
      assistantMessage: "I prepared a focused unit plan.",
      summary: "Added quarterly monitoring.",
      changes: [{ operation: "ADD", activityId: "", type: "MONITORING", title: "Quarterly control monitoring", objective: "Test whether controls operate effectively.", owner: "Compliance owner", priority: "HIGH", inclusionRationale: "Residual risk remains high.", sourceScenarioIds: ["risk-a"], cadence: "QUARTERLY", startDate: "2026-03-31", endDate: "2026-12-31" }],
      warnings: [],
      sources: [],
    };
    const payload = [
      event({ type: "start", messageId: "assistant-1" }),
      event({ type: "start-step" }),
      event({ type: "tool-input-start", toolCallId: "call-1", toolName: "proposeCompliancePlanChanges" }),
      event({ type: "tool-input-delta", toolCallId: "call-1", inputTextDelta: '{"assistantMessage":"I prepared ' }),
      event({ type: "tool-input-delta", toolCallId: "call-1", inputTextDelta: 'a focused unit plan."}' }),
      event({ type: "tool-input-available", toolCallId: "call-1", toolName: "proposeCompliancePlanChanges", input: { assistantMessage: result.assistantMessage } }),
      event({ type: "tool-output-available", toolCallId: "call-1", output: result }),
      event({ type: "finish-step" }),
      event({ type: "finish", finishReason: "tool-calls" }),
      "data: [DONE]\n\n",
    ].join("");
    const encoder = new TextEncoder();
    const response = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(payload.slice(0, 53)));
        controller.enqueue(encoder.encode(payload.slice(53, 207)));
        controller.enqueue(encoder.encode(payload.slice(207)));
        controller.close();
      },
    }));

    const finalState = await consumeCompliancePlanAgentStream(response, () => undefined);
    expect(finalState.text).toBe(result.assistantMessage);
    expect(finalState.result).toEqual(result);
  });
});
