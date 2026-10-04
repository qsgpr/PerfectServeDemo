import { test, expect } from "@playwright/test";
import { DEMO_ACCOUNT } from "../../src/features/auth/auth-service";
test("validates demo login, protects routes, and signs out", async ({
  page,
}) => {
  await page.goto("/directory");
  await expect(page.getByText("Welcome back.")).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter your email address.")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(DEMO_ACCOUNT.email);
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/Those details don’t match/)).toBeVisible();
  await page.getByRole("button", { name: "Use this account" }).click();
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveJSProperty(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveJSProperty(
    "type",
    "password",
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("tab", { name: /Home/ })).toBeVisible();
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByText("Welcome back.")).toBeVisible();
  await page.goBack();
  // The browser may leave the app; it must not restore protected content.
  await expect(page.getByRole("tab", { name: /Home/ })).toHaveCount(0);
  await page.goto("/compose");
  await expect(page.getByText("Welcome back.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start chat" })).toHaveCount(0);
});
test("login layouts fit phone and desktop; reload restores session", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Welcome back.")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "docs/login-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "docs/login-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Use this account" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("tab", { name: /Home/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("tab", { name: /Home/ })).toBeVisible();
});
