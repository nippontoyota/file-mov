import { test, expect } from "@playwright/test";

// UI-03 / T-24: automatic vehicle changes preserve credentials and reduced motion.
test("vehicles rotate automatically without controls and respect reduced motion", async ({ page }) => {
  await page.clock.install();
  await page.goto("/login");
  const showcase = page.getByRole("region", { name: "Toyota vehicle showcase" });
  const active = showcase.locator('[data-active="true"] img');
  await expect(active).toHaveAttribute("alt", "Toyota Innova HyCross");
  await expect(showcase.getByRole("button")).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill("synthetic@example.test");
  await page.clock.fastForward(6600);
  await expect(active).toHaveAttribute("alt", "Toyota Fortuner");
  await page.clock.fastForward(6600);
  await expect(active).toHaveAttribute("alt", "Toyota Urban Cruiser Hyryder");
  await page.clock.fastForward(6600);
  await expect(active).toHaveAttribute("alt", "Toyota Innova HyCross");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("synthetic@example.test");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.fastForward(14000);
  await expect(active).toHaveAttribute("alt", "Toyota Innova HyCross");
  for (const image of await showcase.locator("img").all()) {
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("password visibility is keyboard accessible and preserves the entered value", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Booking files. Clear ownership." })).toBeVisible();
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("Synthetic-only-password!");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("Synthetic-only-password!");
  await page.getByRole("button", { name: "Hide password", exact: true }).click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(password).toHaveValue("Synthetic-only-password!");
  await expect(page).toHaveURL(/\/login$/);
});
