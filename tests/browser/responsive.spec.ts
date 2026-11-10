import { test, expect } from "@playwright/test";

const sizes = [[320,568],[360,800],[390,844],[600,960],[768,1024],[820,1180],[900,700],[901,700],[1024,768],[1280,720],[1920,1080],[2560,1440],[844,390]];
test("admin forms reflow and navigation survives orientation and breakpoint changes", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin1@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Local-demo-only-2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Welcome,/ })).toBeVisible();
  await page.goto("/staff");
  await expect(page.getByRole("heading", { name: "Staff access", exact: true })).toBeVisible();
  await page.getByLabel("Display name", { exact: true }).fill("A long staff name that should stay inside the form across screen sizes");
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `admin at ${width}x${height}`).toBe(true);
    const invalid = await page.locator("#invite input:not([type=hidden]), #invite select, #invite button").evaluateAll(elements => elements.filter(e => {
      const r = e.getBoundingClientRect();
      return r.width && (r.left < 0 || r.right > innerWidth + 1);
    }).map(e => e.getAttribute("name") || e.tagName));
    expect(invalid).toEqual([]);
    const collisions = await page.locator("#invite").evaluate(section => {
      const elements = Array.from(section.querySelectorAll("h2,label,button"));
      return elements.flatMap((a, i) => elements.slice(i + 1).flatMap(b => {
        if (a.contains(b) || b.contains(a)) return [];
        const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
        return x.width && y.width && Math.min(x.right, y.right) - Math.max(x.left, y.left) > 2 && Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>2 ? [a.tagName+"/"+b.tagName] : [];
      }));
    });
    expect(collisions, `form overlaps at ${width}`).toEqual([]);
  }
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(/A long staff name/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Welcome,/ })).toBeVisible();
  await page.goto("/password");
  await expect(page.getByRole("heading", { name: "Choose your password" })).toBeVisible();
  for (const [width, height] of [[320,568],[768,1024],[1440,900],[844,390]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("login and account pages reflow at phone, tablet and desktop sizes", async ({ page }) => {
  for (const route of ["/login", "/recover", "/no-access", "/link-error"]) {
    await page.goto(route);
    await page.getByRole("heading", { level: 1 }).waitFor();
    for (const [width, height] of [[320,568],[390,844],[768,1024],[901,700],[1440,900],[844,390]]) {
      await page.setViewportSize({ width, height });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${width}`).toBe(true);
    }
  }
});

test("sales account team choices follow the selected branch and role", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin1@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Local-demo-only-2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Welcome,/ })).toBeVisible();
  await page.goto("/staff");
  await page.getByLabel("Role", { exact: true }).selectOption("SO");
  const team = page.getByLabel("Team", { exact: true });
  await expect(team.locator("option").filter({ hasText: /^Sales A$/ })).toHaveCount(1);
  await expect(team.locator("option").filter({ hasText: /^Sales B$/ })).toHaveCount(1);
  await expect(team.locator("option").filter({ hasText: /^Sales C$/ })).toHaveCount(0);
  await team.selectOption({ label: "Sales A" });
  await page.getByLabel("Role", { exact: true }).selectOption("Security");
  await expect(team).toHaveCount(0);
  await page.getByLabel("Role", { exact: true }).selectOption("TL");
  await expect(team).toHaveValue("");
  await page.locator("summary").filter({ hasText: "Add a branch team" }).click();
  const name = `Fixture team ${Date.now()}`;
  await page.getByLabel("Team name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Add team", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Team added" })).toBeVisible();
  await expect(team.locator("option").filter({ hasText: name })).toHaveCount(1);
});
