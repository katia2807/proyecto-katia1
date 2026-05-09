import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
export const STORE_JSON_PATH = join(DATA_DIR, "store.json");
const STORE_TMP_PATH = join(DATA_DIR, "store.json.tmp");

export function ensureDataDirectory() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readStoreFromDisk<T>(): T | null {
  ensureDataDirectory();
  if (!existsSync(STORE_JSON_PATH)) {
    return null;
  }
  try {
    const raw = readFileSync(STORE_JSON_PATH, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeStoreToDisk<T>(store: T): void {
  ensureDataDirectory();
  const json = JSON.stringify(store, null, 2);
  writeFileSync(STORE_TMP_PATH, json, "utf8");
  renameSync(STORE_TMP_PATH, STORE_JSON_PATH);
}
