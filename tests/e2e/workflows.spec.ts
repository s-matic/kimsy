import { expect, test } from "@playwright/test";

test("first-line-led assessment exposes review-by-exception workflow", async ({ page }, testInfo) => {
  await page.goto("/assessments/asm-retail-2026");
  await expect(page.locator("main").getByText("First-line-led", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Finalize" })).toBeDisabled();
  await page.getByRole("button", { name: "Risk assessment" }).click();
  await expect(page.getByText("CDD risk exceeds appetite")).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept rating" })).toBeVisible();
  await page.screenshot({ path: `test-results/${testInfo.project.name}-assessment-review.png`, fullPage: true });
});

test("compliance-led model creates a cycle without a first-line owner", async ({ page }, testInfo) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: /Compliance-led Compliance gathers facts/ }).click();
  await page.goto("/assessments/new");
  await page.getByLabel("Business unit").fill("Corporate Banking");
  await page.getByRole("button", { name: "Create cycle" }).click();
  await expect(page.locator("main").getByText("Compliance-led", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Finalize" })).toBeDisabled();
  await page.getByRole("button", { name: "Fact gathering" }).click();
  await expect(page.getByText("Compliance fact gathering")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create information request" })).toBeVisible();
  await page.screenshot({ path: `test-results/${testInfo.project.name}-compliance-led.png`, fullPage: true });
});

test("management PDF endpoint returns a PDF", async ({ request }) => {
  const response = await request.get("/api/reports/asm-wealth-2026");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/pdf");
  const bytes = await response.body();
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
});
