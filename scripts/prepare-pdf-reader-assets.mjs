import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const destination = join(root, "public", "pdf-reader-assets", "v1");
async function copy(source, relative) {
  const target = join(destination, relative);
  await mkdir(dirname(target), { recursive: true });
  const sourceStat = await stat(source);
  const existing = await stat(target).catch(() => null);
  if (!existing || existing.size !== sourceStat.size || existing.mtimeMs < sourceStat.mtimeMs) await copyFile(source, target);
}
export async function preparePdfReaderAssets() {
  const dependencies = join(root, "node_modules");
  await copy(join(dependencies, "pdfjs-dist/build/pdf.min.mjs"), "pdf.min.mjs");
  await copy(join(dependencies, "pdfjs-dist/build/pdf.worker.min.mjs"), "pdf.worker.min.mjs");
  for (const folder of ["cmaps", "standard_fonts", "wasm"]) {
    for (const name of await readdir(join(dependencies, "pdfjs-dist", folder))) {
      const source = join(dependencies, "pdfjs-dist", folder, name);
      if ((await stat(source)).isFile()) await copy(source, "pdfjs/" + folder + "/" + name);
    }
  }
  await copy(join(dependencies, "tesseract.js/dist/worker.min.js"), "ocr/worker.min.js");
  const core = join(dependencies, "tesseract.js-core");
  for (const name of await readdir(core)) {
    if (/^tesseract-core.*\.(?:js|wasm)$/.test(name)) await copy(join(core, name), "ocr/core/" + name);
  }
  await copy(join(dependencies, "@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz"), "ocr/lang/spa.traineddata.gz");
  const notices = [];
  for (const name of ["pdfjs-dist", "tesseract.js", "tesseract.js-core", "@tesseract.js-data/spa"]) {
    const metadata = JSON.parse(await readFile(join(dependencies, name, "package.json"), "utf8"));
    notices.push(name + " " + metadata.version + " — " + (metadata.license ?? "ver licencia"));
    const license = await readFile(join(dependencies, name, "LICENSE"), "utf8").catch(() => "");
    if (license) await writeFile(join(destination, name.replaceAll("/", "_") + "-LICENSE.txt"), license);
  }
  await writeFile(join(destination, "NOTICE.txt"), notices.join("\n") + "\n");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await preparePdfReaderAssets();
  console.log("Lector PDF: recursos propios preparados.");
}
