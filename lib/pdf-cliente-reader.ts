import { pdfItemsToText, type PaginaPdfCliente } from "@/lib/pdf-cliente-parser";
import type { Worker as OcrWorker } from "tesseract.js";

export const PDF_READER_MAX_BYTES = 10 * 1024 * 1024;
export const PDF_READER_MAX_PAGES = 12;
const ASSETS = "/pdf-reader-assets/v1/";
export type PdfReaderProgress = { pagina: number; paginas: number; etapa: "abriendo" | "texto" | "escaneo" };
export class PdfReaderError extends Error {
  constructor(message: string, public readonly passwordRequired = false) { super(message); this.name = "PdfReaderError"; }
}
type Options = { signal: AbortSignal; onProgress: (p: PdfReaderProgress) => void; password?: string; forceOcr?: boolean };
const abortError = () => new DOMException("Lectura cancelada.", "AbortError");
export async function leerPdfCliente(file: File, options: Options): Promise<PaginaPdfCliente[]> {
  if (file.size > PDF_READER_MAX_BYTES) throw new PdfReaderError("El PDF supera 10 MB. Usa una copia más pequeña.");
  if (file.size === 0) throw new PdfReaderError("El archivo está vacío.");
  const signature = new TextDecoder("latin1").decode(await file.slice(0, 1024).arrayBuffer());
  if (!signature.includes("%PDF-")) throw new PdfReaderError("El archivo no contiene un PDF válido.");
  if (options.signal.aborted) throw abortError();
  options.onProgress({ pagina: 0, paginas: 0, etapa: "abriendo" });
  // Se carga el ESM original: evita colisiones entre su runtime y Webpack.
  const pdfjs: typeof import("pdfjs-dist") = await import(/* webpackIgnore: true */ ASSETS + "pdf.min.mjs");
  if (options.signal.aborted) throw abortError();
  pdfjs.GlobalWorkerOptions.workerSrc = ASSETS + "pdf.worker.min.mjs";
  const loading = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()), password: options.password,
    isEvalSupported: false, maxImageSize: 8_000_000, stopAtErrors: true,
    cMapUrl: ASSETS + "pdfjs/cmaps/", cMapPacked: true,
    standardFontDataUrl: ASSETS + "pdfjs/standard_fonts/", wasmUrl: ASSETS + "pdfjs/wasm/",
  });
  let ocr: OcrWorker | null = null;
  let render: { cancel(): void } | null = null;
  let document: Awaited<typeof loading.promise> | null = null;
  const stop = () => { render?.cancel(); void loading.destroy().catch(() => {}); void ocr?.terminate().catch(() => {}); };
  options.signal.addEventListener("abort", stop, { once: true });
  try {
    document = await loading.promise;
    if (document.numPages > PDF_READER_MAX_PAGES) throw new PdfReaderError("El PDF tiene " + document.numPages + " páginas. Usa un documento de hasta " + PDF_READER_MAX_PAGES + " páginas para leer la ficha.");
    const pages: PaginaPdfCliente[] = [];
    for (let index = 1; index <= document.numPages; index++) {
      if (options.signal.aborted) throw abortError();
      options.onProgress({ pagina: index, paginas: document.numPages, etapa: "texto" });
      const page = await document.getPage(index);
      const content = await page.getTextContent();
      if (content.items.length > 12000) throw new PdfReaderError("Una página contiene demasiado texto para leerla con seguridad.");
      const text = pdfItemsToText(content.items.filter((i): i is typeof content.items[number] & { str: string } => "str" in i));
      const textLetters = text.replace(/[^a-záéíóúñ\d]/gi, "").length;
      if (textLetters >= 80 && !options.forceOcr) {
        pages.push({ pagina: index, texto: text, origen: "texto" });
      } else {
        options.onProgress({ pagina: index, paginas: document.numPages, etapa: "escaneo" });
        if (!ocr) {
          const { createWorker } = await import("tesseract.js");
          ocr = await createWorker("spa", 1, {
            workerPath: new URL(ASSETS + "ocr/worker.min.js", location.origin).href,
            corePath: new URL(ASSETS + "ocr/core/", location.origin).href,
            langPath: new URL(ASSETS + "ocr/lang/", location.origin).href,
            cacheMethod: "none", workerBlobURL: false,
          });
          if (options.signal.aborted) { await ocr.terminate(); throw abortError(); }
        }
        const initial = page.getViewport({ scale: 1 });
        const scale = Math.min(2.5, Math.sqrt(3_000_000 / (initial.width * initial.height)));
        const viewport = page.getViewport({ scale });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        try {
          render = page.render({ canvas, viewport });
          await (render as ReturnType<typeof page.render>).promise;
          render = null;
          const recognized = await ocr.recognize(canvas, { rotateAuto: true });
          pages.push({ pagina: index, texto: recognized.data.text, origen: "ocr", confianza: recognized.data.confidence });
          if (text.trim().length > 30) pages.push({ pagina: index, texto: text, origen: "texto" });
        } finally { canvas.width = 0; canvas.height = 0; }
      }
      page.cleanup();
    }
    if (options.signal.aborted) throw abortError();
    return pages;
  } catch (error) {
    if (options.signal.aborted) throw abortError();
    if (error instanceof PdfReaderError) throw error;
    if (error && typeof error === "object" && "name" in error && error.name === "PasswordException") throw new PdfReaderError(options.password ? "La contraseña del PDF no es correcta." : "Este PDF está protegido. Introduce su contraseña para leerlo.", true);
    throw new PdfReaderError("No se pudo leer el PDF. Prueba con otra copia o completa los datos manualmente.");
  } finally {
    options.signal.removeEventListener("abort", stop);
    await ocr?.terminate().catch(() => {});
    await (document ? document.destroy() : loading.destroy()).catch(() => {});
  }
}
