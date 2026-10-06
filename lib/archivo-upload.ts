import { compressImage } from "@/lib/image-compress";

export type EstadoArchivoUpload = "idle" | "subiendo" | "ok" | "error";
export type BucketArchivo = "muebles" | "caja" | "compras" | "comprobantes";

export async function subirArchivo(file: File, bucket: BucketArchivo): Promise<string> {
  const preparado = file.type.startsWith("image/") ? await compressImage(file) : file;
  const datos = new FormData();
  datos.append("bucket", bucket);
  datos.append("file", preparado);

  let respuesta: Response;
  try {
    respuesta = await fetch("/api/uploads", { method: "POST", body: datos });
  } catch {
    throw new Error("No se pudo subir el archivo. Revisa la conexión y vuelve a seleccionarlo.");
  }
  const resultado = await respuesta.json().catch(() => null) as { url?: unknown; error?: unknown } | null;
  if (!respuesta.ok || typeof resultado?.url !== "string" || !resultado.url.trim()) {
    const detalle = [400, 403, 413].includes(respuesta.status) && typeof resultado?.error === "string"
      ? resultado.error
      : "No se pudo subir el archivo. Vuelve a seleccionarlo para intentarlo de nuevo.";
    throw new Error(detalle);
  }
  return resultado.url;
}
