import { expect, test } from "@playwright/test";
import { openTools, back } from "./helpers";
test("restores sign-in, clock, compose/chat drafts, and history after reload and sign-out", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use this account" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await openTools(page);
  await page.getByRole("button", { name: "Change shift" }).click();
  await back(page);
  await page.getByRole("button", { name: "New message", exact: true }).click();
  await page.getByRole("button", { name: "Choose recipient" }).click();
  await expect(page.getByText("On call", { exact: true })).toBeVisible();
  await expect(page.getByText("Next shift", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Mira Vale", exact: true }).click();
  await page.getByRole("radio", { name: "Urgent", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Saved evening handoff.");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("shiftline.compose.v1")),
    )
    .toContain("Saved evening handoff.");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true }),
  ).toHaveValue("Saved evening handoff.");
  await expect(
    page.getByRole("radio", { name: "Urgent", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Start chat" }).click();
  await page
    .getByRole("textbox", { name: "Chat message" })
    .fill("Draft follow-up remains.");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith("shiftline.chat-draft."))
          .map((k) => localStorage.getItem(k))
          .join(""),
      ),
    )
    .toContain("Draft follow-up remains.");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Chat message" })).toHaveValue(
    "Draft follow-up remains.",
  );
  await expect(page.getByTestId("outgoing-bubble")).toHaveCount(1);
  await page.getByRole("button", { name: "Send chat message" }).click();
  await expect(page.getByTestId("outgoing-bubble")).toHaveCount(2);
  await openTools(page, true);
  await page.getByRole("button", { name: "Mark as read" }).click();
  await back(page);
  await expect(page.getByTestId("outgoing-bubble").last()).toContainText(
    "Read",
  );
  await expect(page.getByText("Message read.", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("outgoing-bubble")).toHaveCount(2);
  await expect(page.getByRole("textbox", { name: "Chat message" })).toHaveValue(
    "",
  );
  await page.getByRole("button", { name: "Back to inbox" }).click();
  await page.getByRole("tab", { name: /Home/ }).click();
  await expect(page.getByTestId("on-call-card")).toContainText("Ada Solis");
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByText("Welcome back.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Welcome back.")).toBeVisible();
  await page.getByRole("button", { name: "Use this account" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("tab", { name: /Inbox/ }).click();
  await expect(
    page.getByRole("button", {
      name: /Saved evening handoff., Mira Vale, Urgent, Read/,
    }),
  ).toBeVisible();
});

test("directory search and inbox filters survive reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use this account" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("tab", { name: /Directory/ }).click();
  await page
    .getByRole("textbox", { name: "Search team by name, role, or specialty" })
    .fill("cardiology");
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("shiftline.directory-search.v1"),
      ),
    )
    .toContain("cardiology");
  await page.reload();
  await expect(
    page.getByRole("textbox", {
      name: "Search team by name, role, or specialty",
    }),
  ).toHaveValue("cardiology");
  await expect(page.getByText("1 team member", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /Inbox/ }).click();
  await page.getByRole("button", { name: "Filter conversations" }).click();
  await page.getByRole("radio", { name: "Medicine space" }).click();
  await page.getByRole("radio", { name: "Urgent", exact: true }).click();
  await page.getByRole("button", { name: "Show conversations" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("shiftline.inbox-filters.v1")),
    )
    .toContain("Urgent");
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Coverage check/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Afternoon team huddle/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Filter conversations" }).click();
  await expect(
    page.getByRole("radio", { name: "Urgent", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Reset filters" }).click();
  await page.getByRole("button", { name: "Show conversations" }).click();
  await expect(
    page.getByRole("button", { name: /Afternoon team huddle/ }),
  ).toBeVisible();
});
