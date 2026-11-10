import { test, expect, type Page } from "@playwright/test";

async function navigation(page: Page) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  return page.getByRole("navigation", { name: "Workspace", exact: true });
}

test("assignment and admin section links recover malformed hashes and support repeated keyboard navigation", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin1@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Local-demo-only-2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Welcome,/ })).toBeVisible();
  await page.goto("/workspace#assignments#assignments");
  for (let repeat = 0; repeat < 2; repeat++) {
    const nav = await navigation(page);
    const link = nav.getByRole("link", { name: /My assignments/ });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/workspace#assignments$/);
    await expect(page.locator("#assignments")).toBeFocused();
    await expect(page.locator("#assignments h2")).toBeInViewport();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
  const rail = page.getByRole("link", { name: "Your access", exact: true });
  if (await rail.isVisible()) {
    await rail.click();
    await expect(page).toHaveURL(/\/workspace#assignments$/);
    await expect(page.locator("#assignments")).toBeFocused();
  }
  for (const [label, id] of [["Assignments", "staff-assignments"], ["Add staff", "invite"], ["Account requests", "invitations"], ["Access history", "history"]]) {
    const nav = await navigation(page);
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/staff#${id}$`));
    await expect(page.locator(`#${id}`)).toBeFocused();
    await expect(page.locator(`#${id} h2`)).toBeInViewport();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/staff#invitations$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/staff#history$/);
  const nav = await navigation(page);
  await nav.getByRole("link", { name: /My assignments/ }).click();
  await expect(page).toHaveURL(/\/workspace#assignments$/);
  await expect(page.locator("#assignments h2")).toBeInViewport();
});
