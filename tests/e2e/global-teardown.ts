import type { FullConfig } from "@playwright/test";
import { removeE2eDataDir } from "./helpers/e2e-data-dir";

export default function globalTeardown(config: FullConfig): void {
  const dataDir = config.metadata.katiaE2eDataDir;
  if (typeof dataDir !== "string" || dataDir.length === 0) {
    throw new Error("Playwright no informó el directorio temporal E2E.");
  }

  removeE2eDataDir(dataDir);
}
