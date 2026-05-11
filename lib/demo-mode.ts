/**
 * Modo base de datos de prueba (demo-store en memoria / disco local).
 * Con `KATIA_USE_DEMO_DB=1` no se usa Supabase aunque existan variables en .env.
 * No activar en producción.
 */
export function isDemoDatabaseMode() {
  const v = process.env.KATIA_USE_DEMO_DB?.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
