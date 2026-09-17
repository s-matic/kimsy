import type { CompliancePlan, CompliancePlanChange } from "@/lib/types";

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

export function validateCompliancePlanChanges(plan: CompliancePlan, unitId: string, changes: CompliancePlanChange[]) {
  if (!plan.unitIds.includes(unitId)) throw new Error("The planning agent was scoped to an unknown unit.");
  if (changes.length > 30) throw new Error("The planning agent proposed too many changes at once.");
  const sourceScenarioIds = new Set(plan.sources.filter((source) => source.unitId === unitId).flatMap((source) => source.risks.map((risk) => risk.scenarioId)));
  const activities = new Map(plan.activities.filter((activity) => activity.unitId === unitId).map((activity) => [activity.id, activity]));

  for (const change of changes) {
    if (change.operation !== "ADD" && !activities.has(change.activityId)) throw new Error("The planning agent referenced an activity outside the selected unit.");
    if (change.operation === "ADD" && change.activityId) throw new Error("New compliance activities must not provide an existing activity ID.");
    if (change.operation === "REMOVE") continue;
    if (!change.title.trim() || !change.objective.trim() || !change.inclusionRationale.trim()) throw new Error("Proposed compliance activities require a title, objective, and inclusion rationale.");
    if (!change.sourceScenarioIds.length || change.sourceScenarioIds.some((scenarioId) => !sourceScenarioIds.has(scenarioId))) {
      throw new Error("The planning agent referenced an unknown assessment scenario.");
    }
    if (!validDate(change.startDate) || !validDate(change.endDate) || change.startDate > change.endDate) throw new Error("The planning agent proposed an invalid schedule.");
    if (change.startDate < plan.startDate || change.endDate > plan.endDate) throw new Error("The planning agent proposed dates outside the compliance plan period.");
  }
}
