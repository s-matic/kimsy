import { describe, expect, it } from "vitest";
import { buildAssessmentPdf } from "@/lib/report";
import { initialState } from "@/lib/seed";

describe("management report", () => {
  it("generates a valid PDF snapshot", async () => {
    const assessment = initialState.assessments[0];
    const bytes = await buildAssessmentPdf(
      initialState.organization,
      assessment,
      initialState.frameworkVersions[0],
    );
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
