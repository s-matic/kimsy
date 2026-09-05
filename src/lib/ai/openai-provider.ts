import "server-only";
import { parsePartialJson } from "ai";
import OpenAI from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { zodTextFormat } from "openai/helpers/zod";
import { assessmentAiOutputSchema, onboardingAiOutputSchema } from "@/lib/ai/schema";
import type {
  AssessInput,
  ConfigureInput,
  ConfigureStreamEvent,
  ConfigureStreamOptions,
  WorkspaceAiProvider,
} from "@/lib/ai/provider";
import type { OnboardingAiOutput } from "@/lib/ai/schema";

function userContent(text: string, images: ResponseInputContent[]): ResponseInputContent[] {
  return [{ type: "input_text", text }, ...images];
}

function partialAssistantMessage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const assistantMessage = (value as Record<string, unknown>).assistantMessage;
  return typeof assistantMessage === "string" ? assistantMessage : null;
}

function hasCompleteJsonStringProperty(value: string, property: string) {
  const propertyIndex = value.indexOf(`"${property}"`);
  if (propertyIndex === -1) return false;
  const colonIndex = value.indexOf(":", propertyIndex + property.length + 2);
  if (colonIndex === -1) return false;
  let index = colonIndex + 1;
  while (/\s/.test(value[index] ?? "")) index += 1;
  if (value[index] !== '"') return false;
  let escaped = false;
  for (index += 1; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === '"') {
      return true;
    }
  }
  return false;
}

export class OpenAiWorkspaceProvider implements WorkspaceAiProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = process.env.OPENAI_MODEL ?? "gpt-5.4-nano") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async configure(input: ConfigureInput) {
    let result: OnboardingAiOutput | undefined;
    for await (const event of this.configureStream(input)) {
      if (event.type === "result") result = event.result;
    }
    if (!result) throw new Error("The model did not return a valid workspace configuration.");
    return result;
  }

  async *configureStream(
    input: ConfigureInput,
    options: ConfigureStreamOptions = {},
  ): AsyncGenerator<ConfigureStreamEvent> {
    const stream = this.client.responses.stream({
      model: this.model,
      instructions: [
        "You configure a small, practical compliance risk assessment workspace for one primary risk or compliance professional.",
        `The current onboarding stage is ${input.stage}.`,
        "This is one continuous setup conversation. Respond naturally and concisely, explain what you inferred, and invite the user to review the inline component or correct you.",
        "Return the complete configuration every time, preserving valid IDs and content outside the current stage unless the user explicitly asks to change it.",
        "Multiplayer review is not enabled. Always set review.mode to SOLO, keep reviewerName empty, and configure exactly one assessment owner.",
        "Use stable lowercase kebab-case IDs. Parent IDs must reference units in the returned configuration.",
        "Risk scenarios must be faithful to the supplied customer material and retain specific source names and locators.",
        "Assessment fields may be typed text, number, boolean, select, multiselect, or calculated fields.",
        "Calculated ratings must use explicit MATRIX or THRESHOLD definitions. MATRIX cells must cover every option combination.",
        "Never invent legal requirements. Call out ambiguity or missing information in warnings.",
        "Keep the design small enough to be pleasant to use; prefer the customer's existing methodology over generic GRC conventions.",
      ].join(" "),
      input: [{
        role: "user",
        content: userContent([
          `User request: ${input.message || "Interpret the supplied material and propose this onboarding step."}`,
          `Conversation so far:\n${input.conversation || "This is the first user message."}`,
          `Current configuration: ${JSON.stringify(input.configuration)}`,
          `Extracted source material:\n${input.sources.text || "No text source supplied."}`,
        ].join("\n\n"), input.sources.images),
      }],
      text: { format: zodTextFormat(onboardingAiOutputSchema, "kimsy_workspace_configuration") },
    }, { signal: options.signal });

    let accumulatedOutput = "";
    let emittedMessage = "";
    let messageComplete = false;
    let completed = false;

    try {
      for await (const event of stream) {
        if (event.type !== "response.output_text.delta" || messageComplete) continue;
        accumulatedOutput += event.delta;
        const partial = partialAssistantMessage((await parsePartialJson(accumulatedOutput)).value);
        if (partial && partial.startsWith(emittedMessage) && partial.length > emittedMessage.length) {
          const delta = partial.slice(emittedMessage.length);
          emittedMessage = partial;
          yield { type: "assistant-delta", delta };
        }
        messageComplete = hasCompleteJsonStringProperty(accumulatedOutput, "assistantMessage");
      }

      const response = await stream.finalResponse();
      const result = response.output_parsed;
      if (!result) throw new Error("The model did not return a valid workspace configuration.");
      if (result.assistantMessage.startsWith(emittedMessage) && result.assistantMessage.length > emittedMessage.length) {
        yield { type: "assistant-delta", delta: result.assistantMessage.slice(emittedMessage.length) };
      }
      completed = true;
      yield { type: "result", result };
    } finally {
      if (!completed) stream.abort();
    }
  }

  async assess(input: AssessInput) {
    const editableFields = input.configuration.fields.filter((field) => field.type !== "CALCULATED");
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: [
        "You assist one compliance or risk professional with a practical assessment.",
        "Use only the supplied organizational unit, configured scenarios, assessment fields, conversation, and source material.",
        "Return proposed changes only; never claim that values were saved or approved.",
        "Only use scenario IDs and editable field IDs supplied in the request. Never set calculated fields.",
        "Use select option IDs, not labels, as select values.",
        "Mark a scenario not applicable only when the supplied facts support that conclusion.",
        "Give concise judgment-based rationales and cite source names with precise page, paragraph, sheet, row, or image locators.",
        "When information is insufficient, leave values null and explain the gap in warnings rather than guessing.",
      ].join(" "),
      input: [{
        role: "user",
        content: userContent([
          `User request: ${input.message || "Assess the attached material."}`,
          `Workspace configuration: ${JSON.stringify({ ...input.configuration, fields: editableFields })}`,
          `Current assessment: ${JSON.stringify(input.assessment)}`,
          `Extracted source material:\n${input.sources.text || "No new text source supplied."}`,
        ].join("\n\n"), input.sources.images),
      }],
      text: { format: zodTextFormat(assessmentAiOutputSchema, "kimsy_register_change_proposal") },
    });

    if (!response.output_parsed) throw new Error("The model did not return a valid register proposal.");
    const scenarioIds = new Set(input.configuration.scenarios.map((scenario) => scenario.id));
    const fieldIds = new Set(editableFields.map((field) => field.id));
    for (const change of response.output_parsed.changes) {
      if (!scenarioIds.has(change.scenarioId)) throw new Error("The model proposed an unknown risk scenario.");
      if (change.values.some((value) => !fieldIds.has(value.fieldId))) {
        throw new Error("The model proposed an unknown or calculated assessment field.");
      }
    }
    return response.output_parsed;
  }
}
