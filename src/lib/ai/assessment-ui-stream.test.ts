import { describe, expect, it } from "vitest";
import type { UIMessageChunk } from "ai";
import { consumeAssessmentAgentStream } from "@/lib/ai/assessment-ui-stream";

function event(chunk: UIMessageChunk) {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

describe("assessment agent UI stream", () => {
  it("keeps the proposal tool output while the assistant summary streams", async () => {
    const result = {
      assistantMessage: "I prepared one change.",
      summary: "One supported change",
      changes: [{
        scenarioId: "scenario-one",
        applicable: true,
        values: [{ fieldId: "likelihood", value: "likely" }],
        rationale: "Supported by the supplied notes.",
        citations: [{ sourceName: "notes.pdf", locator: "page 2" }],
      }],
      warnings: [],
      sources: [{
        id: "source-one",
        name: "notes.pdf",
        mediaType: "application/pdf",
        size: 100,
        locators: ["page 2"],
        addedAt: "Just now",
      }],
    };
    const payload = [
      event({ type: "start", messageId: "assistant-1" }),
      event({ type: "start-step" }),
      event({ type: "tool-input-start", toolCallId: "call-1", toolName: "proposeRegisterChanges" }),
      event({ type: "tool-input-delta", toolCallId: "call-1", inputTextDelta: '{"assistantMessage":"I prepared ' }),
      event({ type: "tool-input-delta", toolCallId: "call-1", inputTextDelta: 'one change."}' }),
      event({ type: "tool-input-available", toolCallId: "call-1", toolName: "proposeRegisterChanges", input: { assistantMessage: "I prepared one change." } }),
      event({ type: "tool-output-available", toolCallId: "call-1", output: result }),
      event({ type: "finish-step" }),
      event({ type: "finish", finishReason: "tool-calls" }),
      "data: [DONE]\n\n",
    ].join("");
    const encoder = new TextEncoder();
    const response = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(payload.slice(0, 71)));
        controller.enqueue(encoder.encode(payload.slice(71)));
        controller.close();
      },
    }));

    const finalState = await consumeAssessmentAgentStream(response, () => undefined);

    expect(finalState.text).toBe("I prepared one change.");
    expect(finalState.result).toEqual(result);
  });
});
