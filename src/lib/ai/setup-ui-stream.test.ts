import { describe, expect, it } from "vitest";
import type { UIMessageChunk } from "ai";
import { consumeSetupAgentStream } from "@/lib/ai/setup-ui-stream";

function event(chunk: UIMessageChunk) {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

function responseFromPieces(pieces: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      pieces.forEach((piece) => controller.enqueue(encoder.encode(piece)));
      controller.close();
    },
  }), { headers: { "content-type": "text/event-stream" } });
}

describe("setup agent UI stream", () => {
  it("delivers a typed tool result and streaming assistant text across arbitrary byte chunks", async () => {
    const result = {
      stage: "ORGANIZATION" as const,
      assistantMessage: "I mapped your organization.",
      configuration: {
        organizationName: "Example",
        units: [{ id: "example", name: "Example", parentId: null, description: "Top-level unit" }],
        review: { mode: "SOLO" as const, assessorName: "", reviewerName: "" },
        scenarios: [],
        fields: [],
        calculations: [],
        finalRatingFieldId: "",
      },
      warnings: [],
      sources: [],
    };
    const payload = [
      event({ type: "start", messageId: "assistant-1" }),
      event({ type: "start-step" }),
      event({ type: "tool-input-start", toolCallId: "call-1", toolName: "proposeOrganization" }),
      event({ type: "tool-input-delta", toolCallId: "call-1", inputTextDelta: '{"assistantMessage":"I mapped ' }),
      event({ type: "tool-input-delta", toolCallId: "call-1", inputTextDelta: 'your organization."}' }),
      event({ type: "tool-input-available", toolCallId: "call-1", toolName: "proposeOrganization", input: { assistantMessage: "I mapped your organization." } }),
      event({ type: "tool-output-available", toolCallId: "call-1", output: result }),
      event({ type: "finish-step" }),
      event({ type: "finish", finishReason: "tool-calls" }),
      "data: [DONE]\n\n",
    ].join("");
    const response = responseFromPieces([
      payload.slice(0, 19),
      payload.slice(19, 113),
      payload.slice(113, 307),
      payload.slice(307),
    ]);
    const states: Array<{ text: string; hasResult: boolean }> = [];

    const finalState = await consumeSetupAgentStream(response, (state) => {
      states.push({ text: state.text, hasResult: Boolean(state.result) });
    });

    expect(states.some((state) => state.text === "I mapped ")).toBe(true);
    expect(finalState.text).toBe("I mapped your organization.");
    expect(finalState.result).toEqual(result);
  });

  it("delivers a clarification without producing a workspace result", async () => {
    const clarification = {
      stage: "ORGANIZATION" as const,
      assistantMessage: "What is your organization called, and which teams should I include?",
      missingInformation: ["Organization name", "Organizational units"],
    };
    const response = responseFromPieces([
      event({ type: "start", messageId: "assistant-1" }),
      event({ type: "start-step" }),
      event({ type: "tool-input-start", toolCallId: "call-1", toolName: "askClarification" }),
      event({ type: "tool-input-delta", toolCallId: "call-1", inputTextDelta: '{"assistantMessage":"What is your organization called?' }),
      event({ type: "tool-input-available", toolCallId: "call-1", toolName: "askClarification", input: { assistantMessage: clarification.assistantMessage, missingInformation: clarification.missingInformation } }),
      event({ type: "tool-output-available", toolCallId: "call-1", output: clarification }),
      event({ type: "finish-step" }),
      event({ type: "finish", finishReason: "tool-calls" }),
      "data: [DONE]\n\n",
    ]);
    const states: Array<{ mode?: string; hasResult: boolean }> = [];

    const finalState = await consumeSetupAgentStream(response, (state) => {
      states.push({ mode: state.mode, hasResult: Boolean(state.result) });
    });

    expect(states.some((state) => state.mode === "clarification")).toBe(true);
    expect(states.every((state) => !state.hasResult)).toBe(true);
    expect(finalState.text).toBe(clarification.assistantMessage);
    expect(finalState.clarification).toEqual(clarification);
    expect(finalState.result).toBeUndefined();
  });

  it("surfaces errors from the standard UI message stream", async () => {
    const response = responseFromPieces([
      event({ type: "start", messageId: "assistant-1" }),
      event({ type: "error", errorText: "Provider failed" }),
      "data: [DONE]\n\n",
    ]);

    await expect(consumeSetupAgentStream(response, () => undefined)).rejects.toThrow("Provider failed");
  });
});
