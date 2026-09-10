import { describe, expect, it } from "vitest";
import { allowedWebSourceErrors, normalizeAllowedWebSource } from "@/lib/web-source-policy";

describe("web source policy", () => {
  it("normalizes domains and pasted URLs", () => {
    expect(normalizeAllowedWebSource("EBA.europa.eu")).toBe("eba.europa.eu");
    expect(normalizeAllowedWebSource("https://www.fi.se/en/published/")).toBe("www.fi.se");
  });

  it("rejects invalid and duplicate sources", () => {
    expect(allowedWebSourceErrors(["not a domain"])).toContain("Every allowed web source must be a valid domain.");
    expect(allowedWebSourceErrors(["eba.europa.eu", "https://eba.europa.eu/rules"])).toContain("Allowed web sources cannot contain duplicate domains.");
  });
});
