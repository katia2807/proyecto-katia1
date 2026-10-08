import { spawn } from "node:child_process";
import { copyFile, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectDir = dirname(dirname(fileURLToPath(import.meta.url)));
const mode = process.argv.includes("--build") ? "build" : process.argv.includes("--production") ? "start" : "dev";
const dataDir = join(projectDir, "temp", "propuesta-visual-1.1.64");
await mkdir(dataDir, { recursive: true });
// Conserva la vista habitual y cualquier cambio de la copia entre reinicios.
try {
  await access(join(dataDir, "store.json"));
} catch {
  try {
    await copyFile(join(projectDir, "data", "store.json"), join(dataDir, "store.json"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    // Sin almacén anterior, el programa crea sus datos demo habituales.
  }
}

const env = {
  ...process.env,
  KATIA_USE_DEMO_DB: "1",
  KATIA_SERVER_DATA_DIR: dataDir,
  KATIA_VISUAL_PREVIEW: mode === "dev" ? "1" : "0",
  ERP_ORG_ID: "00000000-0000-0000-0000-000000000001",
};
// Impide que el middleware o los clientes de Auth contacten al servicio real.
for (const key of [
  "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SENTRY_DSN", "SENTRY_DSN", "SENTRY_AUTH_TOKEN",
]) env[key] = "";

const child = spawn(process.execPath, [
  join(projectDir, "node_modules", "next", "dist", "bin", "next"),
  ...mode === "build" ? ["build", "--webpack"] : [mode, ...mode === "dev" ? ["--webpack"] : [], "--hostname", "127.0.0.1", "--port", "3001"],
], { cwd: projectDir, env, stdio: "inherit", windowsHide: true });
child.once("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.once("exit", (code) => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => child.kill(signal));
