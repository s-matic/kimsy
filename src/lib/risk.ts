import type { RiskRating } from "@/lib/types";

export const ratingOrder: Record<RiskRating, number> = {
  Low: 1,
  Moderate: 2,
  High: 3,
  Severe: 4,
};

export function isWithinAppetite(
  rating: RiskRating,
  appetite: RiskRating,
): boolean {
  return ratingOrder[rating] <= ratingOrder[appetite];
}

export function ratingTone(rating: RiskRating) {
  return {
    Low: "success",
    Moderate: "warning",
    High: "danger",
    Severe: "critical",
  }[rating] as "success" | "warning" | "danger" | "critical";
}

export function completionForAnswers(
  questions: Array<{ required: boolean; answer: string }>,
) {
  const required = questions.filter((question) => question.required);
  if (!required.length) return 100;
  return Math.round(
    (required.filter((question) => question.answer.trim().length > 0).length /
      required.length) *
      100,
  );
}
