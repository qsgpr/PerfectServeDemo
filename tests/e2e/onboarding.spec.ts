import { test, expect } from "@playwright/test";

test("registration opens a skippable tour that persists and can be replayed", async ({
  page,
}) => {
  test.skip(
    process.env.SHIFTLINE_LOCAL_E2E === "1",
    "Requires the Supabase client; all requests are mocked.",
  );
  let user = {
    id: "00000000-0000-4000-8000-000000000003",
    aud: "authenticated",
    role: "authenticated",
    email: "onboarding@example.test",
    created_at: new Date().toISOString(),
    user_metadata: { name: "New Teammate", shiftline_onboarding_version: 0 },
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
  let signupData: Record<string, unknown> = {};
  let saves = 0;
  let failSave = false;
  await page.route("**/auth/v1/signup**", async (route) => {
    signupData = route.request().postDataJSON().data;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: token,
        refresh_token: "test-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user,
      }),
    });
  });
  await page.route("**/auth/v1/user", async (route) => {
    if (route.request().method() === "PUT") {
      saves++;
      if (failSave) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ msg: "Temporary failure" }),
        });
        return;
      }
      user = {
        ...user,
        user_metadata: {
          ...user.user_metadata,
          ...route.request().postDataJSON().data,
        },
      };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user),
    });
  });
  await page.route("**/rest/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("New Teammate");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Onboarding-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Your team, connected.", { exact: true }),
  ).toBeVisible();
  expect(signupData.shiftline_onboarding_version).toBe(0);
  await expect(page.getByRole("tab", { name: /Home/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByText("Find the right person.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("Step 1 of 5", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Skip tour", exact: true }).click();
  await expect(page.getByRole("tab", { name: /Home/ })).toBeVisible();
  expect(saves).toBe(1);
  await page.reload();
  await expect(page.getByRole("tab", { name: /Home/ })).toBeVisible();
  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Replay welcome tour", exact: true })
    .click();
  for (let step = 0; step < 4; step++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Meet Nova.", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  failSave = true;
  await page
    .getByRole("button", { name: "Start using Shiftline", exact: true })
    .click();
  await expect(
    page.getByText("Could not save your tour preference. Please try again.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Meet Nova.", { exact: true })).toBeVisible();
  failSave = false;
  await page
    .getByRole("button", { name: "Start using Shiftline", exact: true })
    .click();
  await expect(page.getByRole("tab", { name: /Home/ })).toBeVisible();
  expect(saves).toBe(3);
});
