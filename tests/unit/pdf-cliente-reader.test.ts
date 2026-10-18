import { describe, expect, test } from "vitest";
import { leerPdfCliente, PDF_READER_MAX_BYTES } from "@/lib/pdf-cliente-reader";
const options = () => ({ signal: new AbortController().signal, onProgress: () => {} });
describe("Límites previos a abrir un PDF", () => {
  test("rechaza vacío y archivos falsos", async () => {
    await expect(leerPdfCliente(new File([], "vacio.pdf"), options())).rejects.toThrow("vacío");
    await expect(leerPdfCliente(new File(["No contiene un PDF"], "falso.pdf"), options())).rejects.toThrow("PDF válido");
  });
  test("rechaza un archivo mayor al límite antes de interpretar datos", async () => {
    await expect(leerPdfCliente(new File([new Uint8Array(PDF_READER_MAX_BYTES + 1)], "grande.pdf"), options())).rejects.toThrow("10 MB");
  });
  test("una lectura cancelada no carga la librería", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(leerPdfCliente(new File(["%PDF-1.7 prueba"], "cancelado.pdf"), { ...options(), signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  });
});
