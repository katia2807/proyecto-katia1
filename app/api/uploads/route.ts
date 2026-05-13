import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { WRITER_ROLES } from "@/lib/auth";
import { getServerWritableDataDir } from "@/lib/server-data-dir";

const UPLOAD_ROOT = path.join(getServerWritableDataDir(), "uploads");
const ALLOWED_BUCKETS = new Set(["muebles", "caja", "compras", "comprobantes"]);
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);
const MAX_BYTES = 5 * 1024 * 1024;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Recibe un POST multipart con `bucket` (ej: "muebles") y `file`.
 * Guarda el archivo en `data/uploads/<bucket>/<uuid>.<ext>` y devuelve la URL
 * pública servida por el endpoint GET /api/uploads/[...path].
 */
export async function POST(request: Request) {
  const auth = await requireApiAuth(WRITER_ROLES);
  if (auth.response) {
    return auth.response;
  }

  const formData = await request.formData();
  const bucket = String(formData.get("bucket") ?? "");
  const file = formData.get("file");

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Bucket no permitido." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Archivo inválido." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Tipo no soportado: ${file.type}. Solo PNG/JPG/WEBP/GIF/PDF.` },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Máximo 5 MB." }, { status: 413 });
  }

  const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  const filename = `${randomUUID()}${ext}`;
  const dir = path.join(UPLOAD_ROOT, bucket);
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return NextResponse.json({ url: `/api/uploads/${bucket}/${filename}` });
}
