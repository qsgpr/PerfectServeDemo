import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
test("shared department messages and handoffs persist with recipient-only acceptance", async ({
  browser,
}) => {
  const path = process.env.SHIFTLINE_CLOUD_QA_FILE;
  test.skip(!path, "Requires disposable cloud QA accounts.");
  const f = JSON.parse(readFileSync(path!, "utf8")) as {
    password: string;
    users: { id: string; email: string; name: string }[];
  };
  const contexts = await Promise.all(
    f.users.map(() =>
      browser.newContext({ viewport: { width: 390, height: 844 } }),
    ),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  async function login(p: Page, i: number) {
    await p.goto("http://localhost:8081/login");
    await p
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(f.users[i].email);
    await p
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(f.password);
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(p.getByRole("tab", { name: /Home/ })).toBeVisible();
  }
  try {
    await Promise.all(pages.map(login));
    const [a, b, c] = pages;
    await a
      .getByRole("button", { name: "Message a department", exact: true })
      .click();
    await a
      .getByRole("button", { name: "Message Pharmacy", exact: true })
      .click();
    await expect(
      a.getByText("Routed to Theo Wren", { exact: true }),
    ).toBeVisible();
    const body = "Workflow QA pharmacy coordination " + Date.now();
    await a.getByRole("textbox", { name: "Message", exact: true }).fill(body);
    await a.getByRole("button", { name: "Start chat", exact: true }).click();
    await expect(a.getByText(/Routed via Pharmacy/)).toBeVisible();
    await a.goto("http://localhost:8081/handoffs");
    await a
      .getByRole("button", { name: "Create handoff", exact: true })
      .click();
    await a.getByRole("button", { name: "Choose incoming teammate" }).click();
    await a.getByRole("radio", { name: f.users[1].name, exact: true }).click();
    await a
      .getByRole("textbox", { name: "Handoff note" })
      .fill("Please follow up on the fictional workshop request.");
    await a.getByRole("checkbox", { name: "Include " + body }).click();
    await a.getByRole("button", { name: "Share handoff", exact: true }).click();
    await expect(a.getByText("Pending", { exact: true })).toBeVisible();
    await expect(a.getByRole("button", { name: "Accept handoff" })).toHaveCount(
      0,
    );
    await Promise.all([
      b.goto("http://localhost:8081/handoffs"),
      c.goto("http://localhost:8081/handoffs"),
    ]);
    await expect(
      b.getByText("Please follow up on the fictional workshop request."),
    ).toBeVisible();
    await expect(c.getByText("No handoffs yet")).toBeVisible();
    await b
      .getByRole("button", { name: "Accept handoff", exact: true })
      .click();
    await expect(b.getByText("Accepted", { exact: true })).toBeVisible();
    await expect(a.getByText("Accepted", { exact: true })).toBeVisible({
      timeout: 25000,
    });
    await expect(
      a.getByText(new RegExp("Accepted by " + f.users[1].name)),
    ).toBeVisible();
    await Promise.all([a.reload(), b.reload()]);
    await expect(a.getByText("Accepted", { exact: true })).toBeVisible();
    await expect(b.getByText("Accepted", { exact: true })).toBeVisible();
    await expect(a.getByRole("button", { name: "Cancel handoff" })).toHaveCount(
      0,
    );
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
