import type { z } from "zod";
import { assessmentRowInputSchema } from "@/lib/ai/schema";
import type { WorkspaceConfiguration } from "@/lib/types";

export interface AssessmentProposalInput {
  assistantMessage: string;
  summary: string;
  changes: Array<z.infer<typeof assessmentRowInputSchema>>;
  warnings: string[];
}

export function validateAssessmentProposal(configuration: WorkspaceConfiguration, scenarioId: string, proposal: AssessmentProposalInput) {
  const editableFields = configuration.fields.filter((field) => field.type !== "CALCULATED");
  const fields = new Map(editableFields.map((field) => [field.id, field]));
  if (proposal.changes.length > 1) throw new Error("The assessment agent proposed more than one change for the open risk scenario.");

  for (const change of proposal.changes) {
    if (change.scenarioId !== scenarioId) throw new Error("The assessment agent proposed a change outside the open risk scenario.");
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
