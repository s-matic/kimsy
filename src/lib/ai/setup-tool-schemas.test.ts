import { describe, expect, it } from "vitest";
import { z } from "zod";
import { setupToolInputSchemas } from "@/lib/ai/setup-tool-schemas";

describe("setup tool schemas", () => {
  it("do not emit OpenAI-incompatible oneOf definitions", () => {
    Object.values(setupToolInputSchemas).forEach((schema) => {
      expect(JSON.stringify(z.toJSONSchema(schema))).not.toContain('"oneOf"');
    });
  });
});
