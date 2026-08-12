import { describe, expect, it } from "vitest";
import { extractFrameworkSource } from "@/lib/framework-import";

describe("framework source extraction", () => {
  it("preserves sheet row locators for CSV imports", async () => {
    const file = new File(
      ["code,title,appetite\nAML-01,CDD failure,Moderate\nCON-03,Customer outcomes,Low"],
      "risk-library.csv",
      { type: "text/csv" },
    );
    const result = await extractFrameworkSource(file);
    expect(result.sections[0].locator).toContain("row 1");
    expect(result.sections[1].text).toContain("AML-01");
  });

  it("rejects unsupported formats", async () => {
    const file = new File(["content"], "framework.txt", { type: "text/plain" });
    await expect(extractFrameworkSource(file)).rejects.toThrow("Supported formats");
  });
});
