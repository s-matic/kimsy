import type { z } from "zod";
import { assessmentRowInputSchema } from "@/lib/ai/schema";
import type { WorkspaceConfiguration } from "@/lib/types";

export interface AssessmentProposalInput {
  assistantMessage: string;
  summary: string;
  changes: Array<z.infer<typeof assessmentRowInputSchema>>;
  warnings: string[];
}

export function validateAssessmentProposal(configuration: WorkspaceConfiguration, proposal: AssessmentProposalInput) {
  const editableFields = configuration.fields.filter((field) => field.type !== "CALCULATED");
  const scenarioIds = new Set(configuration.scenarios.map((scenario) => scenario.id));
  const fields = new Map(editableFields.map((field) => [field.id, field]));

  for (const change of proposal.changes) {
    if (!scenarioIds.has(change.scenarioId)) throw new Error("The assessment agent proposed an unknown risk scenario.");
    for (const value of change.values) {
      const field = fields.get(value.fieldId);
      if (!field) throw new Error("The assessment agent proposed an unknown or calculated assessment field.");
      if ((field.type === "SINGLE_SELECT" || field.type === "MULTI_SELECT") && value.value !== null) {
        const values = Array.isArray(value.value) ? value.value : [value.value];
        const optionIds = new Set(field.options.map((option) => option.id));
        if (values.some((item) => typeof item !== "string" || !optionIds.has(item))) {
          throw new Error(`The assessment agent proposed an invalid option for ${field.label}.`);
        }
      }
    }
  }
}
