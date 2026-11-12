import { defineConfig, devices } from "@playwright/test";

/**
 * One end-to-end path through the product, against a running app (E2E_BASE_URL) and a
 * fresh demo session per test. Locally it uses the installed Chrome; CI installs
 * Playwright's Chromium (E2E_CHANNEL unset there).
 *
 *   E2E_BASE_URL=http://localhost:3000 npm run e2e
 */
const channel = process.env.E2E_CHANNEL === "bundled" ? undefined : (process.env.E2E_CHANNEL ?? "chrome");

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel, viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"], channel } },
  ],
});
