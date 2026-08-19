import type {
  AssessmentRow,
  CalculationDefinition,
  FieldDefinition,
  FieldValue,
  WorkspaceConfiguration,
} from "@/lib/types";

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

export function validateConfiguration(configuration: WorkspaceConfiguration) {
  const errors: string[] = [];
  const fields = new Map(configuration.fields.map((field) => [field.id, field]));
  const outputs = new Set<string>();
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

  configuration.calculations.forEach((calculation) => {
    const output = fields.get(calculation.outputFieldId);
    if (!output) errors.push(`Calculation ${calculation.id} has an unknown output field.`);
    else if (output.type !== "CALCULATED") errors.push(`${output.label} must be a calculated field.`);
    if (outputs.has(calculation.outputFieldId)) errors.push(`Only one calculation may write to ${calculation.outputFieldId}.`);
    outputs.add(calculation.outputFieldId);

    if (calculation.type === "MATRIX") {
      const row = fields.get(calculation.rowFieldId);
      const column = fields.get(calculation.columnFieldId);
      if (!row || !column) errors.push(`Matrix ${calculation.id} references an unknown field.`);
      const rowValues = row?.options.map((option) => option.id) ?? [];
      const columnValues = column?.options.map((option) => option.id) ?? [];
      if (rowValues.length && columnValues.length) {
        rowValues.forEach((rowValue) => columnValues.forEach((columnValue) => {
          if (!calculation.cells.some((cell) => cell.rowValue === rowValue && cell.columnValue === columnValue)) {
            errors.push(`Matrix ${calculation.id} is missing ${rowValue} × ${columnValue}.`);
          }
        }));
      }
    } else {
      if (!calculation.terms.length) errors.push(`Threshold ${calculation.id} needs at least one input.`);
      if (!calculation.bands.length) errors.push(`Threshold ${calculation.id} needs at least one band.`);
      calculation.terms.forEach((term) => {
        if (!fields.has(term.fieldId)) errors.push(`Threshold ${calculation.id} references an unknown field.`);
      });
      const sorted = [...calculation.bands].sort((a, b) => a.min - b.min);
      sorted.slice(1).forEach((band, index) => {
        if (band.min <= sorted[index].max) errors.push(`Threshold ${calculation.id} has overlapping bands.`);
      });
    }
  });

  const { hasCycle } = orderedCalculations(configuration);
  if (hasCycle) errors.push("Calculated fields contain a circular dependency.");
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
