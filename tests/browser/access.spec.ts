import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

async function openNavigation(page: Page) {
  await page.getByRole("heading", { name: /^Welcome,/ }).waitFor();
  const button = page.getByRole("button", { name: "Open navigation", exact: true });
  if (await button.isVisible()) await button.click();
}

test("staff login, scoped shell and logout", async ({ page }, testInfo) => {
  await page.goto("/staff");
  await expect(page).toHaveURL(/\/login$/);
  await page.screenshot({ path: testInfo.outputPath("login.png"), fullPage: true, caret: "initial" });
  await page.getByLabel("Email", { exact: true }).fill("so2@example.test");
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Sign-in failed" })).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("Local-demo-only-2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome, Demo SO 2." })).toBeVisible();
  await expect(page.getByText("Demo North", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo South", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Staff access", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Booking files", exact: true })).toBeVisible();
  await page.goto("/staff");
  await expect(page).toHaveURL(/\/workspace$/);
  const response = await page.request.get("/workspace");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await openNavigation(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/login$/);
});

test("admin creates a staff login with preset password and can revoke access", async ({ page, browser }) => {
  const name = `Synthetic ${randomUUID().slice(0, 8)}`;
  const email = `${randomUUID()}@example.test`;
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin1@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Local-demo-only-2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await openNavigation(page);
  await page.getByRole("link", { name: "Staff access", exact: true }).click();
  await page.getByLabel("Display name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Initial password", { exact: true }).fill("aB4Z8q");
  await page.getByRole("button", { name: "Show initial password" }).click();
  await expect(page.getByLabel("Initial password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide initial password" }).click();
  await page.getByLabel("Role", { exact: true }).selectOption("BO");
  await page.getByRole("button", { name: "Create staff account", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Staff account created" })).toBeVisible();
  const context = await browser.newContext();
  try {
    const staff = await context.newPage();
    await staff.goto("http://127.0.0.1:3000/login");
    await staff.getByLabel("Email", { exact: true }).fill(email);
    await staff.getByLabel("Password", { exact: true }).fill("aB4Z8q");
    await staff.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(staff.getByRole("heading", { name: `Welcome, ${name}.` })).toBeVisible();
    await page.bringToFront();
    const assignment = page.locator("#staff-assignments details").filter({ hasText: name });
    await assignment.locator("summary").click();
    await assignment.getByLabel("Reason", { exact: true }).fill("End synthetic browser trial");
    await assignment.getByRole("button", { name: "Deactivate assignment", exact: true }).click();
    await expect(assignment.locator("summary")).toContainText("Inactive");
    await staff.bringToFront();
    await staff.reload();
    await expect(staff.getByRole("heading", { name: "No active assignment" })).toBeVisible();
  } finally { await context.close(); }
});

test("admin sees only their branch staff", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin1@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Local-demo-only-2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await openNavigation(page);
  await page.getByRole("link", { name: "Staff access", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Staff access", exact: true })).toBeVisible();
  await expect(page.getByText("Demo SO 13", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Demo SO 2 · SO", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
