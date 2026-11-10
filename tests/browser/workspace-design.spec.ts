import { test, expect } from "@playwright/test";

// T-02 / T-24: role presentation must not expose admin navigation or imply
// operational capabilities before those workflows exist.
const roleCases = [
  ["so2", "Sales Officer", "Booking documents"],
  ["tl3", "Team Leader", "Booking reviews"],
  ["sm4", "Sales Manager", "Booking approvals"],
  ["bo5", "Back Office", "Approved files"],
  ["insurance6", "Insurance", "Insurance work"],
  ["accounts7", "Accounts", "Invoice & road tax"],
  ["cashier8", "Cashier", "Collection records"],
  ["accessories9", "Accessories", "Preparation requests"],
  ["security10", "Security", "Gate passes"],
];

for (const [account, role, tool] of roleCases) {
  test(`${role} has scoped navigation and clearly unavailable future tools`, async ({ page }, testInfo) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(`${account}@example.test`);
    await page.getByLabel("Password", { exact: true }).fill("Local-demo-only-2026!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: /^Welcome,/ })).toBeVisible();
    const assignments = page.getByRole("region", { name: "My assignments", exact: true });
    await expect(assignments.getByRole("heading", { name: role, exact: true })).toBeVisible();
    await expect(assignments.getByText("Demo North", { exact: true })).toBeVisible();
    await expect(page.getByText("Demo South", { exact: true })).toHaveCount(0);
    if (testInfo.project.name === "desktop") {
      for (const [width, height] of [[320,568],[360,800],[414,896],[600,960],[768,1024],[820,1180],[900,700],[901,700],[1024,768],[1280,720],[1440,900],[1920,1080],[2560,1440]]) {
        await page.setViewportSize({ width, height });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${role} at ${width}px`).toBe(true);
        const heading = await page.getByRole("heading", { name: /^Welcome,/ }).boundingBox();
        expect(heading!.x + heading!.width).toBeLessThanOrEqual(width);
      }
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    const menu = page.getByRole("button", { name: "Open navigation" });
    const mobile = await menu.isVisible();
    if (mobile) await menu.click();
    const nav = page.getByRole("navigation", { name: "Workspace", exact: true });
    await expect(nav.getByRole("link", { name: "Staff access", exact: true })).toHaveCount(0);
    if (["Sales Officer", "Team Leader", "Sales Manager"].includes(role)) await expect(nav.getByRole("link", { name: role === "Sales Officer" ? "My bookings" : role === "Team Leader" ? "Team bookings" : "Branch bookings", exact: true })).toBeVisible();
    await expect(nav.getByText(tool, { exact: true })).toHaveAttribute("aria-disabled", "true");
    await expect(nav.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("aria-current", "page");
    if (mobile) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(menu).toBeFocused();
      await menu.click();
    }
    await nav.getByRole("link", { name: /My assignments/ }).click();
    await expect(page).toHaveURL(/\/workspace#assignments$/);
    if (mobile) await expect(page.getByRole("dialog")).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto("/staff");
    await expect(page).toHaveURL(/\/workspace$/);
  });
}
