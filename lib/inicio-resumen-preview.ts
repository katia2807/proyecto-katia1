import { isDemoDatabaseMode } from "@/lib/demo-mode";

/** Solo una propuesta local: nunca sustituye Inicio en producción ni con Supabase. */
export function isInicioResumenPreview() {
  return process.env.NODE_ENV === "development"
    && isDemoDatabaseMode()
    && process.env.KATIA_INICIO_PREVIEW === "1";
}
