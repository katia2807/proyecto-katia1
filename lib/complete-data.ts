import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Tables = Database["public"]["Tables"];
const demoKeys = {
  movimientos_caja: "caja", clientes: "clientes", proveedores: "proveedores", choferes: "choferes",
  registros_generales: "registrosGenerales", registro_categorias: "registroCategorias",
  compras_madera: "comprasMadera", ventas_madera: "ventas", ventas_madera_cortada: "ventas",
  ventas_mueble_terminado: "ventasMuebleTerminado", muebles_catalogo: "mueblesCatalogo",
  empleados: "empleados", adelantos: "adelantos", sueldos: "sueldos", cierres_mensuales: "cierres",
  alquileres: "alquileres", cotizaciones_mueble: "cotizaciones", cotizaciones_unificadas: "cotizacionesUnificadas",
  inventario_productos: "inventarioProductos", inventario_movimientos: "inventarioMovimientos",
  servicios_aserradero: "serviciosAserradero", ordenes_produccion: "ordenesProduccion",
  servicios_especiales_tarifa: "serviciosEspecialesTarifa",
} as const;
export type CompleteTable = keyof typeof demoKeys;
const deletedTables = new Set<CompleteTable>(["movimientos_caja", "clientes", "ventas_madera", "ventas_madera_cortada", "ventas_mueble_terminado", "cotizaciones_unificadas", "alquileres", "inventario_productos", "ordenes_produccion"]);

/** Lectura íntegra, acotada a una organización. Un fallo nunca devuelve una muestra parcial. */
export async function readCompleteTable<T extends CompleteTable>(table: T, organizationId: string): Promise<Tables[T]["Row"][]> {
  if (!hasSupabaseEnv()) {
    const { demoExportStore } = await import("@/lib/demo-store");
    const snapshot = demoExportStore();
    const rows = snapshot[demoKeys[table]] as unknown as Record<string, unknown>[];
    return rows.filter(row => row.organization_id === organizationId && !row.deleted_at && !row.voided_at
      && (table !== "ventas_madera" || !row.tipo_corte) && (table !== "ventas_madera_cortada" || !!row.tipo_corte)) as unknown as Tables[T]["Row"][];
  }
  const supabase = getSupabaseServerClient();
  const rows: Tables[T]["Row"][] = [];
  const ids = new Set<string>();
  let total: number | null = null;
  const signal = AbortSignal.timeout(20_000);
  do {
    let query = supabase.from(table).select("*", { count: "exact" }).eq("organization_id", organizationId).order("id").range(rows.length, rows.length + 499).abortSignal(signal);
    if (deletedTables.has(table)) query = query.is("deleted_at", null);
    if (table === "movimientos_caja") query = query.is("voided_at", null);
    const { data, error, count } = await query;
    if (error || !data || count === null || !Number.isSafeInteger(count) || count < 0 || (total !== null && count !== total)) throw new Error(`No se pudo consultar el historial completo de ${table}. Intenta nuevamente.`);
    total = count;
    if (!data.length && rows.length < total) throw new Error("La consulta devolvió un historial incompleto.");
    for (const row of data) {
      if (ids.has(row.id)) throw new Error("Los datos cambiaron durante la consulta. Actualiza la página.");
      ids.add(row.id);
    }
    rows.push(...data as unknown as Tables[T]["Row"][]);
    if (rows.length > total) throw new Error("Los datos cambiaron durante la consulta. Actualiza la página.");
  } while (rows.length < total);
  return rows;
}

export async function readCompleteVentas(organizationId: string) {
  const [ventas, cortadas] = await Promise.all([readCompleteTable("ventas_madera",organizationId), readCompleteTable("ventas_madera_cortada",organizationId)]);
  return [...ventas, ...cortadas].map(v => ({ ...v, correlativo: "correlativo" in v && typeof v.correlativo === "string" ? v.correlativo : null, tipo_entrega: "tipo_entrega" in v ? v.tipo_entrega : null, modalidad_pago: "modalidad_pago" in v ? v.modalidad_pago : null, tipo_corte: "tipo_corte" in v ? v.tipo_corte : null, total_pt: "total_pt" in v ? v.total_pt : null })).sort((a,b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
}
