import { defineConfig, devices } from "@playwright/test";
import { loadEnvFile } from "node:process";
loadEnvFile(".env.local");
export default defineConfig({
  globalSetup: "./tests/browser/global-setup.mjs",
  testDir: "./tests/browser", fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [ { name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "phone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } }, { name: "webkit-phone", use: { ...devices["iPhone 13"] } }, { name: "firefox", use: { ...devices["Desktop Firefox"] } } ],
  webServer: { command: "npm run dev", url: "http://127.0.0.1:3000/login", reuseExistingServer: !process.env.CI },
});
