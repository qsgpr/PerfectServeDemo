import { expect, test } from "@playwright/test";
test("AI teammate replies with context and retries failures without resending", async ({
  page,
}) => {
  let count = 0;
  await page.route("**:8082/reply", async (route) => {
    count++;
    const request = route.request().postDataJSON();
    expect(request.history.at(-1).role).toBe("user");
    expect(request.context.viewer.name).toBe("Alex Morgan");
    expect(request.context.viewer.role).toBeNull();
    expect(request.context.myShifts).toEqual([]);
    expect(request.context.timezone).toBe("UTC");
    expect(request.context.coverage).toHaveLength(6);
    if (count === 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({
        json: {
          text: "Mira Vale is on call until 19:00 UTC. Ada Solis takes the evening shift.",
        },
      });
    } else if (count === 2)
      await route.fulfill({
        status: 502,
        json: { error: "AI is temporarily unavailable. Please try again." },
      });
    else {
      expect(request.history[1].role).toBe("assistant");
      expect(request.history.at(-1).content).toBe("Draft a short handoff.");
      await route.fulfill({
        json: {
          text: "Handoff: Mira hands coverage to Ada at 19:00 UTC. Please confirm receipt.",
        },
      });
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Use this account" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("tab", { name: /Directory/ }).click();
  await page
    .getByRole("textbox", { name: "Search team by name, role, or specialty" })
    .fill("AI teammate");
  await expect(page.getByText("1 team member", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Message Nova" }).click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Who is on call?");
  await page.getByRole("button", { name: "Start chat" }).click();
  await expect(page.getByText("Nova is thinking…")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send chat message" }),
  ).toBeDisabled();
  await expect(
    page.getByTestId("incoming-bubble").getByText(/Mira Vale is on call/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start voice call" }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Chat message" })
    .fill("Draft a short handoff.");
  await page.getByRole("button", { name: "Send chat message" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "AI is temporarily unavailable",
  );
  await expect(page.getByTestId("outgoing-bubble")).toHaveCount(2);
  await page.getByRole("button", { name: "Retry AI reply" }).click();
  await expect(page.getByTestId("incoming-bubble")).toHaveCount(2);
  await expect(page.getByTestId("outgoing-bubble")).toHaveCount(2);
  expect(count).toBe(3);
  await page.screenshot({ path: "docs/ai-chat-mobile.png" });
  await page.getByRole("button", { name: "Back to inbox" }).click();
  await page.getByRole("tab", { name: /Inbox/ }).click();
  await expect(
    page.getByRole("button", {
      name: /Who is on call\?, Nova, Routine, Replied/,
    }),
  ).toBeVisible();
});
