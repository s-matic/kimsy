import type {
  Assessment,
  ComplianceActivityOccurrence,
  ComplianceActivitySchedule,
  CompliancePlan,
  CompliancePlanSource,
  ComplianceRiskSnapshot,
  FieldDefinition,
  FieldValue,
  WorkspaceConfiguration,
} from "@/lib/types";

export function isFinalizedAssessment(assessment: Assessment) {
  return assessment.status === "COMPLETED" || assessment.status === "APPROVED";
}

export function latestFinalizedAssessments(assessments: Assessment[]) {
  const seen = new Set<string>();
  return assessments.filter((assessment) => {
    if (!isFinalizedAssessment(assessment) || seen.has(assessment.unitId)) return false;
    seen.add(assessment.unitId);
    return true;
  });
}

function displayValue(field: FieldDefinition | undefined, value: FieldValue) {
  if (value === null || value === undefined || value === "") return "Not rated";
  if (!field) return String(value);
  if (Array.isArray(value)) return value.map((item) => field.options.find((option) => option.id === item)?.label ?? item).join(", ");
  if (typeof value === "string") return field.options.find((option) => option.id === value)?.label ?? value;
  return String(value);
}

export function snapshotAssessment(assessment: Assessment, configuration: WorkspaceConfiguration): CompliancePlanSource {
  const ratingField = configuration.fields.find((field) => field.id === configuration.finalRatingFieldId);
  const capturedAt = new Date().toISOString();
  const risks: ComplianceRiskSnapshot[] = assessment.rows.filter((row) => row.applicable).flatMap((row) => {
    const scenario = configuration.scenarios.find((item) => item.id === row.scenarioId);
    if (!scenario) return [];
    const finalRating = row.values[configuration.finalRatingFieldId] ?? null;
    return [{
      assessmentId: assessment.id,
      rowId: row.id,
      scenarioId: row.scenarioId,
      unitId: assessment.unitId,
      period: assessment.period,
      code: scenario.code,
      title: scenario.title,
      category: scenario.category,
      finalRating,
      finalRatingLabel: displayValue(ratingField, finalRating),
      rationale: row.rationale,
      citations: row.citations,
      capturedAt,
    }];
  });
  return {
    assessmentId: assessment.id,
    unitId: assessment.unitId,
    period: assessment.period,
    status: assessment.status,
    capturedAt,
    risks,
  };
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonthsClamped(date: Date, months: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

function cadenceMonths(cadence: ComplianceActivitySchedule["cadence"]) {
  if (cadence === "MONTHLY") return 1;
  if (cadence === "QUARTERLY") return 3;
  if (cadence === "SEMIANNUAL") return 6;
  if (cadence === "ANNUAL") return 12;
  return 0;
}

export function generateOccurrences(
  activityId: string,
  schedule: ComplianceActivitySchedule,
  planStartDate: string,
  planEndDate: string,
  existing: ComplianceActivityOccurrence[] = [],
) {
  const start = parseDate(schedule.startDate);
  const planStart = parseDate(planStartDate);
  const planEnd = parseDate(planEndDate);
  const scheduleEnd = parseDate(schedule.endDate || planEndDate);
  if (!start || !planStart || !planEnd || !scheduleEnd) return [];
  const effectiveEnd = scheduleEnd > planEnd ? planEnd : scheduleEnd;
  const step = cadenceMonths(schedule.cadence);
  const dates: string[] = [];
  if (step === 0) {
    if (start < planStart || start > effectiveEnd) return [];
    dates.push(isoDate(start));
  }
  let index = 0;
  let cursor = start;
  while (step > 0 && cursor < planStart) {
    index += 1;
    cursor = addMonthsClamped(start, index * step);
  }
  while (step > 0 && cursor <= effectiveEnd) {
    dates.push(isoDate(cursor));
    index += 1;
    cursor = addMonthsClamped(start, index * step);
  }
  const prior = new Map(existing.map((occurrence) => [occurrence.dueDate, occurrence]));
  return dates.map((dueDate, index): ComplianceActivityOccurrence => prior.get(dueDate) ?? ({
    id: `occurrence-${activityId}-${dueDate}-${index}`,
    dueDate,
    status: "NOT_STARTED",
    outcome: "",
    evidence: [],
    completedAt: "",
  }));
}

export function planActivationErrors(plan: CompliancePlan) {
  const errors: string[] = [];
  if (!plan.activities.length) errors.push("Add at least one compliance activity.");
  plan.activities.forEach((activity) => {
    if (!activity.title.trim()) errors.push("Every activity needs a title.");
    if (!activity.owner.trim()) errors.push(`${activity.title || "Every activity"} needs an owner.`);
    if (!activity.occurrences.length) errors.push(`${activity.title || "Every activity"} needs a date inside the plan period.`);
  });
  return [...new Set(errors)];
}

export function planProgress(plan: CompliancePlan) {
  const occurrences = plan.activities.flatMap((activity) => activity.occurrences);
  const completed = occurrences.filter((item) => item.status === "COMPLETED").length;
  const terminal = occurrences.filter((item) => ["COMPLETED", "DEFERRED", "CANCELLED"].includes(item.status)).length;
  return { total: occurrences.length, completed, terminal, percent: occurrences.length ? Math.round((completed / occurrences.length) * 100) : 0 };
}
