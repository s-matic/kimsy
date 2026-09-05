import { expect, test } from "@playwright/test";

test("fresh workspace starts with AI-guided onboarding and can load the sample", async ({ page }) => {
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: { configured: false } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Build it with Kimsy" })).toBeVisible();
  await expect(page.getByText("AI setup needs an API key")).toBeVisible();
  const prompt = page.getByLabel("Message Kimsy");
  await expect(prompt).toBeEnabled();
  await expect(prompt.locator("xpath=ancestor::*[@data-slot='input-group']")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Set up manually" }).click();
  await page.getByLabel("Organization name").fill("Manual Test Company");
  await page.getByRole("button", { name: "Add unit" }).click();
  await page.getByLabel("Unit name").fill("Compliance");
  await page.getByRole("button", { name: "Confirm organization" }).click();
  await expect(page.getByText("Who should own and complete assessments")).toBeVisible();
  await page.getByRole("button", { name: "Set up manually" }).click();
  await expect(page.getByText("Single-owner workspace")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a reviewer" })).toHaveCount(0);
  await expect(page.getByLabel("Reviewer name")).toHaveCount(0);
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  await expect(page.getByText("Continue where you left off")).toBeVisible();
});

test("AI setup messages appear immediately before the editable proposal", async ({ page }) => {
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: { configured: true } }));
  await page.route("**/api/ai/configure", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const result = {
      assistantMessage: "I mapped the organization and reporting line from your description.",
      configuration: {
        organizationName: "Conversation Bank",
        units: [
          { id: "unit-business", name: "Business", parentId: null, description: "First line" },
          { id: "unit-compliance", name: "Compliance", parentId: "unit-business", description: "Second line" },
        ],
        review: { mode: "SOLO", assessorName: "", reviewerName: "" },
        scenarios: [],
        fields: [],
        calculations: [],
        finalRatingFieldId: "",
      },
      warnings: [],
      sources: [],
    };
    await route.fulfill({
      contentType: "application/x-ndjson; charset=utf-8",
      body: [
        JSON.stringify({ type: "assistant-delta", delta: "I mapped the organization" }),
        JSON.stringify({ type: "assistant-delta", delta: " and reporting line from your description." }),
        JSON.stringify({ type: "result", result }),
      ].join("\n") + "\n",
    });
  });

  await page.goto("/");
  const prompt = page.getByLabel("Message Kimsy");
  await prompt.fill("We have a business team with compliance as second line.");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("We have a business team with compliance as second line.")).toBeVisible();
  await expect(prompt).toHaveValue("");
  await expect(page.getByText("Structuring your material…")).toBeVisible();
  await expect(page.getByText("I mapped the organization and reporting line")).toBeVisible();
  await expect(page.getByLabel("Organization name")).toHaveValue("Conversation Bank");
  await expect(page.getByTestId("org-unit-unit-compliance")).toBeVisible();
  await page.getByRole("button", { name: "Confirm organization" }).click();
  await expect(page.getByText("Who should own and complete assessments")).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Customer due diligence failure" })).toBeVisible();
  await page.getByRole("button", { name: "Open assistant" }).click();
  const assistant = page.getByRole("dialog", { name: "Assessment assistant" });
  await expect(assistant.getByText("Focus on changes to outsourced payment operations.")).toBeVisible();
  await expect(assistant.getByText("I’ve carried your initial brief")).toBeVisible();
});

test("assessment form stays primary and the assistant opens in a dialog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.getByRole("link", { name: "Open conversation" }).click();
  await expect(page).toHaveURL(/\/assessments\//);

  await expect(page.getByLabel("Likelihood")).toBeVisible();
  await page.getByRole("button", { name: "Open assistant" }).click();
  const assistant = page.getByRole("dialog", { name: "Assessment assistant" });
  await expect(assistant).toBeVisible();
  await expect(assistant.getByLabel("Message Kimsy")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(assistant).toBeHidden();
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

test("reset workspace returns to onboarding at the base URL", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.goto("/setup");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset workspace" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Build it with Kimsy" })).toBeVisible();
});

test("risk scenarios can be searched and expanded for editing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.goto("/setup");
  await page.getByRole("button", { name: /Risk scenarios/ }).click();

  await page.getByLabel("Search risk scenarios").fill("transaction monitoring");
  await expect(page.getByText("Showing 1 of 4 scenarios")).toBeVisible();
  await page.getByRole("button", { name: "Expand Transaction monitoring coverage gap" }).click();
  await expect(page.getByLabel("Scenario title")).toHaveValue("Transaction monitoring coverage gap");
  await expect(page.getByText("Description and guidance")).toBeVisible();
  const categoryInput = page.getByLabel("Scenario category");
  const categoryListId = await categoryInput.getAttribute("list");
  expect(categoryListId).toBeTruthy();
  const categorySuggestions = await page.locator(`#${categoryListId} option`).evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  expect(categorySuggestions).toEqual(["Customer conduct", "Financial crime", "Regulatory obligations"]);
});

test("assessment options accept commas and multi-word labels without losing focus", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.goto("/setup");
  await page.getByRole("button", { name: /Assessment design/ }).click();

  const options = page.getByLabel("Options for Likelihood");
  await options.focus();
  await options.press("End");
  await options.pressSequentially(", Very High");
  await expect(options).toBeFocused();
  await expect(options).toHaveValue("Rare, Possible, Likely, Almost certain, Very High");
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
