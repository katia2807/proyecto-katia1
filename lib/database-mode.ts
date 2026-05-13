import "server-only";

import { isDemoDatabaseMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getServerSupabaseCredentials } from "@/lib/supabase/temp-credentials";

export type DatabaseModeSummary = {
  /** true = lecturas/escrituras van a Postgres vía Supabase (service role en servidor). */
  usesSupabaseForData: boolean;
  /** true = `KATIA_USE_DEMO_DB` fuerza ignorar Supabase para datos. */
  demoForcedByEnv: boolean;
  /** URL + anon visibles al proceso (login / cliente servidor). */
  hasSupabaseAuthCreds: boolean;
  /** Service role presente (necesario para que `hasSupabaseEnv()` sea true). */
  hasServiceRole: boolean;
};

/**
 * Resumen para diagnóstico (health, banners). No exponer secretos.
 */
export function getDatabaseModeSummary(): DatabaseModeSummary {
  const creds = getServerSupabaseCredentials();
  return {
    usesSupabaseForData: hasSupabaseEnv(),
    demoForcedByEnv: isDemoDatabaseMode(),
    hasSupabaseAuthCreds: Boolean(creds.url?.trim() && creds.anonKey?.trim()),
    hasServiceRole: Boolean(creds.serviceRoleKey?.trim()),
  };
}
