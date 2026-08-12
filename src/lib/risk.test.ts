import { describe, expect, it } from "vitest";
import { completionForAnswers, isWithinAppetite, ratingOrder } from "@/lib/risk";

describe("customer-configured risk scoring helpers", () => {
  it("evaluates appetite deterministically", () => {
    expect(isWithinAppetite("Moderate", "Moderate")).toBe(true);
    expect(isWithinAppetite("Low", "Moderate")).toBe(true);
    expect(isWithinAppetite("High", "Moderate")).toBe(false);
    expect(ratingOrder.Severe).toBeGreaterThan(ratingOrder.High);
  });

  it("counts only required questions toward completion", () => {
    expect(
      completionForAnswers([
        { required: true, answer: "Complete" },
        { required: true, answer: "" },
        { required: false, answer: "" },
      ]),
    ).toBe(50);
  });
});
