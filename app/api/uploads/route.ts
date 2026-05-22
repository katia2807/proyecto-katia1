import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { WRITER_ROLES } from "@/lib/auth";
import { getServerWritableDataDir } from "@/lib/server-data-dir";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "@/lib/constants";

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
 * Si hay base de datos de producción (Supabase), lo sube al Storage de Supabase.
 * Si es modo demo/offline, lo guarda localmente en data/uploads/<bucket>/<uuid>.<ext>.
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

  // 1. Si Supabase está configurado, subir al Storage en la nube
  if (hasSupabaseEnv()) {
    try {
      const supabase = getSupabaseServerClient();
      const storagePath = `${DEFAULT_ORG_ID}/${filename}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      // Intentar subir el archivo al bucket
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (upErr) {
        // Si el error es porque el bucket no existe en Supabase, intentamos crearlo de forma pública
        if (
          upErr.message?.toLowerCase().includes("not found") ||
          upErr.message?.toLowerCase().includes("bucket") ||
          upErr.message?.toLowerCase().includes("does not exist")
        ) {
          const { error: createErr } = await supabase.storage.createBucket(bucket, {
            public: true,
          });
          if (createErr) {
            return NextResponse.json(
              { error: `No se pudo crear el bucket de Storage '${bucket}': ${createErr.message}` },
              { status: 500 },
            );
          }
          // Volver a intentar la subida tras crear el bucket
          const { error: retryErr } = await supabase.storage
            .from(bucket)
            .upload(storagePath, buffer, {
              contentType: file.type,
              upsert: true,
            });
          if (retryErr) {
            return NextResponse.json(
              { error: `Error al subir archivo a Supabase tras crear bucket: ${retryErr.message}` },
              { status: 500 },
            );
          }
        } else {
          return NextResponse.json(
            { error: `Error al subir archivo a Supabase Storage: ${upErr.message}` },
            { status: 500 },
          );
        }
      }

      // Obtener la URL pública del objeto guardado
      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      return NextResponse.json({ url: publicData.publicUrl });
    } catch (err) {
      return NextResponse.json(
        { error: `Error interno de almacenamiento Supabase: ${err instanceof Error ? err.message : String(err)}` },
        { status: 500 },
      );
    }
  }

  // 2. Modo Offline/Demo: Guardar en almacenamiento local persistente
  const dir = path.join(UPLOAD_ROOT, bucket);
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return NextResponse.json({ url: `/api/uploads/${bucket}/${filename}` });
}
