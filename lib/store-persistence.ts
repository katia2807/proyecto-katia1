import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getServerWritableDataDir } from "@/lib/server-data-dir";

function storeJsonPath() {
  return join(getServerWritableDataDir(), "store.json");
}

function storeTmpPath() {
  return join(getServerWritableDataDir(), "store.json.tmp");
}

export function ensureDataDirectory() {
  getServerWritableDataDir();
}

export function readStoreFromDisk<T>(): T | null {
  ensureDataDirectory();
  const jsonPath = storeJsonPath();
  if (!existsSync(jsonPath)) {
    return null;
  }
  try {
    const raw = readFileSync(jsonPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeStoreToDisk<T>(store: T): void {
  try {
    ensureDataDirectory();
    const json = JSON.stringify(store, null, 2);
    const tmp = storeTmpPath();
    const finalPath = storeJsonPath();
    writeFileSync(tmp, json, "utf8");
    renameSync(tmp, finalPath);
  } catch {
    // Fail silently in read-only environments (e.g. Vercel build, edge)
  }
}
