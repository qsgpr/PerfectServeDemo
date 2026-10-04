import { expect, test } from "@playwright/test";
import { openTools, back } from "./helpers";

test("calendar follows live handoffs, includes overnight shifts, and supports date browsing", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-04T06:59:40Z") });
  await page.clock.pauseAt(new Date("2026-10-04T06:59:50Z"));
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("shiftline.clock.v2", "0"));
  await page.reload();
  await page.getByRole("button", { name: "Use this account" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.clock.runFor(1000);
  await expect(page.getByTestId("on-call-card")).toContainText("Cedar Test");
  await page.clock.fastForward(11000);
  await page.clock.resume();
  await expect(page.getByTestId("on-call-card")).toContainText("Willow Test");
  await page.getByRole("tab", { name: /Schedule/ }).click();
  await expect(
    page.getByRole("heading", { name: "October 2026" }),
  ).toBeVisible();
  const today = page.getByRole("button", {
    name: "Sunday, Oct 4, 18 shifts, Today",
  });
  await expect(today).toHaveAttribute("aria-pressed", "true");
  const assignments = page.getByTestId("day-assignments");
  await expect(assignments).toContainText("On call now");
  await expect(assignments).toContainText("Continues from the previous day");
  await page
    .getByRole("button", { name: "Saturday, Oct 31, 18 shifts" })
    .click();
  await expect(assignments).toContainText("Saturday, Oct 31");
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(
    page.getByRole("heading", { name: "November 2026" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tuesday, Nov 3, 0 shifts" }).click();
  await expect(page.getByText("No assignments for this day")).toBeVisible();
  await page.getByRole("button", { name: "Go to today" }).click();
  await expect(today).toHaveAttribute("aria-pressed", "true");
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({ path: "docs/schedule-mobile.png" });
  await openTools(page);
  await page.getByRole("button", { name: "Change shift" }).click();
  await expect(
    page.getByRole("button", { name: "Use real time" }),
  ).toBeVisible();
  await back(page);
  await expect(assignments).toContainText("Sunday, Oct 4");
  await page.getByRole("tab", { name: /Home/ }).click();
  await expect(page.getByTestId("on-call-card")).toContainText("Willow Test");
  await page.reload();
  await expect(page.getByTestId("on-call-card")).toContainText("Willow Test");
  await page.getByRole("tab", { name: /Schedule/ }).click();
  await openTools(page);
  await page.getByRole("button", { name: "Use real time" }).click();
  await expect(
    page.getByRole("button", { name: "Change shift" }),
  ).toContainText("Live time");
  await back(page);
  await expect(assignments).toContainText("Sunday, Oct 4");
});
