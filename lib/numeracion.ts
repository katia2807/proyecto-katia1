import "server-only";

import { DEFAULT_ORG_ID } from "@/lib/constants";
import { nextCorrelativoFromStore, readCorrelativoCounter } from "@/lib/demo-store";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type TipoCorrelativo =
  | "cotizacion" // N°0025 (4 dígitos sin año, igual que las usadas por Katia hoy)
  | "contrato_alquiler" // CT-2026-0001
  | "orden_produccion" // OP-2026-0001
  | "servicio_aserradero" // SA-2026-0001
  | "venta_madera" // MA-2026-0001
  | "venta_mueble" // VM-2026-0001
  | "venta_pdf"; // PDF-2026-0001

const formatos: Record<TipoCorrelativo, (n: number, anio: number) => string> = {
  cotizacion: (n) => `N°${String(n).padStart(4, "0")}`,
  contrato_alquiler: (n, anio) => `CT-${anio}-${String(n).padStart(4, "0")}`,
  orden_produccion: (n, anio) => `OP-${anio}-${String(n).padStart(4, "0")}`,
  servicio_aserradero: (n, anio) => `SA-${anio}-${String(n).padStart(4, "0")}`,
  venta_madera: (n, anio) => `MA-${anio}-${String(n).padStart(4, "0")}`,
  venta_mueble: (n, anio) => `VM-${anio}-${String(n).padStart(4, "0")}`,
  venta_pdf: (n, anio) => `PDF-${anio}-${String(n).padStart(4, "0")}`,
};

function correlativoStorageKey(tipo: TipoCorrelativo, anio: number): string {
  return tipo === "cotizacion" ? "cotizacion" : `${tipo}_${anio}`;
}

/**
 * Devuelve el siguiente correlativo formateado para el tipo dado.
 *
 * Para cotizaciones se utiliza un único contador global compartido entre años
 * (manteniendo el formato N°XXXX que Katia ya viene usando con el cliente Lenin
 * en N°0025). Los demás tipos rotan por año, así que el contador se reinicia
 * cuando cambia el año actual.
 *
 * Con Supabase configurado, el contador vive en la tabla `correlativos` (RPC
 * con bloqueo de fila). Sin Supabase, usa `store.json` vía demo-store.
 */
export async function nextCorrelativo(
  tipo: TipoCorrelativo,
  anio: number = new Date().getFullYear(),
): Promise<string> {
  const key = correlativoStorageKey(tipo, anio);
  let numero: number;
  if (hasSupabaseEnv()) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.rpc("next_correlativo_valor", {
      p_org_id: DEFAULT_ORG_ID,
      p_tipo: key,
    });
    if (error || data === null || typeof data !== "number") {
      throw new Error(error?.message ?? "No se pudo obtener correlativo.");
    }
    numero = data;
  } else {
    numero = nextCorrelativoFromStore(key);
  }
  return formatos[tipo](numero, anio);
}

/**
 * Variante "peek": devuelve el correlativo que se asignaría sin consumir el
 * contador. Útil para previsualizar en formularios antes de guardar.
 */
export async function previewCorrelativo(
  tipo: TipoCorrelativo,
  anio: number = new Date().getFullYear(),
): Promise<string> {
  const key = correlativoStorageKey(tipo, anio);
  let numero: number;
  if (hasSupabaseEnv()) {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("correlativos")
      .select("ultimo_valor")
      .eq("org_id", DEFAULT_ORG_ID)
      .eq("tipo", key)
      .maybeSingle();
    numero = (data?.ultimo_valor ?? 0) + 1;
  } else {
    numero = readCorrelativoCounter(key) + 1;
  }
  return formatos[tipo](numero, anio);
}
