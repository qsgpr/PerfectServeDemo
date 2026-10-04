import { expect, test } from "@playwright/test";
test("department routing, contact profiles, reachability and reviewed handoffs work locally", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-04T12:00:00Z") });
  await page.route("**:8082/reply", async (route) => {
    expect(
      route
        .request()
        .postDataJSON()
        .history.some((h: { content: string }) =>
          h.content.includes("Pharmacy coordination"),
        ),
    ).toBe(true);
    await route.fulfill({
      json: {
        text: "Review the pharmacy coordination request and confirm next steps.",
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Use this account" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Message a department", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Message Pharmacy", exact: true })
    .click();
  await expect(
    page.getByText("Routed to Theo Wren", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Pharmacy coordination request for our fictional workshop.");
  await page.getByRole("button", { name: "Start chat", exact: true }).click();
  await expect(page.getByText(/Routed via Pharmacy/)).toBeVisible();
  await page.goto("/contact?memberId=theo");
  await expect(page.getByText(/Next shift:/)).toBeVisible();
  await expect(
    page.getByText("Messaging availability: available"),
  ).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("radio", { name: "Urgent only", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Quiet hours start UTC" })
    .fill("22:00");
  await page
    .getByRole("textbox", { name: "Quiet hours end UTC" })
    .fill("07:00");
  await page
    .getByRole("button", { name: "Choose backup", exact: true })
    .click();
  await page.getByRole("radio", { name: "Cedar Test", exact: true }).click();
  await page
    .getByRole("button", { name: "Save reachability", exact: true })
    .click();
  await expect(page.getByText("Reachability saved.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "Urgent only", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("textbox", { name: "Quiet hours start UTC" }),
  ).toHaveValue("22:00");
  await page.goto("/handoffs");
  await page
    .getByRole("button", { name: "Create handoff", exact: true })
    .click();
  await page.getByRole("button", { name: "Choose incoming teammate" }).click();
  await page.getByRole("radio", { name: "Cedar Test", exact: true }).click();
  await page
    .getByRole("checkbox", { name: /Include Pharmacy coordination/ })
    .click();
  await page
    .getByRole("button", { name: "Draft with Nova", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Handoff note" })).toHaveValue(
    "Review the pharmacy coordination request and confirm next steps.",
  );
  await page
    .getByRole("textbox", { name: "Handoff note" })
    .fill("Reviewed draft: confirm the workshop coordination request.");
  await page
    .getByRole("button", { name: "Share handoff", exact: true })
    .click();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Reviewed draft: confirm the workshop coordination request.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept handoff" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText(
      "Reviewed draft: confirm the workshop coordination request.",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel handoff", exact: true })
    .click();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
});
