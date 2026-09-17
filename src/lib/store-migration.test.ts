import { describe, expect, it } from "vitest";
import { migrateState } from "@/lib/store";
import { sampleState } from "@/lib/seed";

describe("workspace storage migration", () => {
  it("moves version 2 assessment data into isolated scenario threads", () => {
    const assessment = sampleState.assessments[0];
    const legacyAssessment = Object.fromEntries(Object.entries(assessment).filter(([key]) => !["scenarioThreads", "auditEvents", "initialBrief"].includes(key)));
    const pendingProposal = {
      id: "legacy-proposal",
      summary: "Legacy changes",
      warnings: [],
      createdAt: "Just now",
      changes: ["scenario-cdd", "scenario-monitoring"].map((scenarioId) => ({
        scenarioId,
        applicable: true,
        values: [],
        rationale: "Legacy rationale",
        citations: [],
      })),
    };
    const legacy = {
      ...sampleState,
      version: 2,
      assessments: [{
        ...legacyAssessment,
        messages: [{ id: "legacy-message", role: "USER", text: "Legacy context", createdAt: "Today" }],
        sources: [{ id: "legacy-source", name: "legacy.pdf", mediaType: "application/pdf", size: 10, locators: ["page 1"], addedAt: "Today" }],
        pendingProposal,
      }],
    };

    const migrated = migrateState(legacy as never);
    const result = migrated.assessments[0];

    expect(migrated.version).toBe(4);
    expect(migrated.compliancePlans).toEqual([]);
    expect(result.auditEvents).toEqual([]);
    expect(Object.keys(result.scenarioThreads)).toEqual(sampleState.configuration.scenarios.map((scenario) => scenario.id));
    expect(result.scenarioThreads["scenario-cdd"].messages[0].text).toBe("Legacy context");
    expect(result.scenarioThreads["scenario-cdd"].sources[0].name).toBe("legacy.pdf");
    expect(result.scenarioThreads["scenario-cdd"].pendingProposal?.changes).toHaveLength(1);
    expect(result.scenarioThreads["scenario-monitoring"].pendingProposal?.changes[0].scenarioId).toBe("scenario-monitoring");
    expect(result.scenarioThreads["scenario-conduct"].messages).toEqual([]);
  });
});
