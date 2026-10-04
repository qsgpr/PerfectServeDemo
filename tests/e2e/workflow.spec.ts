import { openTools, back } from "./helpers";
import { test, expect } from "@playwright/test";
test("find a team member, send a mock message, and update all screens", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use this account" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Today")).toBeVisible();
  await page.getByRole("tab", { name: /Directory/ }).click();
  await page
    .getByRole("textbox", { name: "Search team by name, role, or specialty" })
    .fill("cardiology");
  await expect(page.getByText("1 team member", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Message Noa" }).click();
  await expect(page.getByLabel("Recipient Noa Linden")).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "Mira Vale", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Start chat" }).click();
  await expect(page.getByText("Write a message.")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Workshop handoff: Please review the workshop agenda.");
  await page.getByRole("radio", { name: "Urgent", exact: true }).click();
  await page.getByRole("button", { name: "Start chat" }).click();
  await expect(
    page.getByRole("heading", { name: "Noa Linden", exact: true }),
  ).toBeVisible();
  await openTools(page, true);
  await page.getByRole("button", { name: "Mark as read" }).click();
  await back(page);
  await expect(page.getByTestId("outgoing-bubble").last()).toContainText(
    "Read",
  );
  await expect(page.getByText("Message read.", { exact: true })).toHaveCount(0);
  await openTools(page, true);
  await page.getByRole("button", { name: "Escalate" }).click();
  await back(page);
  await expect(
    page.getByText("Escalation sent to the backup team."),
  ).toBeVisible();
  await openTools(page, true);
  await page.getByRole("button", { name: "Add reply" }).click();
  await back(page);
  await expect(
    page.getByTestId("incoming-bubble").getByText(/Thanks/),
  ).toBeVisible();
  await openTools(page, true);
  await expect(page.getByRole("button", { name: "Escalate" })).toBeDisabled();
  await back(page);
  await page.getByRole("button", { name: "Back to inbox" }).click();
  await page.getByRole("tab", { name: /Inbox/ }).click();
  await expect(
    page.getByRole("button", {
      name: /Workshop handoff: Please review the workshop agenda., Noa Linden, Urgent, Replied/,
    }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Home/ }).click();
  await expect(
    page.getByRole("button", {
      name: /Workshop handoff: Please review the workshop agenda., Noa Linden, Urgent, Replied/,
    }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Schedule/ }).click();
  await page.getByRole("button", { name: /Thursday, Oct 1, 18 shifts/ }).click();
  await expect(page.getByTestId("day-assignments")).toContainText(
    "Thursday, Oct 1",
  );
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Use this account" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("tab", { name: /Inbox/ }).click();
  await expect(
    page.getByRole("button", {
      name: /Workshop handoff: Please review the workshop agenda./,
    }),
  ).toBeVisible();
});
test("directory empty state and responsive desktop home", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use this account" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("tab", { name: /Directory/ }).click();
  await page
    .getByRole("textbox", { name: "Search team by name, role, or specialty" })
    .fill("zzzz");
  await expect(page.getByText("No team members found")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: /Home/ }).click();
  await page.screenshot({ path: "docs/home-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("tab", { name: /Home/ }).click();
  await expect(page.getByText("Today")).toBeVisible();
  await page.screenshot({ path: "docs/home-desktop.png", fullPage: true });
});
