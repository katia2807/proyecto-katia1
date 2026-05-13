import { NextResponse } from "next/server";
import { isDemoDatabaseMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getServerSupabaseCredentials } from "@/lib/supabase/temp-credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Intencionalmente público (probe de disponibilidad); no expone datos operativos. */
export async function GET() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const rawAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const creds = getServerSupabaseCredentials();
  const demoMode = isDemoDatabaseMode();

  return NextResponse.json({
    ok: true,
    service: "erp-katia",
    timestamp: new Date().toISOString(),
    /** true si el proceso ve URL+anon en process.env (antes de lógica demo). */
    processEnvPublicSupabase: Boolean(rawUrl && rawAnon),
    /** Si es true, la app ignora Supabase para credenciales y datos (KATIA_USE_DEMO_DB). */
    demoMode,
    /** URL + anon: login con Supabase Auth en Server Actions. */
    supabaseAuthReady: Boolean(creds.url && creds.anonKey),
    /** URL + service role: consultas servidor → Postgres (p. ej. `lib/data.ts`). */
    supabaseServerDataReady: Boolean(creds.url && creds.serviceRoleKey),
    /** Igual que antes: listo para datos reales sin demo (las tres piezas). */
    supabaseConfigured: hasSupabaseEnv(),
  });
}
