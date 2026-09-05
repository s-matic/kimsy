import { describe, expect, it } from "vitest";
import { consumeSetupStream, encodeSetupStreamEvent, type SetupStreamEvent } from "@/lib/ai/setup-stream";

describe("setup stream", () => {
  it("delivers assistant deltas before the validated result across arbitrary chunks", async () => {
    const encoder = new TextEncoder();
    const result = {
      assistantMessage: "Hello there",
      configuration: {
        organizationName: "Example",
        units: [],
        review: { mode: "SOLO" as const, assessorName: "", reviewerName: "" },
        scenarios: [],
        fields: [],
        calculations: [],
        finalRatingFieldId: "",
      },
      warnings: [],
      sources: [],
    };
    const firstChunk = encodeSetupStreamEvent({ type: "assistant-delta", delta: "Hello " });
    const remainingPayload = [
      encodeSetupStreamEvent({ type: "assistant-delta", delta: "there" }),
      encodeSetupStreamEvent({ type: "result", result }),
    ].join("");
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const response = new Response(new ReadableStream({
      start(controller) {
        streamController = controller;
        controller.enqueue(encoder.encode(firstChunk));
      },
    }));
    const events: Array<Exclude<SetupStreamEvent, { type: "error" }>> = [];
    let markFirstEventReceived: (() => void) | undefined;
    const firstEventReceived = new Promise<void>((resolve) => { markFirstEventReceived = resolve; });

    const consumption = consumeSetupStream(response, (event) => {
      events.push(event);
      if (events.length === 1) markFirstEventReceived?.();
    });
    await firstEventReceived;

    expect(events.map((event) => event.type)).toEqual(["assistant-delta"]);

    streamController?.enqueue(encoder.encode(remainingPayload.slice(0, 26)));
    streamController?.enqueue(encoder.encode(remainingPayload.slice(26)));
    streamController?.close();
    await consumption;

    expect(events.map((event) => event.type)).toEqual(["assistant-delta", "assistant-delta", "result"]);
    expect(events.filter((event) => event.type === "assistant-delta").map((event) => event.delta).join("")).toBe("Hello there");
  });

  it("surfaces streamed provider errors", async () => {
    const response = new Response(encodeSetupStreamEvent({ type: "error", error: "Provider failed", code: "STREAM_ERROR" }));
    await expect(consumeSetupStream(response, () => undefined)).rejects.toThrow("Provider failed");
  });
});
