import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let resolved: string | null = null;

/**
 * Directorio base para archivos que el servidor debe poder crear (`store.json`, `uploads/`).
 * Intenta primero `./data` bajo `process.cwd()` (local / Docker). Si no se puede escribir ahí
 * (p. ej. bundle de Vercel en `/var/task` de solo lectura), usa un subdirectorio de `os.tmpdir()`.
 *
 * No usar solo `process.env.VERCEL`: en builds locales Webpack puede sustituir esa variable y
 * dejar el bundle siempre apuntando a `cwd/data`.
 */
export function getServerWritableDataDir(): string {
  const fromEnv = process.env["KATIA_SERVER_DATA_DIR"]?.trim();
  if (fromEnv) {
    mkdirSync(fromEnv, { recursive: true });
    resolved = fromEnv;
    return fromEnv;
  }
  if (resolved) {
    return resolved;
  }

  const local = join(process.cwd(), "data");
  try {
    mkdirSync(local, { recursive: true });
    resolved = local;
    return local;
  } catch {
    const fallback = join(tmpdir(), "katia-server-data");
    mkdirSync(fallback, { recursive: true });
    resolved = fallback;
    return fallback;
  }
}
