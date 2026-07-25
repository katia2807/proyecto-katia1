import { defineConfig, devices } from "@playwright/test";
import { createE2eDataDir } from "./tests/e2e/helpers/e2e-data-dir";

const isStagingRun = process.env.E2E_MODE === "staging";
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001";
const inheritedE2eDataDir = process.env.KATIA_E2E_DATA_DIR?.trim();
const e2eDataDir = isStagingRun ? null : inheritedE2eDataDir || createE2eDataDir();

if (e2eDataDir) {
  process.env.KATIA_E2E_DATA_DIR = e2eDataDir;
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: "list",
  globalTeardown: isStagingRun ? undefined : "./tests/e2e/global-teardown.ts",
  metadata: {
    katiaE2eDataDir: e2eDataDir,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: isStagingRun
    ? undefined
    : {
        command: "npm run build && npx next start",
        env: {
          ...process.env,
          PORT: "3001",
          KATIA_USE_DEMO_DB: "1",
          KATIA_SERVER_DATA_DIR: e2eDataDir!,
          /** Anula .env.local: si queda en "true", el build embebe mocks y los E2E no ven el catálogo demo real. */
          NEXT_PUBLIC_COMBOBOX_MOCK: "0",
        },
        port: 3001,
        reuseExistingServer: false,
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
