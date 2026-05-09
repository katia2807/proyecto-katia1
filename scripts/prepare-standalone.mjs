#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const standaloneRoot = join(root, ".next", "standalone");

if (!existsSync(standaloneRoot)) {
  console.warn(
    "[prepare-standalone] No se encontró .next/standalone. Ejecuta `npm run build` antes."
  );
  process.exit(0);
}

const ops = [
  {
    label: ".next/static",
    src: join(root, ".next", "static"),
    dest: join(standaloneRoot, ".next", "static"),
  },
  {
    label: "public",
    src: join(root, "public"),
    dest: join(standaloneRoot, "public"),
  },
];

for (const op of ops) {
  if (!existsSync(op.src)) {
    console.warn(`[prepare-standalone] omitido (no existe): ${op.label}`);
    continue;
  }
  mkdirSync(dirname(op.dest), { recursive: true });
  cpSync(op.src, op.dest, { recursive: true, force: true });
  console.log(`[prepare-standalone] copiado: ${op.label}`);
}

const dataUploads = join(standaloneRoot, "data", "uploads");
mkdirSync(dataUploads, { recursive: true });
console.log("[prepare-standalone] listo.");
