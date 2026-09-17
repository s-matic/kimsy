import { compliancePlanAgentMessages, createCompliancePlanAgent } from "@/lib/ai/agents/compliance-plan-agent";
import { AiNotConfiguredError } from "@/lib/ai";
import { prepareAiInput } from "@/lib/ai/source-input";
import type { CompliancePlan } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const message = String(formData.get("message") ?? "");
    const unitId = String(formData.get("unitId") ?? "");
    const unitName = String(formData.get("unitName") ?? "");
    const complianceOwner = String(formData.get("complianceOwner") ?? "Workspace owner");
    const plan = JSON.parse(String(formData.get("plan") ?? "{}")) as CompliancePlan;
    if (!plan.id || !unitId || !plan.unitIds?.includes(unitId) || !plan.unitThreads?.[unitId]) throw new Error("A valid unit-scoped compliance plan is required.");
    if (!message.trim() && !formData.getAll("files").length) throw new Error("Add a message or at least one source file.");

    const prepared = await prepareAiInput(formData);
    const context = { plan, unitId, unitName, complianceOwner, sources: prepared.sources };
    const agent = createCompliancePlanAgent(context);
    const result = await agent.stream({
      messages: compliancePlanAgentMessages({ ...context, message, sourceInput: prepared.input }),
      abortSignal: request.signal,
    });
    return result.toUIMessageStreamResponse({
      onError: (error) => error instanceof Error ? error.message : "Kimsy could not draft the compliance plan.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to draft the compliance plan.";
    const status = error instanceof AiNotConfiguredError ? 503 : 422;
    return Response.json({ error: message, code: error instanceof AiNotConfiguredError ? "AI_NOT_CONFIGURED" : "INVALID_REQUEST" }, { status });
  }
}
