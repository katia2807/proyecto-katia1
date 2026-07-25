import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const E2E_DATA_DIR_PREFIX = "katia-e2e-";

export function createE2eDataDir(): string {
  return mkdtempSync(join(tmpdir(), E2E_DATA_DIR_PREFIX));
}

export function removeE2eDataDir(dataDir: string): void {
  const resolvedTempRoot = resolve(tmpdir());
  const resolvedDataDir = resolve(dataDir);
  const isOwnedE2eDir =
    dirname(resolvedDataDir) === resolvedTempRoot &&
    basename(resolvedDataDir).startsWith(E2E_DATA_DIR_PREFIX);

  if (!isOwnedE2eDir) {
    throw new Error(`Se rechazó limpiar un directorio ajeno a E2E: ${resolvedDataDir}`);
  }

  rmSync(resolvedDataDir, { recursive: true, force: true });
}
