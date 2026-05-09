import { NextResponse } from "next/server";
import { demoExportStore } from "@/lib/demo-store";
import { requireApiAuth } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Descarga un snapshot del store local en formato JSON, listo para guardar como respaldo. */
export async function GET() {
  const auth = await requireApiAuth(["owner_admin"]);
  if (auth.response) {
    return auth.response;
  }

  if (hasSupabaseEnv()) {
    return NextResponse.json(
      { error: "El respaldo JSON está disponible solo cuando se opera contra el store local." },
      { status: 400 },
    );
  }
  const snapshot = demoExportStore();
  const filename = `katia-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
