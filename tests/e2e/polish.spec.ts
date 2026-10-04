import { test, expect, Page } from "@playwright/test";
import { openTools, back } from "./helpers";
async function login(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Use this account" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
}
test("presentation clock cannot change live coverage; preferences persist and auto reply works", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-01T10:00:00Z") });
  await login(page);
  await openTools(page);
  await page.getByRole("button", { name: "Change shift" }).click();
  await expect(
    page.getByRole("button", { name: "Change shift" }),
  ).toContainText("Evening shift · 19:00 UTC");
  await page.getByRole("radio", { name: "Dark theme" }).click();
  await page
    .getByRole("switch", { name: "Auto-reply to new messages" })
    .check();
  await back(page);
  await expect(page.getByTestId("on-call-card")).toContainText("Mira Vale");
  await page.getByRole("button", { name: "Message on-call provider" }).click();
  await expect(page.getByLabel("Recipient Mira Vale")).toBeVisible();
  await back(page);
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("shiftline.preferences.v1")),
    )
    .toContain('"mode":"dark"');
  await page.reload();
  await expect(page.getByTestId("on-call-card")).toContainText("Mira Vale");
  await openTools(page);
  await expect(
    page.getByRole("switch", { name: "Auto-reply to new messages" }),
  ).toBeChecked();
  await back(page);
  await page.getByRole("button", { name: "New message", exact: true }).click();
  await page.getByRole("button", { name: "Choose recipient" }).click();
  await page.getByRole("radio", { name: "Mira Vale", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("This is a local simulation.");
  await page.getByRole("button", { name: "Start chat" }).click();
  await expect(page.getByText("Your teammate is typing…")).toBeVisible();
  await expect(
    page.getByTestId("incoming-bubble").getByText(/Thanks/),
  ).toBeVisible();
});
test("hidden playback and urgent countdown can be stopped or completed", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("tab", { name: /Inbox/ }).click();
  await page
    .getByRole("button", { name: /Coverage check for the workshop/ })
    .click();
  await openTools(page, true);
  await page.getByRole("button", { name: "Start escalation timer" }).click();
  await expect(page.getByRole("timer")).toContainText("until escalation");
  await page.getByRole("button", { name: "Stop playback" }).click();
  await expect(page.getByRole("timer")).toHaveCount(0);
  await page.getByRole("button", { name: "Start escalation timer" }).click();
  await expect(page.getByText("Escalated to the backup team.")).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Play response" }).click();
  await back(page);
  await expect(
    page.getByTestId("incoming-bubble").getByText(/Thanks/),
  ).toBeVisible();
  await openTools(page, true);
  await expect(
    page.getByRole("button", { name: "Start escalation timer" }),
  ).toBeDisabled();
});
test("guided 60-second tour changes shift, escalates, replies, and completes", async ({
  page,
}) => {
  await login(page);
  await openTools(page);
  await page
    .getByRole("button", { name: "Start 60-second walkthrough" })
    .click();
  await expect(page.getByText("Evening shift · 19:00 UTC")).toBeVisible({
    timeout: 12000,
  });
  await expect(
    page
      .getByTestId("outgoing-bubble")
      .getByText(
        "Please review the evening handoff and confirm coverage with the team.",
      ),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText("Escalation sent to the backup team."),
  ).toBeVisible({ timeout: 26000 });
  await expect(
    page.getByTestId("incoming-bubble").getByText(/Thanks/),
  ).toBeVisible({ timeout: 20000 });
  await openTools(page, true);
  await expect(
    page
      .getByText("Handoff complete · Your team is up to date")
      .filter({ visible: true }),
  ).toBeVisible({ timeout: 12000 });
});
test("compact home keeps coverage and header stable at phone widths", async ({
  page,
}) => {
  await login(page);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const header = page.getByTestId("app-header");
    const before = (await header.boundingBox())!;
    const card = (await page.getByTestId("on-call-card").boundingBox())!;
    const next = (await page.getByTestId("next-shift-row").boundingBox())!;
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(width);
    expect(next.y).toBeGreaterThan(card.y);
    expect(next.y + next.height).toBeLessThanOrEqual(card.y + card.height);
    await page
      .getByTestId("page-scroll")
      .filter({ has: page.getByTestId("on-call-card") })
      .evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
    expect((await header.boundingBox())!.y).toBe(before.y);
    expect((await header.boundingBox())!.height).toBe(before.height);
    await page.getByRole("tab", { name: /Directory/ }).click();
    expect((await header.boundingBox())!.height).toBe(before.height);
    await page.getByRole("tab", { name: /Home/ }).click();
    await page
      .getByTestId("page-scroll")
      .filter({ has: page.getByTestId("on-call-card") })
      .evaluate((el) => {
        el.scrollTop = 0;
      });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(page.getByRole("button", { name: "Change shift" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Start 60-second walkthrough" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("switch", { name: "Auto-reply to new messages" }),
  ).toHaveCount(0);
  await page.screenshot({ path: "docs/home-mobile.png" });
});

test("inbox keeps filters in a panel without moving the list", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("tab", { name: /Inbox/ }).click();
  const message = page.getByRole("button", { name: /Afternoon team huddle/ });
  const before = (await message.boundingBox())!;
  await expect(page.getByRole("radio", { name: "Nursing space" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Filter conversations" }).click();
  await page.getByRole("radio", { name: "Nursing space" }).click();
  await page.getByRole("button", { name: "Show conversations" }).click();
  await expect(
    page.getByRole("button", { name: /Coverage check/ }),
  ).toHaveCount(0);
  expect((await message.boundingBox())!.y).toBe(before.y);
  await page.getByRole("button", { name: "Filter conversations" }).click();
  await page.getByRole("radio", { name: "Urgent", exact: true }).click();
  await page.getByRole("button", { name: "Show conversations" }).click();
  await expect(page.getByText("Nothing here yet")).toBeVisible();
  await page.getByRole("button", { name: "Filter conversations" }).click();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await page.getByRole("button", { name: "Show conversations" }).click();
  await expect(message).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Coverage check/ }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/inbox-mobile.png" });
});
