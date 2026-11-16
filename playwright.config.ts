import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
    // PW_CHANNEL=chrome utilise le Chrome installé plutôt que le Chromium de Playwright.
    channel: process.env.PW_CHANNEL || undefined,
  },
  projects: [
    { name: "ordinateur", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Les parcours tournent contre un faux Supabase local : l'application doit avoir été
  // construite avec `npm run build:e2e` pour pointer dessus.
  webServer: [
    {
      command: "node e2e/fake-supabase.mjs",
      url: "http://127.0.0.1:54321/auth/v1/user",
      ignoreHTTPSErrors: true,
      reuseExistingServer: !process.env.CI,
      timeout: 20_000,
    },
    {
      command: `npm run start -- --port ${port}`,
      url: `http://127.0.0.1:${port}/fr`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
