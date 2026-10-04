import { openTools, back } from "./helpers";
import { test, expect } from "@playwright/test";
test("chat bubbles, follow-ups, images, voice/video controls, and department spaces", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use this account" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("tab", { name: /Inbox/ }).click();
  await page.getByRole("button", { name: "Filter conversations" }).click();
  await page.getByRole("radio", { name: "Nursing space" }).click();
  await page.getByRole("button", { name: "Show conversations" }).click();
  await expect(
    page.getByRole("button", { name: /Afternoon team huddle/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Coverage check/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Afternoon team huddle/ }).click();
  await expect(page.getByTestId("outgoing-bubble")).toHaveCount(1);
  await expect(page.getByTestId("incoming-bubble")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Chat message" })
    .fill("I’ll meet you in the team room.");
  await page.getByRole("button", { name: "Send chat message" }).click();
  await expect(page.getByTestId("outgoing-bubble")).toHaveCount(2);
  await page.getByRole("button", { name: "Attach image" }).click();
  await page
    .getByRole("button", { name: "Attach Evening handoff board" })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove attachment" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send chat message" }).click();
  await expect(page.getByTestId("outgoing-bubble")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Open image: Evening handoff board" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Evening handoff board" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.getByRole("button", { name: "Start voice call" }).click();
  await expect(page.getByText(/Call connected/)).toBeVisible();
  await page.getByRole("button", { name: "Mute microphone" }).click();
  await expect(
    page.getByRole("button", { name: "Unmute microphone" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "End call" }).click();
  await expect(
    page.getByText(/Voice call ·/).filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start video call" }).click();
  await expect(page.getByText(/Call connected/)).toBeVisible();
  await page.screenshot({ path: "docs/video-call.png" });
  await page.getByRole("button", { name: "Turn camera off" }).click();
  await expect(
    page.getByRole("button", { name: "Turn camera on" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "End call" }).click();
  await expect(
    page.getByText(/Video call ·/).filter({ visible: true }),
  ).toBeVisible();
  await openTools(page, true);
  await page.getByRole("button", { name: "Play response" }).click();
  await back(page);
  await expect(page.getByText("Your teammate is typing…")).toBeVisible();
  await expect(page.getByTestId("incoming-bubble")).toHaveCount(2);
  await expect(page.getByTestId("incoming-bubble").last()).toContainText(
    "Thanks for the update",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "docs/chat-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "docs/chat-desktop.png" });
  await page.getByRole("button", { name: "Back to inbox" }).click();
  await page.getByRole("button", { name: "Filter conversations" }).click();
  await page.getByRole("radio", { name: "Pharmacy space" }).click();
  await page.getByRole("button", { name: "Show conversations" }).click();
  await expect(
    page.getByRole("button", { name: /Learning kit is ready/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Afternoon team huddle/ }),
  ).toHaveCount(0);
});
