import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node ./node_modules/next/dist/bin/next dev --port 3100",
    // The E2E suite seeds an isolated localStorage snapshot. Keep the test
    // server detached from .env.local so it cannot start the authenticated
    // Supabase bootstrap or reach a remote financial snapshot.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop",
      grep: /@desktop|@smoke/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1024 },
      },
    },
    {
      name: "tablet-landscape",
      grep: /@responsive|@smoke/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1180, height: 820 },
      },
    },
    {
      name: "tablet-portrait",
      grep: /@responsive|@smoke/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 820, height: 1180 },
      },
    },
    {
      name: "mobile",
      grep: /@responsive|@smoke/,
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
