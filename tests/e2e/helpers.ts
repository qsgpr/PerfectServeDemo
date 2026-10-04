import { expect, Page } from "@playwright/test";
export async function openTools(page: Page, chat = false) {
  const target = page.getByRole("button", {
    name: chat ? "Conversation participant" : "Shiftline",
    exact: true,
  });
  await target.hover();
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1200);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/tools(?:\?|$)/);
}
export async function back(page: Page) {
  await page.getByRole("link", { name: /back/i }).click();
}
