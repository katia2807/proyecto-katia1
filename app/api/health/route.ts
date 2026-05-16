import { NextResponse } from "next/server";
import { getDatabaseModeSummary } from "@/lib/database-mode";
import { isDemoDatabaseMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getServerSupabaseCredentials } from "@/lib/supabase/temp-credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Intencionalmente público (probe de disponibilidad); no expone datos operativos. */
export async function GET() {
  const rawUrl =
    process.env["SUPABASE_URL"]?.trim() || process.env["NEXT_PUBLIC_SUPABASE_URL"]?.trim();
  const rawAnon =
    process.env["SUPABASE_ANON_KEY"]?.trim() || process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]?.trim();
  const creds = getServerSupabaseCredentials();
  const demoMode = isDemoDatabaseMode();
  const databaseMode = getDatabaseModeSummary();

  return NextResponse.json({
    ok: true,
    service: "katia-suite",
    /** Si no ves 2, este deploy no incluye el health extendido del repo actual. */
    healthVersion: 2,
    timestamp: new Date().toISOString(),
    /** true si el proceso ve URL+anon (NEXT_PUBLIC_* o SUPABASE_URL / SUPABASE_ANON_KEY). */
    processEnvPublicSupabase: Boolean(rawUrl && rawAnon),
    /** true solo si usa las variables sin prefijo NEXT_PUBLIC (recomendado en Vercel para el servidor). */
    serverEnvSupabaseAuth: Boolean(
      process.env["SUPABASE_URL"]?.trim() && process.env["SUPABASE_ANON_KEY"]?.trim(),
    ),
    /** Si es true, la app ignora Supabase para credenciales y datos (KATIA_USE_DEMO_DB). */
    demoMode,
    /** URL + anon: login con Supabase Auth en Server Actions. */
    supabaseAuthReady: Boolean(creds.url && creds.anonKey),
    /** URL + service role: consultas servidor → Postgres (p. ej. `lib/data.ts`). */
    supabaseServerDataReady: Boolean(creds.url && creds.serviceRoleKey),
    /** Igual que antes: listo para datos reales sin demo (las tres piezas). */
    supabaseConfigured: hasSupabaseEnv(),
    /** Desglose alineado con `lib/database-mode.ts` (banners y soporte). */
    databaseMode,
  });
}
