import Link from "next/link";
import { isDemoDatabaseMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/runtime";
import { cn } from "@/lib/utils";

/**
 * Aviso global cuando los datos no van a Supabase/Postgres (demo-store o credenciales incompletas).
 * En producción con Supabase bien configurado no renderiza nada.
 */
export function DatabaseModeBanner() {
  if (hasSupabaseEnv()) {
    return null;
  }

  const isProd = process.env.NODE_ENV === "production";
  const forcedDemo = isDemoDatabaseMode();

  const title = forcedDemo
    ? "Modo demo forzado (KATIA_USE_DEMO_DB)"
    : "Datos sin Supabase completo (almacén demo)";

  const body = forcedDemo
    ? "Esta instancia ignora Supabase para operaciones de datos: se usa el almacén demo en el servidor (JSON / memoria), no tu base Postgres. No hay migración automática a la base real: quitá la variable KATIA_USE_DEMO_DB, configurá SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY, y redeploy."
    : isProd
      ? "Falta al menos una de: SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY (la service role es obligatoria para que el servidor escriba en Postgres). Mientras tanto la app usa el mismo almacén demo que en desarrollo local: no es un “borrador” que luego sube solo a producción."
      : "En local, sin las tres credenciales (o con temp/supabase.temp.txt incompleto), los datos se guardan en el almacén demo (p. ej. store.json en el directorio de datos del servidor). Para usar la base real, completá .env y reiniciá el servidor.";

  return (
    <div
      role="status"
      className={cn(
        "border-b px-4 py-3 text-sm leading-relaxed",
        isProd || forcedDemo
          ? "border-red-500/50 bg-red-950/80 text-red-50"
          : "border-amber-500/40 bg-amber-950/50 text-amber-50",
      )}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs opacity-95">{body}</p>
      <p className="mt-2 text-xs opacity-90">
        Diagnóstico JSON:{" "}
        <Link href="/api/health" className="underline underline-offset-2 hover:opacity-100">
          /api/health
        </Link>{" "}
        (campos <code className="rounded bg-black/25 px-1">demoMode</code>,{" "}
        <code className="rounded bg-black/25 px-1">supabaseConfigured</code>,{" "}
        <code className="rounded bg-black/25 px-1">supabaseServerDataReady</code>).
      </p>
    </div>
  );
}
