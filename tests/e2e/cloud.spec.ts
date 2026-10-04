import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
const fixturePath = process.env.SHIFTLINE_CLOUD_QA_FILE;
test("two Supabase accounts exchange messages, read receipts, and restore history", async ({
  browser,
}) => {
  test.skip(!fixturePath, "Requires temporary backend QA accounts.");
  const fixture = JSON.parse(readFileSync(fixturePath!, "utf8")) as {
    password: string;
    users: { id: string; email: string; name: string }[];
  };
  const contexts = await Promise.all(
    [0, 1, 2].map(() =>
      browser.newContext({ viewport: { width: 390, height: 844 } }),
    ),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  async function login(page: Page, index: number) {
    await page.goto("http://localhost:8081/login");
    await page
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(fixture.users[index].email);
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("tab", { name: /Directory/ })).toBeVisible();
  }
  try {
    await Promise.all(pages.map((p, i) => login(p, i)));
    const [a, b, c] = pages;
    await b.getByRole("tab", { name: /Inbox/ }).click();
    await a.getByRole("tab", { name: /Directory/ }).click();
    await a
      .getByRole("textbox", { name: "Search team by name, role, or specialty" })
      .fill(fixture.users[1].name);
    await a
      .getByRole("button", { name: "Message Willow", exact: true })
      .click();
    const body = "Shared QA handoff " + Date.now();
    await a.getByRole("textbox", { name: "Message", exact: true }).fill(body);
    await a.getByRole("button", { name: "Start chat", exact: true }).click();
    await expect(a.getByTestId("outgoing-bubble")).toContainText(body);
    await b.getByRole("button", { name: new RegExp(body) }).click();
    await expect(b.getByTestId("incoming-bubble")).toContainText(body);
    await expect(a.getByTestId("outgoing-bubble")).toContainText("Read");
    const composer = b.getByRole("textbox", {
      name: "Chat message",
      exact: true,
    });
    await composer.fill("Typing a response");
    await expect(a.getByText("Your teammate is typing…")).toBeVisible();
    await expect(a.getByText("Your teammate is typing…")).toHaveCount(0, {
      timeout: 6000,
    });
    await composer.fill("Coverage received. Thank you.");
    await expect(a.getByText("Your teammate is typing…")).toBeVisible();
    await b
      .getByRole("button", { name: "Send chat message", exact: true })
      .click();
    await expect(a.getByTestId("incoming-bubble")).toContainText(
      "Coverage received. Thank you.",
    );
    await expect(a.getByText("Your teammate is typing…")).toHaveCount(0);
    await expect(a.getByText("Message read.", { exact: true })).toHaveCount(0);
    await a
      .getByRole("textbox", { name: "Chat message", exact: true })
      .fill("Checking the handoff");
    await expect(b.getByText("Your teammate is typing…")).toBeVisible();
    await a
      .getByRole("textbox", { name: "Chat message", exact: true })
      .fill("");
    await expect(b.getByText("Your teammate is typing…")).toHaveCount(0);
    await a.reload();
    await expect(a.getByTestId("incoming-bubble")).toContainText(
      "Coverage received. Thank you.",
    );
    await c.getByRole("tab", { name: /Inbox/ }).click();
    await expect(c.getByRole("button", { name: new RegExp(body) })).toHaveCount(
      0,
    );
    await expect(c.getByText("Nothing here yet")).toBeVisible();
    // Share a selected device file, then verify its private image survives reload.
    const chooser = a.waitForEvent("filechooser");
    await a.getByRole("button", { name: "Attach image", exact: true }).click();
    await a
      .getByRole("button", { name: "Choose from photo library", exact: true })
      .click();
    await (
      await chooser
    ).setFiles({
      name: "fictional-test.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(a.getByText("Photo from your library")).toBeVisible();
    await b.goto("http://localhost:8081/inbox");
    await expect(
      b.getByRole("button", { name: new RegExp(body) }),
    ).toBeVisible();
    // The recipient stays foregrounded, as it would on a separate phone.
    await b.bringToFront();
    await a
      .getByRole("button", { name: "Send chat message", exact: true })
      .evaluate((element) => (element as HTMLElement).click());
    await expect(
      b.getByRole("button", { name: /New message from/ }),
    ).toBeVisible({ timeout: 25000 });
    await b.getByRole("button", { name: /New message from/ }).click();
    await expect(b.getByRole("img", { name: "Shared photo" })).toBeVisible();
    await a.reload();
    await expect(a.getByRole("img", { name: "Shared photo" })).toBeVisible();
    await a.screenshot({ path: "docs/cloud-chat-mobile.png" });
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
