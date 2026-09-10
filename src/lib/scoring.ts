import type {
  AssessmentRow,
  CalculationDefinition,
  FieldDefinition,
  FieldValue,
  WorkspaceConfiguration,
} from "@/lib/types";
import { allowedWebSourceErrors } from "@/lib/web-source-policy";

function valuesEqual(left: FieldValue, right: FieldValue) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function fieldScore(field: FieldDefinition | undefined, value: FieldValue): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || !field) return null;
  const option = field.options.find((item) => item.id === value || item.label === value);
  return option?.score ?? null;
}

function dependencies(calculation: CalculationDefinition) {
  return calculation.type === "MATRIX"
    ? [calculation.rowFieldId, calculation.columnFieldId]
    : calculation.terms.map((term) => term.fieldId);
}

function reachableThresholdScores(calculation: Extract<CalculationDefinition, { type: "THRESHOLD" }>, fields: Map<string, FieldDefinition>) {
  let totals = [0];
  for (const term of calculation.terms) {
    const field = fields.get(term.fieldId);
    if (!field || field.type === "NUMBER") return null;
    const scores = field.options.map((option) => option.score).filter((score): score is number => typeof score === "number");
    if (!scores.length || scores.length !== field.options.length || totals.length * scores.length > 4096) return null;
    totals = [...new Set(totals.flatMap((total) => scores.map((score) => total + score * term.weight)))];
  }
  return totals;
}

export function orderedCalculations(configuration: WorkspaceConfiguration) {
  const byOutput = new Map(configuration.calculations.map((calculation) => [calculation.outputFieldId, calculation]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: CalculationDefinition[] = [];
  let hasCycle = false;

  const visit = (calculation: CalculationDefinition) => {
    if (visiting.has(calculation.outputFieldId)) {
      hasCycle = true;
      return;
    }
    if (visited.has(calculation.outputFieldId)) return;
    visiting.add(calculation.outputFieldId);
    dependencies(calculation).forEach((fieldId) => {
      const dependency = byOutput.get(fieldId);
      if (dependency) visit(dependency);
    });
    visiting.delete(calculation.outputFieldId);
    visited.add(calculation.outputFieldId);
    ordered.push(calculation);
  };

  configuration.calculations.forEach(visit);
  return { ordered, hasCycle };
}

export function calculationValidationErrors(configuration: WorkspaceConfiguration) {
  const errors: string[] = [];
  const fields = new Map(configuration.fields.map((field) => [field.id, field]));
  const outputs = new Set<string>();

  configuration.calculations.forEach((calculation) => {
    const output = fields.get(calculation.outputFieldId);
    const calculationName = output?.label || calculation.id;
    if (!output) errors.push(`Calculation ${calculation.id} has an unknown output field.`);
    else {
      if (output.type !== "CALCULATED") errors.push(`${output.label} must be a calculated field.`);
      if (!output.options.length) errors.push(`${output.label} needs at least one possible result.`);
    }
    if (outputs.has(calculation.outputFieldId)) errors.push(`Only one calculation may write to ${calculationName}.`);
    outputs.add(calculation.outputFieldId);

    const validResults = new Set(output?.options.map((option) => option.id) ?? []);
    if (calculation.type === "MATRIX") {
      const row = fields.get(calculation.rowFieldId);
      const column = fields.get(calculation.columnFieldId);
      if (!row || !column) errors.push(`${calculationName} references an unknown matrix input.`);
      if (row && column && row.id === column.id) errors.push(`${calculationName} needs two different matrix inputs.`);
      if (row?.type === "MULTI_SELECT" || column?.type === "MULTI_SELECT") errors.push(`${calculationName} cannot use a multi-select field as a matrix input.`);
      if (row && !row.options.length) errors.push(`${row.label} needs options before it can be used in a matrix.`);
      if (column && !column.options.length) errors.push(`${column.label} needs options before it can be used in a matrix.`);

      const rowValues = row?.options.map((option) => option.id) ?? [];
      const columnValues = column?.options.map((option) => option.id) ?? [];
      const expectedKeys = rowValues.flatMap((rowValue) => columnValues.map((columnValue) => `${rowValue}\u0000${columnValue}`));
      const cellCounts = new Map<string, number>();
      calculation.cells.forEach((cell) => {
        const key = `${cell.rowValue}\u0000${cell.columnValue}`;
        cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
      });
      const missing = expectedKeys.filter((key) => !cellCounts.has(key)).length;
      const duplicates = expectedKeys.filter((key) => (cellCounts.get(key) ?? 0) > 1).length;
      const invalid = calculation.cells.filter((cell) => expectedKeys.includes(`${cell.rowValue}\u0000${cell.columnValue}`) && !validResults.has(String(cell.result))).length;
      if (missing) errors.push(`${calculationName} is missing ${missing} matrix combination${missing === 1 ? "" : "s"}.`);
      if (duplicates) errors.push(`${calculationName} has ${duplicates} duplicate matrix combination${duplicates === 1 ? "" : "s"}.`);
      if (invalid) errors.push(`${calculationName} has ${invalid} matrix result${invalid === 1 ? "" : "s"} that need a valid rating.`);
    } else {
      if (!calculation.terms.length) errors.push(`${calculationName} needs at least one weighted input.`);
      if (!calculation.bands.length) errors.push(`${calculationName} needs at least one rating band.`);
      const termIds = new Set<string>();
      calculation.terms.forEach((term) => {
        const field = fields.get(term.fieldId);
        if (!field) errors.push(`${calculationName} references an unknown weighted input.`);
        else if (field.type === "MULTI_SELECT") errors.push(`${field.label} cannot be used as a weighted input.`);
        else if (field.type !== "NUMBER" && (!field.options.length || field.options.some((option) => typeof option.score !== "number"))) {
          errors.push(`${field.label} needs numeric option scores before it can be weighted.`);
        }
        if (termIds.has(term.fieldId)) errors.push(`${calculationName} uses the same weighted input more than once.`);
        termIds.add(term.fieldId);
        if (!Number.isFinite(term.weight) || term.weight <= 0) errors.push(`${calculationName} weights must be greater than zero.`);
      });
      calculation.bands.forEach((band) => {
        if (!Number.isFinite(band.min) || !Number.isFinite(band.max) || band.min > band.max) errors.push(`${calculationName} has an invalid rating band range.`);
        if (!validResults.has(String(band.result))) errors.push(`${calculationName} has a rating band without a valid result.`);
      });
      const sorted = [...calculation.bands].sort((a, b) => a.min - b.min);
      sorted.slice(1).forEach((band, index) => {
        if (band.min <= sorted[index].max) errors.push(`${calculationName} has overlapping rating bands.`);
      });
      const reachableScores = reachableThresholdScores(calculation, fields);
      const uncoveredScores = reachableScores?.filter((score) => !calculation.bands.some((band) => score >= band.min && score <= band.max)) ?? [];
      if (uncoveredScores.length) errors.push(`${calculationName} has ${uncoveredScores.length} possible weighted score${uncoveredScores.length === 1 ? "" : "s"} without a rating band.`);
    }
  });

  configuration.fields.filter((field) => field.type === "CALCULATED").forEach((field) => {
    if (!outputs.has(field.id)) errors.push(`${field.label} needs a calculation method.`);
  });
  const { hasCycle } = orderedCalculations(configuration);
  if (hasCycle) errors.push("Calculated fields contain a circular dependency.");
  return [...new Set(errors)];
}

export function validateConfiguration(configuration: WorkspaceConfiguration) {
  const errors: string[] = [];
  const fields = new Map(configuration.fields.map((field) => [field.id, field]));
  const unitIds = new Set<string>();

  if (!configuration.organizationName.trim()) errors.push("Organization name is required.");
  if (!configuration.units.length) errors.push("Add at least one organizational unit.");
  configuration.units.forEach((unit) => {
    if (!unit.name.trim()) errors.push("Every organizational unit needs a name.");
    if (unitIds.has(unit.id)) errors.push(`Organizational unit ID ${unit.id} is duplicated.`);
    unitIds.add(unit.id);
  });
  const unitsById = new Map(configuration.units.map((unit) => [unit.id, unit]));
  configuration.units.forEach((unit) => {
    if (unit.parentId === unit.id) errors.push(`${unit.name || unit.id} cannot be its own parent.`);
    else if (unit.parentId && !unitsById.has(unit.parentId)) errors.push(`${unit.name || unit.id} references an unknown parent.`);

    const lineage = new Set<string>();
    let current = unit;
    while (current.parentId) {
      if (lineage.has(current.id)) {
        errors.push("Organization hierarchy contains a circular parent relationship.");
        break;
      }
      lineage.add(current.id);
      const parent = unitsById.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
  });
  if (!configuration.scenarios.length) errors.push("Add at least one risk scenario.");
  if (!configuration.fields.length) errors.push("Add at least one assessment field.");
  if (!fields.has(configuration.finalRatingFieldId)) errors.push("Choose a valid final rating field.");
  errors.push(...allowedWebSourceErrors(configuration.agent?.allowedWebSources ?? []));

  errors.push(...calculationValidationErrors(configuration));
  return [...new Set(errors)];
}

export function calculateValues(
  configuration: WorkspaceConfiguration,
  initialValues: Record<string, FieldValue>,
) {
  const values = { ...initialValues };
  const fields = new Map(configuration.fields.map((field) => [field.id, field]));
  const { ordered, hasCycle } = orderedCalculations(configuration);
  if (hasCycle) return values;

  ordered.forEach((calculation) => {
    if (calculation.type === "MATRIX") {
      const rowValue = values[calculation.rowFieldId] ?? null;
      const columnValue = values[calculation.columnFieldId] ?? null;
      const cell = calculation.cells.find(
        (item) => valuesEqual(item.rowValue, rowValue) && valuesEqual(item.columnValue, columnValue),
      );
      values[calculation.outputFieldId] = cell?.result ?? null;
      return;
    }

    let total = 0;
    let complete = true;
    calculation.terms.forEach((term) => {
      const score = fieldScore(fields.get(term.fieldId), values[term.fieldId] ?? null);
      if (score === null) complete = false;
      else total += score * term.weight;
    });
    const band = complete
      ? calculation.bands.find((item) => total >= item.min && total <= item.max)
      : undefined;
    values[calculation.outputFieldId] = band?.result ?? null;
  });

  return values;
}

export function recalculateRow(row: AssessmentRow, configuration: WorkspaceConfiguration): AssessmentRow {
  return { ...row, values: calculateValues(configuration, row.values) };
}

export function explainCalculation(fieldId: string, values: Record<string, FieldValue>, configuration: WorkspaceConfiguration) {
  const calculation = configuration.calculations.find((item) => item.outputFieldId === fieldId);
  if (!calculation) return "Entered directly";
  const fields = new Map(configuration.fields.map((field) => [field.id, field]));
  if (calculation.type === "MATRIX") {
    const row = fields.get(calculation.rowFieldId)?.label ?? calculation.rowFieldId;
    const column = fields.get(calculation.columnFieldId)?.label ?? calculation.columnFieldId;
    return `${row} (${String(values[calculation.rowFieldId] ?? "—")}) × ${column} (${String(values[calculation.columnFieldId] ?? "—")})`;
  }
  return calculation.terms
    .map((term) => `${fields.get(term.fieldId)?.label ?? term.fieldId} × ${term.weight}`)
    .join(" + ");
}
