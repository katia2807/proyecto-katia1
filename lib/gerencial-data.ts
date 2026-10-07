import { DEFAULT_ORG_ID } from "@/lib/constants";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Tables = Database["public"]["Tables"];
export const GERENCIAL_TABLES = ["movimientos_caja", "clientes", "ventas_madera", "ventas_madera_cortada", "ventas_mueble_terminado", "cotizaciones_unificadas", "alquileres", "servicios_aserradero", "ordenes_produccion", "inventario_productos", "inventario_movimientos"] as const;
export type GerencialTable = typeof GERENCIAL_TABLES[number];
export type GerencialSources = { [T in GerencialTable]: Tables[T]["Row"][] | null };
export type GerencialTab = "hoy" | "pasado" | "futuro";
export const GERENCIAL_LABELS: Record<GerencialTable, string> = {
  movimientos_caja: "Caja", clientes: "Clientes", ventas_madera: "Ventas de madera", ventas_madera_cortada: "Madera cortada", ventas_mueble_terminado: "Muebles terminados", cotizaciones_unificadas: "Cotizaciones", alquileres: "Alquileres", servicios_aserradero: "Aserradero", ordenes_produccion: "Producción", inventario_productos: "Productos", inventario_movimientos: "Movimientos de inventario",
};
const deletedTables = new Set<GerencialTable>(GERENCIAL_TABLES.filter(t => t !== "servicios_aserradero" && t !== "inventario_movimientos"));

export function normalizeGerencialTab(tab: string, alertas = "") {
  if (alertas === "criticas") return "hoy";
  return ["hoy", "pasado", "futuro", "clientes360", "herramientas"].includes(tab) ? tab : "hoy";
}

/** Lectura exclusiva de Centro de Mando. Una página fallida invalida esa fuente completa. */
export async function readGerencialTable<T extends GerencialTable>(table: T, organizationId = DEFAULT_ORG_ID): Promise<Tables[T]["Row"][]> {
  if (!hasSupabaseEnv()) {
    const d = await import("@/lib/demo-store");
    const demo = {
      movimientos_caja: d.demoCajaRows, clientes: d.demoClientesRows,
      ventas_madera: () => d.demoVentasRows().filter(v => !v.tipo_corte), ventas_madera_cortada: () => d.demoVentasRows().filter(v => !!v.tipo_corte),
      ventas_mueble_terminado: d.demoVentasMuebleTerminadoRows, cotizaciones_unificadas: d.demoCotizacionesUnificadasRows,
      alquileres: d.demoAlquilerRows, servicios_aserradero: d.demoServiciosAserraderoRows, ordenes_produccion: d.demoOrdenesProduccionRows,
      inventario_productos: d.demoInventarioProductosRows, inventario_movimientos: d.demoInventarioMovimientosRows,
    };
    return demo[table]().filter(r => r.organization_id === organizationId && !("deleted_at" in r && r.deleted_at) && !("voided_at" in r && r.voided_at)) as unknown as Tables[T]["Row"][];
  }
  const supabase = getSupabaseServerClient();
  const signal = AbortSignal.timeout(20_000);
  const rows: Tables[T]["Row"][] = [];
  const ids = new Set<string>();
  let total: number | null = null;
  do {
    let query = supabase.from(table).select("*", { count: "exact" }).eq("organization_id", organizationId).order("id").range(rows.length, rows.length + 499).abortSignal(signal);
    if (deletedTables.has(table)) query = query.is("deleted_at", null);
    if (table === "movimientos_caja") query = query.is("voided_at", null);
    const { data, error, count } = await query;
    if (error || !data || count === null || !Number.isSafeInteger(count) || count < 0 || (total !== null && total !== count)) throw new Error(`No se pudo comprobar ${GERENCIAL_LABELS[table]}.`);
    total = count;
    if (data.length === 0 && rows.length < total) throw new Error("Lectura incompleta.");
    for (const row of data) {
      if (ids.has(row.id)) throw new Error("La información cambió durante la lectura.");
      ids.add(row.id);
    }
    rows.push(...data as unknown as Tables[T]["Row"][]);
    if (rows.length > total) throw new Error("Lectura inconsistente.");
  } while (rows.length < total);
  return rows;
}

export function gerencialRequiredTables(tab: GerencialTab) {
  return GERENCIAL_TABLES.filter(t => tab === "hoy" || (tab === "futuro" ? !["inventario_productos", "inventario_movimientos", "servicios_aserradero"].includes(t) : t !== "ordenes_produccion"));
}
export async function getGerencialSources(tab: GerencialTab, organizationId = DEFAULT_ORG_ID): Promise<GerencialSources> {
  const required = gerencialRequiredTables(tab);
  const entries = await Promise.all(required.map(async table => {
    try { return [table, await readGerencialTable(table, organizationId)] as const; }
    catch { return [table, null] as const; }
  }));
  return Object.fromEntries(GERENCIAL_TABLES.map(table => [table, entries.find(e => e[0] === table)?.[1] ?? null])) as GerencialSources;
}
