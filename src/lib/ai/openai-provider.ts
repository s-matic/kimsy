import "server-only";
import OpenAI from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { zodTextFormat } from "openai/helpers/zod";
import { assessmentAiOutputSchema, onboardingAiOutputSchema } from "@/lib/ai/schema";
import type { AssessInput, ConfigureInput, WorkspaceAiProvider } from "@/lib/ai/provider";

function userContent(text: string, images: ResponseInputContent[]): ResponseInputContent[] {
  return [{ type: "input_text", text }, ...images];
}

export class OpenAiWorkspaceProvider implements WorkspaceAiProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = process.env.OPENAI_MODEL ?? "gpt-5.4-nano") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async configure(input: ConfigureInput) {
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: [
        "You configure a small, practical compliance risk assessment workspace for one primary risk or compliance professional.",
        `The current onboarding stage is ${input.stage}.`,
        "Return the complete configuration every time, preserving valid IDs and content outside the current stage unless the user explicitly asks to change it.",
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
          `Current configuration: ${JSON.stringify(input.configuration)}`,
          `Extracted source material:\n${input.sources.text || "No text source supplied."}`,
        ].join("\n\n"), input.sources.images),
      }],
      text: { format: zodTextFormat(onboardingAiOutputSchema, "kimsy_workspace_configuration") },
    });

    if (!response.output_parsed) throw new Error("The model did not return a valid workspace configuration.");
    return response.output_parsed;
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
