import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Esta entrada siempre usa una copia ficticia; nunca importa el almacén habitual.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mode = process.argv.includes("--build") ? "build" : process.argv.includes("--production") ? "start" : "dev";
if (process.argv.includes("--inicio") && mode !== "dev") throw new Error("La propuesta de Inicio solo se habilita en desarrollo local.");
const dataName = process.argv.find(arg => arg.startsWith("--datos="))?.slice(8) ?? "mantenimiento-local";
if (!/^[a-z0-9-]{1,64}$/.test(dataName)) throw new Error("Nombre de almacén local inválido.");
const dataDir = join(root, "temp", dataName, "data");
const { preparePdfReaderAssets } = await import("./prepare-pdf-reader-assets.mjs");
await preparePdfReaderAssets();
await mkdir(dataDir, { recursive: true });
const env = {
  ...process.env,
  NODE_ENV: mode === "dev" ? "development" : "production",
  KATIA_USE_DEMO_DB: "1",
  KATIA_SERVER_DATA_DIR: dataDir,
  KATIA_VISUAL_PREVIEW: "0",
  KATIA_INICIO_PREVIEW: process.argv.includes("--inicio") ? "1" : "0",
  NEXT_PUBLIC_COMBOBOX_MOCK: "0",
  ERP_ORG_ID: "00000000-0000-0000-0000-000000000001",
  NEXT_TELEMETRY_DISABLED: "1",
};
for (const key of new Set([
  ...Object.keys(env).filter(key => /SUPABASE|SENTRY/.test(key)),
  "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SENTRY_DSN", "SENTRY_DSN", "SENTRY_AUTH_TOKEN",
])) env[key] = "";

if (mode !== "build") {
  // No detiene procesos ajenos ni cambia de puerto silenciosamente.
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", () => reject(new Error("El puerto 3002 está ocupado. Identifica su proceso antes de reiniciar mantenimiento.")));
    probe.listen(3002, "127.0.0.1", () => probe.close(resolve));
  });
}
console.log(`Mantenimiento local (${mode}), datos ficticios: ${dataDir}`);
const args = mode === "build" ? ["build", "--webpack"] : [mode, ...mode === "dev" ? ["--webpack"] : [], "--hostname", "127.0.0.1", "--port", "3002"];
const child = spawn(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), ...args], { cwd: root, env, stdio: "inherit", windowsHide: true });
child.once("error", error => { console.error(error.message); process.exitCode = 1; });
child.once("exit", code => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => child.kill(signal));
