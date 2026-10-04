import { defineConfig } from "@playwright/test";
const baseURL = process.env.SHIFTLINE_E2E_URL ?? "http://localhost:8081";
const port = Number(new URL(baseURL).port || 8081);
export default defineConfig({
  workers: 2,
  timeout: 120000,
  expect: { timeout: 15000 },
  testDir: "./tests/e2e",
  use: {
    actionTimeout: 15000,
    screenshot: "only-on-failure",
    navigationTimeout: 120000,
    baseURL,
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command:
      process.env.SHIFTLINE_LOCAL_E2E === "1"
        ? `node scripts/local-preview.mjs ${port}`
        : `npm run web -- --port ${port}`,
    url: baseURL,
    env:
      process.env.SHIFTLINE_LOCAL_E2E === "1"
        ? {
            EXPO_NO_DOTENV: "1",
            EXPO_PUBLIC_SUPABASE_URL: "",
            EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
          }
        : undefined,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
