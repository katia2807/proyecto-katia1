import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Intencionalmente público (probe de disponibilidad); no expone datos operativos. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "erp-katia",
    supabaseConfigured: hasSupabaseEnv(),
    timestamp: new Date().toISOString(),
  });
}
