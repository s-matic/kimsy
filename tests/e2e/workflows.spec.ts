import { expect, test } from "@playwright/test";

test("fresh workspace starts with AI-guided onboarding and can load the sample", async ({ page }) => {
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: { configured: false } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Describe how your organization works" })).toBeVisible();
  await expect(page.getByText("AI setup needs an API key")).toBeVisible();
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  await expect(page.getByText("Continue where you left off")).toBeVisible();
});

test("sample workspace creates a unit-scoped assessment conversation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.getByLabel("What would you like to assess?").fill("Focus on changes to outsourced payment operations.");
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(page.getByText("Initial assessment brief")).toBeVisible();
  await page.getByLabel("Organizational unit").selectOption({ label: "Payments Operations" });
  await page.getByLabel("Assessment period").fill("2027 planning review");
  await page.getByRole("button", { name: "Start conversation" }).click();
  await expect(page.getByRole("heading", { name: "Payments Operations" })).toBeVisible();
  await expect(page.getByText("Focus on changes to outsourced payment operations.")).toBeVisible();
  await expect(page.getByText("I’ve carried your initial brief")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Customer due diligence failure" })).toBeVisible();
});

test("organization setup can switch between hierarchy and editable details", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.goto("/setup");

  await expect(page.getByRole("button", { name: "Hierarchy", exact: true })).toHaveAttribute("aria-pressed", "true");
  const retailBanking = page.getByTestId("org-unit-unit-retail");
  await expect(retailBanking.getByText("Retail Banking", { exact: true })).toBeVisible();
  await expect(retailBanking.getByTestId("org-unit-unit-payments").getByText("Payments Operations", { exact: true })).toBeVisible();
  await retailBanking.getByRole("button", { name: "Collapse Retail Banking" }).click();
  await expect(retailBanking.getByText("1 hidden", { exact: true })).toBeVisible();
  await expect(page.getByTestId("org-unit-unit-payments")).toHaveCount(0);
  await retailBanking.getByRole("button", { name: "Expand Retail Banking" }).click();
  await expect(retailBanking.getByTestId("org-unit-unit-payments")).toBeVisible();

  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await expect(page.getByLabel("Unit name").first()).toBeVisible();
});

test("register values can be edited and calculated values update", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.goto("/register");
  const likelihood = page.getByLabel("Likelihood").first();
  await likelihood.selectOption("almost-certain");
  await expect(likelihood).toHaveValue("almost-certain");
  await expect(page.getByText("Severe", { exact: true }).first()).toBeVisible();
});

test("optional reviewer can approve a submitted assessment with a comment", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.getByRole("link", { name: "Open conversation" }).click();
  await page.getByRole("button", { name: "Send to reviewer" }).click();
  await page.getByLabel("View as").selectOption("REVIEWER");
  await expect(page.getByText("Independent review")).toBeVisible();
  await page.getByLabel("Review comment").fill("Method and source judgments reviewed.");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
});
