import { describe, expect, it } from "vitest";
import { calculateValues, orderedCalculations, validateConfiguration } from "@/lib/scoring";
import { sampleConfiguration } from "@/lib/seed";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("configurable assessment scoring", () => {
  it("accepts the complete sample methodology", () => {
    expect(validateConfiguration(sampleConfiguration)).toEqual([]);
  });

  it("chains inherent and residual risk matrices deterministically", () => {
    const values = calculateValues(sampleConfiguration, {
      likelihood: "likely",
      "financial-impact": "major",
      "control-effectiveness": "weak",
    });
    expect(values["inherent-risk"]).toBe("high");
    expect(values["residual-risk"]).toBe("high");
  });

  it("returns null calculated values while an input is missing", () => {
    const values = calculateValues(sampleConfiguration, {
      likelihood: "likely",
      "financial-impact": "major",
    });
    expect(values["inherent-risk"]).toBe("high");
    expect(values["residual-risk"]).toBeNull();
  });

  it("orders calculations by dependency even if their configured order is reversed", () => {
    const configuration = clone(sampleConfiguration);
    configuration.calculations.reverse();
    expect(orderedCalculations(configuration).ordered.map((item) => item.id)).toEqual(["calc-inherent", "calc-residual"]);
    expect(calculateValues(configuration, {
      likelihood: "almost-certain",
      "financial-impact": "critical",
      "control-effectiveness": "adequate",
    })["residual-risk"]).toBe("high");
  });

  it("reports incomplete matrices", () => {
    const configuration = clone(sampleConfiguration);
    const matrix = configuration.calculations[0];
    if (matrix.type === "MATRIX") matrix.cells.pop();
    expect(validateConfiguration(configuration).some((error) => error.includes("is missing"))).toBe(true);
  });

  it("reports matrix cells without a valid output rating", () => {
    const configuration = clone(sampleConfiguration);
    const matrix = configuration.calculations[0];
    if (matrix.type === "MATRIX") matrix.cells[0].result = "";
    expect(validateConfiguration(configuration).some((error) => error.includes("need a valid rating"))).toBe(true);
  });

  it("reports calculated fields without a calculation method", () => {
    const configuration = clone(sampleConfiguration);
    configuration.calculations = configuration.calculations.filter((calculation) => calculation.outputFieldId !== "residual-risk");
    expect(validateConfiguration(configuration)).toContain("Residual risk needs a calculation method.");
  });

  it("reports circular calculated-field dependencies", () => {
    const configuration = clone(sampleConfiguration);
    const first = configuration.calculations[0];
    if (first.type === "MATRIX") first.rowFieldId = "residual-risk";
    expect(validateConfiguration(configuration)).toContain("Calculated fields contain a circular dependency.");
  });

  it("reports organizational units whose parent does not exist", () => {
    const configuration = clone(sampleConfiguration);
    configuration.units[0].parentId = "missing-unit";
    expect(validateConfiguration(configuration)).toContain("Retail Banking references an unknown parent.");
  });

  it("reports circular organizational hierarchies", () => {
    const configuration = clone(sampleConfiguration);
    configuration.units[0].parentId = "unit-payments";
    expect(validateConfiguration(configuration)).toContain("Organization hierarchy contains a circular parent relationship.");
  });

  it("supports weighted threshold bands", () => {
    const configuration = clone(sampleConfiguration);
    configuration.fields.push({ id: "aggregate", label: "Aggregate", helpText: "", type: "CALCULATED", required: true, options: [
      { id: "low", label: "Low", score: 1 },
      { id: "high", label: "High", score: 2 },
    ] });
    configuration.calculations.push({
      id: "calc-aggregate",
      type: "THRESHOLD",
      outputFieldId: "aggregate",
      terms: [{ fieldId: "likelihood", weight: 2 }, { fieldId: "financial-impact", weight: 1 }],
      bands: [{ min: 0, max: 7, result: "low" }, { min: 7.01, max: 12, result: "high" }],
    });
    expect(calculateValues(configuration, { likelihood: "likely", "financial-impact": "major" }).aggregate).toBe("high");
  });

  it("reports reachable weighted scores that have no rating band", () => {
    const configuration = clone(sampleConfiguration);
    configuration.fields.push({ id: "aggregate", label: "Aggregate", helpText: "", type: "CALCULATED", required: true, options: [
      { id: "low", label: "Low", score: 1 },
      { id: "high", label: "High", score: 2 },
    ] });
    configuration.calculations.push({ id: "calc-aggregate", type: "THRESHOLD", outputFieldId: "aggregate", terms: [{ fieldId: "likelihood", weight: 1 }], bands: [{ min: 0, max: 1, result: "low" }] });
    expect(validateConfiguration(configuration).some((error) => error.includes("without a rating band"))).toBe(true);
  });
});
