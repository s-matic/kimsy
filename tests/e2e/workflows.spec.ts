import { expect, test } from "@playwright/test";

function uiStreamEvent(value: object) {
  return `data: ${JSON.stringify(value)}\n\n`;
}

async function openSampleScenario(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.getByRole("link", { name: "Choose a scenario" }).click();
  await page.getByRole("link", { name: "Edit assessment" }).first().click();
  await expect(page).toHaveURL(/\/assessments\/[^/]+\/scenarios\/[^/]+/);
}

test("first visit shows the landing page before onboarding", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Replace your risk spreadsheet with a conversation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Build it with Kimsy" })).toHaveCount(0);
  await page.getByRole("button", { name: "Start your workspace" }).click();
  await expect(page.getByRole("heading", { name: "Build it with Kimsy" })).toBeVisible();
});

test("fresh workspace starts with AI-guided onboarding and can load the sample", async ({ page }) => {
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: { configured: false } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).first().click();
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
  await expect(page.getByTestId("setup-conversation").getByText("Who should own and complete assessments")).toBeVisible();
  await page.getByRole("button", { name: "Set up manually" }).click();
  await expect(page.getByText("Single-owner workspace")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a reviewer" })).toHaveCount(0);
  await expect(page.getByLabel("Reviewer name")).toHaveCount(0);
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  await expect(page.getByText("Continue where you left off")).toBeVisible();
});

test("vague setup messages ask for clarification without updating the workspace", async ({ page }) => {
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: { configured: true } }));
  await page.route("**/api/ai/configure", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const clarification = {
      stage: "ORGANIZATION",
      assistantMessage: "What is your organization called, and which teams or reporting units should I include?",
      missingInformation: ["Organization name", "Organizational units"],
    };
    await route.fulfill({
      contentType: "text/event-stream; charset=utf-8",
      headers: { "x-vercel-ai-ui-message-stream": "v1" },
      body: [
        uiStreamEvent({ type: "start", messageId: "assistant-clarification" }),
        uiStreamEvent({ type: "start-step" }),
        uiStreamEvent({ type: "tool-input-start", toolCallId: "clarification-call", toolName: "askClarification" }),
        uiStreamEvent({ type: "tool-input-available", toolCallId: "clarification-call", toolName: "askClarification", input: { assistantMessage: clarification.assistantMessage, missingInformation: clarification.missingInformation } }),
        uiStreamEvent({ type: "tool-output-available", toolCallId: "clarification-call", output: clarification }),
        uiStreamEvent({ type: "finish-step" }),
        uiStreamEvent({ type: "finish", finishReason: "tool-calls" }),
        "data: [DONE]\n\n",
      ].join(""),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).first().click();
  await page.getByLabel("Message Kimsy").fill("hi");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("hi", { exact: true })).toBeVisible();
  await expect(page.getByText("Thinking…")).toBeVisible();
  await expect(page.getByTestId("setup-artifact-skeleton-ORGANIZATION")).toHaveCount(0);
  await expect(page.getByText("What is your organization called")).toBeVisible();
  await expect(page.getByTestId("setup-change-summary")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo last AI update" })).toHaveCount(0);
  await expect(page.getByTestId("setup-workspace").getByLabel("Organization name")).toHaveCount(0);
});

test("AI setup streams into a persistent workspace draft", async ({ page }) => {
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: { configured: true } }));
  await page.route("**/api/ai/configure", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const result = {
      stage: "ORGANIZATION",
      assistantMessage: "I mapped the organization and reporting line from your description.",
      configuration: {
        organizationName: "Conversation Bank",
        units: [
          { id: "unit-business", name: "Business", parentId: null, description: "First line" },
          { id: "unit-compliance", name: "Compliance", parentId: "unit-business", description: "Second line" },
        ],
        review: { mode: "SOLO", assessorName: "", reviewerName: "" },
        agent: { allowedWebSources: [] },
        scenarios: [],
        fields: [],
        calculations: [],
        finalRatingFieldId: "",
      },
      warnings: [],
      sources: [],
    };
    await route.fulfill({
      contentType: "text/event-stream; charset=utf-8",
      headers: { "x-vercel-ai-ui-message-stream": "v1" },
      body: [
        uiStreamEvent({ type: "start", messageId: "assistant-setup" }),
        uiStreamEvent({ type: "start-step" }),
        uiStreamEvent({ type: "tool-input-start", toolCallId: "setup-call", toolName: "proposeOrganization" }),
        uiStreamEvent({ type: "tool-input-delta", toolCallId: "setup-call", inputTextDelta: '{"assistantMessage":"I mapped the organization' }),
        uiStreamEvent({ type: "tool-input-delta", toolCallId: "setup-call", inputTextDelta: ' and reporting line from your description."}' }),
        uiStreamEvent({ type: "tool-input-available", toolCallId: "setup-call", toolName: "proposeOrganization", input: { assistantMessage: result.assistantMessage } }),
        uiStreamEvent({ type: "tool-output-available", toolCallId: "setup-call", output: result }),
        uiStreamEvent({ type: "finish-step" }),
        uiStreamEvent({ type: "finish", finishReason: "tool-calls" }),
        "data: [DONE]\n\n",
      ].join(""),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).first().click();
  const prompt = page.getByLabel("Message Kimsy");
  await prompt.fill("We have a business team with compliance as second line.");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("We have a business team with compliance as second line.")).toBeVisible();
  await expect(prompt).toHaveValue("");
  await expect(page.getByText("Thinking…")).toBeVisible();
  const workspaceTab = page.getByRole("tab", { name: /Workspace draft/ });
  if (await workspaceTab.isVisible()) await workspaceTab.click();
  await expect(page.getByTestId("setup-artifact-skeleton-ORGANIZATION")).toHaveCount(0);
  const conversationTab = page.getByRole("tab", { name: "Conversation" });
  if (await conversationTab.isVisible()) await conversationTab.click();
  await expect(page.getByText("I mapped the organization and reporting line")).toBeVisible();
  await expect(page.getByTestId("setup-change-summary").getByText("2 units added")).toBeVisible();
  await expect(page.getByTestId("setup-conversation").getByLabel("Organization name")).toHaveCount(0);
  await page.getByRole("button", { name: "View update" }).click();
  const workspace = page.getByTestId("setup-workspace");
  await expect(workspace.getByLabel("Organization name")).toHaveValue("Conversation Bank");
  const undo = workspace.getByRole("button", { name: "Undo last AI update" });
  await expect(undo).toBeVisible();
  await expect(page.getByTestId("org-unit-unit-compliance")).toBeVisible();
  await undo.click();
  await expect(workspace.getByLabel("Organization name")).toHaveValue("");
  await expect(undo).toHaveCount(0);
  await workspace.getByLabel("Organization name").fill("Conversation Bank");
  await workspace.getByRole("button", { name: "Add unit" }).click();
  await workspace.getByLabel("Unit name").fill("Business");
  await page.getByRole("button", { name: "Confirm organization" }).click();
  await expect(page.getByTestId("setup-conversation").getByText("Who should own and complete assessments")).toBeVisible();
});

test("sample workspace creates a unit-scoped assessment conversation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.getByLabel("What would you like to assess?").fill("Focus on changes to outsourced payment operations.");
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(page.getByText("Initial assessment brief")).toBeVisible();
  await page.getByLabel("Organizational unit").selectOption({ label: "Payments Operations" });
  await page.getByLabel("Assessment period").fill("2027 planning review");
  await page.getByRole("button", { name: "Create assessment" }).click();
  await expect(page.getByRole("heading", { name: "Risk register" })).toBeVisible();
  await expect(page.locator("main").getByText("Payments Operations", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Edit assessment" }).first().click();
  await expect(page.getByTestId("scenario-agent")).toBeAttached();
  await expect(page.getByTestId("scenario-form")).toBeAttached();
});

test("scenario workspace keeps its focused agent beside the assessment form", async ({ page }) => {
  await openSampleScenario(page);
  await expect(page.getByLabel("Likelihood")).toBeVisible();
  await expect(page.getByText("Focused only on AML-01")).toBeAttached();
  await expect(page.getByTestId("scenario-form").getByText("Transaction monitoring coverage gap")).toHaveCount(0);
  const conversationTab = page.getByRole("tab", { name: "Conversation" });
  if (await conversationTab.isVisible()) await conversationTab.click();
  await expect(page.getByLabel("Message Kimsy")).toBeVisible();
});

test("scenario text fields autosave without losing focus and record history", async ({ page }) => {
  await openSampleScenario(page);
  const note = page.getByLabel("Assessment note");
  await note.fill("Updated control evidence from the quarterly review.");
  await page.waitForTimeout(900);
  await expect(note).toBeFocused();
  await page.getByRole("button", { name: /History/ }).click();
  const history = page.getByRole("dialog", { name: "Scenario history" });
  await expect(history.getByText("Assessment note", { exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await note.fill("Updated again on blur.");
  await page.getByRole("button", { name: /History/ }).click();
  await expect(history.getByText("Updated again on blur.", { exact: true })).toBeVisible();
});

test("assessment agent streams its reply before showing a reviewable proposal", async ({ page }) => {
  await page.route("**/api/ai/workspace", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const result = {
      assistantMessage: "I prepared one change for review.",
      summary: "Updated likelihood based on the new operational context.",
      changes: [{
        scenarioId: "scenario-cdd",
        applicable: true,
        values: [{ fieldId: "likelihood", value: "possible" }],
        rationale: "The supplied update supports a possible likelihood.",
        citations: [],
      }],
      warnings: [],
      sources: [],
    };
    await route.fulfill({
      contentType: "text/event-stream; charset=utf-8",
      headers: { "x-vercel-ai-ui-message-stream": "v1" },
      body: [
        uiStreamEvent({ type: "start", messageId: "assistant-assessment" }),
        uiStreamEvent({ type: "start-step" }),
        uiStreamEvent({ type: "tool-input-start", toolCallId: "assessment-call", toolName: "proposeRegisterChanges" }),
        uiStreamEvent({ type: "tool-input-delta", toolCallId: "assessment-call", inputTextDelta: '{"assistantMessage":"I prepared one ' }),
        uiStreamEvent({ type: "tool-input-delta", toolCallId: "assessment-call", inputTextDelta: 'change for review."}' }),
        uiStreamEvent({ type: "tool-input-available", toolCallId: "assessment-call", toolName: "proposeRegisterChanges", input: { assistantMessage: result.assistantMessage } }),
        uiStreamEvent({ type: "tool-output-available", toolCallId: "assessment-call", output: result }),
        uiStreamEvent({ type: "finish-step" }),
        uiStreamEvent({ type: "finish", finishReason: "tool-calls" }),
        "data: [DONE]\n\n",
      ].join(""),
    });
  });

  await openSampleScenario(page);
  const conversationTab = page.getByRole("tab", { name: "Conversation" });
  if (await conversationTab.isVisible()) await conversationTab.click();
  const agent = page.getByTestId("scenario-agent");
  await agent.getByLabel("Message Kimsy").fill("Likelihood may have changed.");
  await agent.getByRole("button", { name: "Submit" }).click();
  await expect(agent.getByText("Likelihood may have changed.")).toBeVisible();
  await expect(agent.getByText("Reviewing this scenario…")).toBeVisible();
  const assessmentTab = page.getByRole("tab", { name: /Assessment/ });
  if (await assessmentTab.isVisible()) await assessmentTab.click();
  await expect(page.getByTestId("inline-proposal")).toBeVisible();
  await expect(page.getByTestId("proposal-likelihood")).toContainText("Possible");
  if (await conversationTab.isVisible()) {
    await conversationTab.click();
    await expect(agent.getByText("I prepared one change for review.")).toBeVisible();
    await assessmentTab.click();
  }
  await page.getByRole("button", { name: "Apply proposal" }).click();
  await expect(page.getByLabel("Likelihood")).toHaveValue("possible");
  await page.getByRole("button", { name: /History/ }).click();
  await expect(page.getByRole("dialog", { name: "Scenario history" }).getByText("AI proposal applied")).toBeVisible();
});

test("organization setup can switch between hierarchy and editable details", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.goto("/settings");

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
  await page.goto("/settings");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset workspace" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Build it with Kimsy" })).toBeVisible();
});

test("risk scenarios can be searched and expanded for editing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.goto("/settings");
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
  await page.goto("/settings");
  await page.getByRole("button", { name: /Assessment design/ }).click();

  const options = page.getByLabel("Options for Likelihood");
  await options.focus();
  await options.press("End");
  await options.pressSequentially(", Very High");
  await expect(options).toBeFocused();
  await expect(options).toHaveValue("Rare, Possible, Likely, Almost certain, Very High");
});

test("general agent web sources can be normalized, saved, and removed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "General agent" }).click();

  await expect(page.getByText("Web search is not allowed", { exact: true })).toBeVisible();
  await page.getByLabel("Allowed web source").fill("https://EBA.europa.eu/regulation-and-policy");
  await page.getByRole("button", { name: "Add source" }).click();
  await expect(page.getByText("eba.europa.eu", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "General agent" }).click();
  await expect(page.getByText("eba.europa.eu", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove eba.europa.eu" }).click();
  await expect(page.getByText("Web search is not allowed", { exact: true })).toBeVisible();
});

test("calculated ratings expose editable and testable matrix logic", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.goto("/settings");
  await page.getByRole("button", { name: /Assessment design/ }).click();

  const calculation = page.getByRole("region", { name: "Calculation for Inherent risk" });
  await expect(calculation.getByText("Inherent risk = Likelihood × Financial impact", { exact: true })).toBeVisible();
  await expect(calculation.getByLabel("Row input for Inherent risk")).toHaveValue("likelihood");
  await expect(calculation.getByLabel("Column input for Inherent risk")).toHaveValue("financial-impact");
  await expect(calculation.getByText("16 of 16 mapped", { exact: true })).toBeVisible();
  const rareAndMinimal = calculation.getByLabel("Inherent risk: Rare and Minimal");
  await expect(rareAndMinimal).toHaveValue("low");
  await rareAndMinimal.selectOption("high");
  await expect(calculation.getByTestId("calculation-preview-result")).toHaveText("High");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
  await calculation.getByLabel("Calculation method for Inherent risk").selectOption("THRESHOLD");
  await expect(calculation.getByText("Weighted inputs", { exact: true })).toBeVisible();
  await expect(calculation.getByText("Rating bands", { exact: true })).toBeVisible();
  const rareScore = calculation.getByLabel("Score for Likelihood option Rare");
  await expect(rareScore).toHaveValue("1");
  await calculation.getByRole("button", { name: "Add band" }).click();
  await calculation.getByLabel("Result for rating band 1").selectOption("low");
  await expect(calculation.getByTestId("calculation-preview-result")).toHaveText("Low");
  await expect(page.getByTestId("calculation-checks")).toContainText("without a rating band");
  await rareScore.fill("1.5");
  await expect(calculation.getByTestId("calculation-preview-result")).toHaveText("Not configured");
  await rareScore.fill("1");
  await expect(calculation.getByTestId("calculation-preview-result")).toHaveText("Low");
  await calculation.getByLabel("Weight for Likelihood").fill("2");
  await expect(calculation.getByTestId("calculation-preview-result")).toHaveText("Not configured");
});

test("register is read-only and routes changes through the assessment workspace", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Choose an organizational unit" })).toBeVisible();
  await page.getByRole("button", { name: "Select Retail Banking" }).click();
  await expect(page.getByRole("button", { name: "Change unit" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByLabel("Likelihood")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /Applicable:/ })).toHaveCount(0);
  await page.getByRole("link", { name: "Edit assessment" }).first().click();
  const likelihood = page.getByLabel("Likelihood").first();
  await likelihood.selectOption("almost-certain");
  await expect(likelihood).toHaveValue("almost-certain");
  await expect(page.getByText("Severe", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /History/ }).click();
  await expect(page.getByRole("dialog", { name: "Scenario history" }).getByText("Likelihood", { exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("main").getByRole("link", { name: "Risk register" }).click();
  const monitoringRow = page.getByText("Transaction monitoring coverage gap", { exact: true }).locator("xpath=ancestor::article");
  await monitoringRow.getByRole("link", { name: "Edit assessment" }).click();
  await page.getByRole("checkbox", { name: "Applicable" }).uncheck();
  await page.locator("main").getByRole("link", { name: "Risk register" }).click();
  await expect(page.getByText("3 in scope")).toBeVisible();
  await expect(page.getByText("Severe", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /Not applicable/ }).click();
  await expect(page.getByText("Transaction monitoring coverage gap", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Change unit" }).click();
  await page.getByRole("button", { name: "Select Wealth Management" }).click();
  await expect(page.getByText("No assessment for Wealth Management")).toBeVisible();
  await page.getByRole("link", { name: "Start assessment" }).click();
  await expect(page.getByLabel("Organizational unit")).toHaveValue("unit-wealth");
});

test("optional reviewer can approve a submitted assessment with a comment", async ({ page }) => {
  await openSampleScenario(page);
  await page.getByRole("button", { name: "Send to reviewer" }).click();
  await page.getByLabel("View as").selectOption("REVIEWER");
  await expect(page.getByText("Independent review")).toBeVisible();
  await page.getByLabel("Review comment").fill("Method and source judgments reviewed.");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
});
