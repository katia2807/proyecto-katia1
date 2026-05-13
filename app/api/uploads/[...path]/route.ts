import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { getServerWritableDataDir } from "@/lib/server-data-dir";

const UPLOAD_ROOT = path.join(getServerWritableDataDir(), "uploads");

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sirve archivos persistidos en `data/uploads/...`. Sanitiza el path para evitar
 * salir del directorio raíz (path traversal).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const auth = await requireApiAuth();
  if (auth.response) {
    return auth.response;
  }

  const { path: segments } = await ctx.params;
  const safe = segments.map((s) => decodeURIComponent(s));
  if (safe.some((s) => s.includes("..") || s.includes("/") || s.includes("\\"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const target = path.join(UPLOAD_ROOT, ...safe);
  if (!target.startsWith(UPLOAD_ROOT)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  try {
    await stat(target);
    const data = await readFile(target);
    const mime = MIME[path.extname(target).toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": mime, "Cache-Control": "private, no-store" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
