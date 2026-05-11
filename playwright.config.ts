import { defineConfig, devices } from "@playwright/test";

const isStagingRun = process.env.E2E_MODE === "staging";
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: isStagingRun
    ? undefined
    : {
        command: "npm run build && node .next/standalone/server.js",
        env: {
          ...process.env,
          PORT: "3001",
          KATIA_USE_DEMO_DB: "1",
          /** Anula .env.local: si queda en "true", el build embebe mocks y los E2E no ven el catálogo demo real. */
          NEXT_PUBLIC_COMBOBOX_MOCK: "0",
        },
        port: 3001,
        reuseExistingServer: false,
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
