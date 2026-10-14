import { test, expect } from "@playwright/test";

test("recovery stays isolated until the user returns to sign in", async ({
  page,
}) => {
  test.skip(
    process.env.SHIFTLINE_LOCAL_E2E === "1",
    "Requires the Supabase client; all requests are mocked.",
  );
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "recovery@example.test",
    created_at: new Date().toISOString(),
    user_metadata: { name: "Recovery Test" },
    app_metadata: { provider: "email" },
  };
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token =
    encode({ alg: "HS256", typ: "JWT" }) +
    "." +
    encode({
      sub: user.id,
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: "authenticated",
      role: "authenticated",
    }) +
    ".dGVzdA";
  let updates = 0;
  let signouts = 0;
  await page.route("**/auth/v1/user", async (route) => {
    if (route.request().method() === "PUT") updates++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user),
    });
  });
  await page.route("**/auth/v1/logout**", async (route) => {
    signouts++;
    await route.fulfill({ status: 204 });
  });
  await page.route("**/rest/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.goto(
    "/reset-password#type=recovery&access_token=" +
      token +
      "&refresh_token=test-refresh-token",
  );
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Home/ })).toHaveCount(0);
  await page.goto("/");
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  await page
    .getByLabel("New password", { exact: true })
    .fill("Updated-password");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("different-password");
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await expect(
    page.getByText("Your passwords do not match.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("Updated-password");
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await expect(
    page.getByText("Password updated", { exact: true }),
  ).toBeVisible();
  expect(updates).toBe(1);
  await expect(page.getByRole("tab", { name: /Home/ })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Sign in with new password", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  expect(signouts).toBe(1);
  await page.reload();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  // Canceling recovery also ends the temporary session.
  await page.goto(
    "/reset-password#type=recovery&access_token=" +
      token +
      "&refresh_token=test-refresh-token",
  );
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Back to sign in", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  expect(signouts).toBe(2);
  // Requesting an email alone must never establish a session.
  await page.route("**/auth/v1/recover**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.getByText("Forgot password?", { exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("recovery@example.test");
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .click();
  await expect(page.getByText(/If an account exists/)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("tab", { name: /Home/ })).toHaveCount(0);
});
