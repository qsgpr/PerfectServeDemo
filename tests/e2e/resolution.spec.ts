import { expect, test } from "@playwright/test";
test("Nova context window and resolved archive preserve history while a new chat resets context", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**:8082/reply", async (route) => {
    const body = route.request().postDataJSON();
    requests++;
    expect(body.history).toHaveLength(1);
    expect(body.context.viewer.name).toBe("Alex Morgan");
    await route.fulfill({
      json: { text: "Reply to " + body.history[0].content },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Use this account" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("tab", { name: /Directory/ }).click();
  await page.getByRole("button", { name: "Message Nova", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("First Nova question");
  await page.getByRole("button", { name: "Start chat", exact: true }).click();
  await expect(
    page.locator('[data-testid="incoming-bubble"]:visible'),
  ).toContainText("Reply to First Nova question");
  const oldURL = page.url();
  await page.getByRole("button", { name: "View Nova context window" }).click();
  await expect(
    page.getByText("2 messages in the current window", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await page
    .getByRole("button", { name: "Resolve conversation", exact: true })
    .click();
  await expect(
    page.getByText("Resolved · Archived", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Chat message" })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Start a new conversation" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="incoming-bubble"]:visible'),
  ).toContainText("Reply to First Nova question");
  await page.goto("/inbox");
  await expect(
    page.getByRole("button", { name: /First Nova question, Nova/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Filter conversations" }).click();
  await page.getByRole("radio", { name: "Resolved", exact: true }).click();
  await page.getByRole("button", { name: "Show conversations" }).click();
  await page
    .getByRole("button", {
      name: /First Nova question, Nova, Routine, Resolved/,
    })
    .click();
  await page.getByRole("button", { name: "Start a new conversation" }).click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Fresh Nova question");
  await page.getByRole("button", { name: "Start chat", exact: true }).click();
  await expect(
    page.locator('[data-testid="incoming-bubble"]:visible'),
  ).toContainText("Reply to Fresh Nova question");
  expect(page.url()).not.toBe(oldURL);
  await expect(
    page
      .getByText("First Nova question", { exact: true })
      .filter({ visible: true }),
  ).toHaveCount(0);
  expect(requests).toBe(2);
});
