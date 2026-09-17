import { describe, expect, it } from "vitest";
import { z } from "zod";
import { compliancePlanChangeSchema } from "@/lib/ai/compliance-plan-contract";

describe("compliance plan tool schema", () => {
  it("does not emit OpenAI-incompatible oneOf definitions", () => {
    expect(JSON.stringify(z.toJSONSchema(compliancePlanChangeSchema))).not.toContain('"oneOf"');
  });
});
