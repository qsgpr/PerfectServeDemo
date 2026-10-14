import { test, expect } from "@playwright/test";
import { team } from "../../src/data/fixtures";

for (const width of [320, 390]) {
  test(`mobile search, compact contacts, and back navigation at ${width}px`, async ({
    page,
  }) => {
    test.skip(
      process.env.SHIFTLINE_LOCAL_E2E === "1",
      "Uses a configured Supabase client with mocked requests.",
    );
    await page.setViewportSize({ width, height: 700 });
    const user = {
      id: "00000000-0000-4000-8000-000000000004",
      aud: "authenticated",
      role: "authenticated",
      email: "mobile@example.test",
      created_at: new Date().toISOString(),
      user_metadata: {
        name: "Mobile Teammate",
        shiftline_onboarding_version: 1,
      },
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
    await page.addInitScript(
      ({ token, user }) =>
        localStorage.setItem(
          "sb-iowcehxuylqngqigvkvi-auth-token",
          JSON.stringify({
            access_token: token,
            refresh_token: "test-refresh-token",
            token_type: "bearer",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user,
          }),
        ),
      { token, user },
    );
    await page.route("**/auth/v1/user", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(user),
      }),
    );
    await page.route("**/rest/v1/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      const rows = path.endsWith("shiftline_profiles")
        ? [
            ...team.map((member) => ({ ...member, user_id: null })),
            {
              id: user.id,
              user_id: user.id,
              name: user.user_metadata.name,
              role: "Team member",
              specialty: "Coordination",
              department: "coordination",
              color: "#DCEDE7",
              initials: "MT",
              kind: "person",
              presence: "available",
            },
          ]
        : path.endsWith("shiftline_shifts")
          ? [
              {
                id: "today",
                member_id: "mira",
                starts_at: new Date(Date.now() - 3600000).toISOString(),
                ends_at: new Date(Date.now() + 3600000).toISOString(),
              },
            ]
          : [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(rows),
      });
    });
    const noOverflow = async () =>
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    // Direct links have no back stack, but still expose an app back button.
    await page.goto("/settings");
    await expect(
      page.getByRole("button", { name: "Back", exact: true }),
    ).toBeVisible();
    const quiet = page.getByLabel("Quiet hours start UTC", { exact: true });
    await quiet.scrollIntoViewIfNeeded();
    const quietBox = await quiet.boundingBox();
    expect(quietBox!.width).toBeLessThan(width / 2);
    await noOverflow();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("tab", { name: /Home/ })).toBeVisible();
    await page.getByRole("tab", { name: /Directory/ }).click();
    const search = page.getByLabel("Search team by name, role, or specialty", {
      exact: true,
    });
    await expect(search).toBeVisible();
    const searchBox = await search.boundingBox();
    expect(searchBox!.height).toBeGreaterThanOrEqual(44);
    expect(searchBox!.y + searchBox!.height).toBeLessThan(600);
    const row = page.getByRole("button", {
      name: "View Mira Vale profile",
      exact: true,
    });
    await expect(row).toBeVisible();
    expect((await row.boundingBox())!.height).toBeLessThan(140);
    await noOverflow();
    if (width === 390)
      await page.screenshot({ path: "/tmp/shiftline-mobile-directory.png" });
    await search.fill("Noa");
    await expect(
      page.getByRole("button", {
        name: "View Noa Linden profile",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "View Mira Vale profile", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: /Inbox/ }).click();
    await expect(
      page.getByLabel("Search conversations", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Filter conversations", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Show conversations", exact: true }),
    ).toBeVisible();
    await noOverflow();
    await page
      .getByRole("button", { name: "Show conversations", exact: true })
      .click();
    await page
      .getByRole("button", { name: "New message", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Choose recipient", exact: true })
      .click();
    await page.setViewportSize({ width, height: 420 });
    const recipientSearch = page.getByLabel("Search recipients", {
      exact: true,
    });
    await expect(recipientSearch).toBeVisible();
    const pickerBox = await recipientSearch.boundingBox();
    expect(pickerBox!.height).toBeGreaterThanOrEqual(44);
    expect(pickerBox!.y).toBeGreaterThanOrEqual(0);
    expect(pickerBox!.y + pickerBox!.height).toBeLessThan(420);
    await recipientSearch.fill("Noa");
    await page.getByRole("radio", { name: "Noa Linden", exact: true }).click();
    await page.setViewportSize({ width, height: 700 });
    await expect(
      page.getByLabel("Recipient Noa Linden", { exact: true }),
    ).toBeVisible();
    await noOverflow();
    await page.goto("/schedule");
    await page
      .getByRole("button", { name: "Filter coverage", exact: true })
      .click();
    await page
      .getByRole("radio", { name: "Primary coverage", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Filter coverage", exact: true }),
    ).toHaveAttribute("aria-expanded", "false");
    await noOverflow();
    await page.goto("/settings");
    await page.getByRole("radio", { name: "Dark theme", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("tab", { name: /Directory/ }).click();
    await expect(search).toBeVisible();
    const colors = await search.evaluate((node) => ({
      color: getComputedStyle(node).color,
      background: getComputedStyle(node).backgroundColor,
    }));
    expect(colors.color).not.toBe(colors.background);
    await noOverflow();
  });
}
