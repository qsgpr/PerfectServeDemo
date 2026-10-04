import { expect, test } from "@playwright/test";

test("inbox renders a window of a large history and reaches the final conversation", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const messages = Array.from({ length: 200 }, (_, i) => ({
      id: `list-test-${i}`,
      recipientId: "mira",
      subject: `Roster conversation ${String(i).padStart(3, "0")}`,
      body: "Fictional team coordination",
      priority: "Routine",
      status: "Sent",
      createdAt: new Date(Date.UTC(2026, 9, 4, 10, 0, 200 - i)).toISOString(),
      events: [],
    }));
    localStorage.setItem(
      "shiftline.messages.v1",
      JSON.stringify({ version: 1, messages }),
    );
  });
  await page.getByRole("button", { name: "Use this account" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("tab", { name: /Inbox/ }).click();
  const scroll = page.getByTestId("page-scroll").filter({
    has: page.getByRole("textbox", { name: "Search conversations" }),
  });
  const rows = scroll.getByRole("button", { name: /Roster conversation/ });
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeLessThan(60);
  // Variable-height lists extend their measured range as the user scrolls.
  // Keep scrolling to the current end instead of assuming unmeasured rows have a fixed height.
  const finalRow = scroll.getByRole("button", {
    name: /Roster conversation 199/,
  });
  await expect
    .poll(async () => {
      await scroll.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      return finalRow.isVisible();
    }, { timeout: 30000, intervals: [100, 150, 250] })
    .toBe(true);
  expect(await rows.count()).toBeLessThan(60);
  await scroll.evaluate((node) => {
    node.scrollTop = 0;
  });
  await page
    .getByRole("textbox", { name: "Search conversations" })
    .fill("conversation 199");
  await expect(rows).toHaveCount(1);
  await rows.click();
  await expect(
    page.getByRole("heading", { name: "Mira Vale", exact: true }),
  ).toBeVisible();
});
