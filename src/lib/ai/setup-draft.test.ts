import { describe, expect, it } from "vitest";
import { createSetupDraftResult } from "@/lib/ai/setup-draft";
import { sampleConfiguration } from "@/lib/seed";

describe("setup draft tools", () => {
  it("preserves untouched configuration and always disables multiplayer review", () => {
    const result = createSetupDraftResult({
      stage: "ORGANIZATION",
      configuration: sampleConfiguration,
      sources: [],
    }, {
      organizationName: "Revised Bank",
      units: [{ id: "group", name: "Group", parentId: null, description: "Top level" }],
    }, []);

    expect(result.configuration.organizationName).toBe("Revised Bank");
    expect(result.configuration.review).toEqual({
      mode: "SOLO",
      assessorName: sampleConfiguration.review.assessorName,
      reviewerName: "",
    });
    expect(result.configuration.scenarios).toEqual(sampleConfiguration.scenarios);
    expect(result.configuration.fields).toEqual(sampleConfiguration.fields);
  });

  it("adds stage-relevant semantic warnings without duplicating model warnings", () => {
    const warning = "Child references an unknown parent.";
    const result = createSetupDraftResult({
      stage: "ORGANIZATION",
      configuration: sampleConfiguration,
      sources: [],
    }, {
      units: [{ id: "child", name: "Child", parentId: "missing", description: "" }],
    }, [warning]);

    expect(result.warnings.filter((item) => item === warning)).toHaveLength(1);
  });
});
