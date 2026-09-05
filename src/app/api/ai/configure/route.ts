import { AiNotConfiguredError, getWorkspaceAiProvider } from "@/lib/ai";
import { onboardingStageSchema, workspaceConfigurationSchema } from "@/lib/ai/schema";
import { encodeSetupStreamEvent, type SetupStreamEvent } from "@/lib/ai/setup-stream";
import { prepareAiInput } from "@/lib/ai/source-input";
import { validateConfiguration } from "@/lib/scoring";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const stage = onboardingStageSchema.parse(formData.get("stage"));
    const message = String(formData.get("message") ?? "");
    const conversation = String(formData.get("conversation") ?? "");
    const configuration = workspaceConfigurationSchema.parse(JSON.parse(String(formData.get("configuration") ?? "{}")));
    const prepared = await prepareAiInput(formData);
    const provider = getWorkspaceAiProvider();
    const iterator = provider.configureStream(
      { stage, message, conversation, configuration, sources: prepared.input },
      { signal: request.signal },
    )[Symbol.asyncIterator]();
    const encoder = new TextEncoder();
    let cancelled = false;

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        void (async () => {
          try {
            while (!cancelled) {
              const next = await iterator.next();
              if (next.done) break;
              let event: SetupStreamEvent;
              if (next.value.type === "assistant-delta") {
                event = next.value;
              } else {
                const result = next.value.result;
                const soloConfiguration = {
                  ...result.configuration,
                  review: { ...result.configuration.review, mode: "SOLO" as const, reviewerName: "" },
                };
                const semanticWarnings = validateConfiguration(soloConfiguration).filter((warning) => {
                  if (stage === "ORGANIZATION") return /organization|unit|hierarchy|parent/i.test(warning);
                  if (stage === "WORKFLOW") return /owner|reviewer|assessor/i.test(warning);
                  if (stage === "SCENARIOS") return /scenario/i.test(warning);
                  return !/organization|unit|hierarchy|parent|scenario/i.test(warning);
                });
                event = {
                  type: "result",
                  result: {
                    ...result,
                    configuration: soloConfiguration,
                    warnings: [...new Set([...result.warnings, ...semanticWarnings])],
                    sources: prepared.sources,
                  },
                };
              }
              if (!cancelled) controller.enqueue(encoder.encode(encodeSetupStreamEvent(event)));
            }
          } catch (error) {
            if (!cancelled && !request.signal.aborted) {
              const message = error instanceof Error ? error.message : "Unable to configure the workspace.";
              controller.enqueue(encoder.encode(encodeSetupStreamEvent({ type: "error", error: message, code: "STREAM_ERROR" })));
            }
          } finally {
            if (!cancelled) controller.close();
          }
        })();
      },
      async cancel() {
        cancelled = true;
        await iterator.return?.(undefined);
      },
    });

    return new Response(body, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to configure the workspace.";
    const status = error instanceof AiNotConfiguredError ? 503 : 422;
    return Response.json({ error: message, code: error instanceof AiNotConfiguredError ? "AI_NOT_CONFIGURED" : "INVALID_REQUEST" }, { status });
  }
}
