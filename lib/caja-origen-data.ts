import { cajaOrigenTipo, isCajaReferenceId } from "@/lib/caja-origen-navigation";
import type { CajaOrigenTipo } from "@/lib/caja-origen-navigation";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import * as demo from "@/lib/demo-store";

const tablas = {
  "venta-madera": "ventas_madera", madera: "ventas_madera_cortada", mueble: "ventas_mueble_terminado",
  aserradero: "servicios_aserradero", alquiler: "alquileres", cotizacion: "cotizaciones_unificadas",
} as const;
type Tabla = (typeof tablas)[keyof typeof tablas] | "movimientos_caja" | "cotizaciones_mueble" | "ordenes_produccion";
type RegistroOrigen = {
  id: string; organization_id: string; deleted_at?: string | null; voided_at?: string | null;
  modulo_origen?: string | null; referencia_id?: string | null; tipo_corte?: string | null;
  cotizacion_id?: string | null; cotizacion_unificada_id?: string | null; estado_flujo?: string;
};
export type CajaOrigenResult =
  | { estado: "encontrado"; href: string }
  | { estado: "sin-vinculo" | "no-disponible" | "movimiento-no-disponible" | "error" };

async function leerRegistro(tabla: Tabla, id: string, organizationId: string): Promise<RegistroOrigen | null> {
  if (!isCajaReferenceId(id)) return null;
  let registro: RegistroOrigen | null;
  if (!hasSupabaseEnv()) {
    const rows = tabla === "movimientos_caja" ? demo.demoCajaRows()
      : tabla === "cotizaciones_mueble" ? demo.demoCotizacionesRows()
      : tabla === "ordenes_produccion" ? demo.demoOrdenesProduccionRows()
      : tabla === "cotizaciones_unificadas" ? demo.demoCotizacionesUnificadasRows()
      : tabla === "alquileres" ? demo.demoAlquilerRows()
      : tabla === "ventas_mueble_terminado" ? demo.demoVentasMuebleTerminadoRows()
      : tabla === "servicios_aserradero" ? demo.demoServiciosAserraderoRows()
      : demo.demoVentasRows().filter(row => Boolean(row.tipo_corte) === (tabla === "ventas_madera_cortada"));
    registro = rows.find(row => row.id === id && row.organization_id === organizationId) ?? null;
  } else {
    const query = getSupabaseServerClient().from(tabla).select("*").eq("organization_id", organizationId).eq("id", id);
    // Estas dos tablas se eliminan físicamente y no tienen deleted_at en el esquema.
    if (tabla !== "servicios_aserradero" && tabla !== "cotizaciones_mueble") query.is("deleted_at", null);
    if (tabla === "movimientos_caja") query.is("voided_at", null);
    const { data, error } = await query.abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
    if (error) throw new Error("No se pudo consultar la operación de origen.");
    registro = data as RegistroOrigen | null;
  }
  return registro && registro.id === id && registro.organization_id === organizationId && !registro.deleted_at && !registro.voided_at ? registro : null;
}

function destino(tipo: Exclude<CajaOrigenTipo, "personalizada">, row: RegistroOrigen): CajaOrigenResult {
  if (tipo === "cotizacion" && row.estado_flujo !== "cobrada") return { estado: "encontrado", href: `/cotizacion/unificada/${row.id}/pdf` };
  return { estado: "encontrado", href: `/ventas/detalle/${tipo}/${row.id}` };
}

async function cotizacionPersonalizada(referencia: string, organizationId: string): Promise<CajaOrigenResult> {
  // En registros antiguos la referencia puede ser la cotización; en producción, la orden.
  const [cotizacion, orden] = await Promise.all([
    leerRegistro("cotizaciones_mueble", referencia, organizationId),
    leerRegistro("ordenes_produccion", referencia, organizationId),
  ]);
  if (cotizacion && orden) return { estado: "no-disponible" };
  if (cotizacion) return { estado: "encontrado", href: `/ventas/muebles-personalizados/${cotizacion.id}/pdf` };
  if (!orden || Boolean(orden.cotizacion_id) === Boolean(orden.cotizacion_unificada_id)) return { estado: "no-disponible" };
  if (orden.cotizacion_id) {
    const origen = await leerRegistro("cotizaciones_mueble", orden.cotizacion_id, organizationId);
    return origen ? { estado: "encontrado", href: `/ventas/muebles-personalizados/${origen.id}/pdf` } : { estado: "no-disponible" };
  }
  const origen = await leerRegistro("cotizaciones_unificadas", orden.cotizacion_unificada_id!, organizationId);
  return origen ? destino("cotizacion", origen) : { estado: "no-disponible" };
}

/** Consulta de solo lectura: cada vínculo se comprueba en la empresa del usuario. */
export async function getCajaOrigen(id: string, organizationId: string): Promise<CajaOrigenResult> {
  try {
    const movimiento = await leerRegistro("movimientos_caja", id, organizationId);
    if (!movimiento) return { estado: "movimiento-no-disponible" };
    const tipo = cajaOrigenTipo(movimiento.modulo_origen ?? null, movimiento.referencia_id ?? null);
    if (!tipo) return { estado: "sin-vinculo" };
    if (tipo === "personalizada") return await cotizacionPersonalizada(movimiento.referencia_id!, organizationId);
    const origen = await leerRegistro(tablas[tipo], movimiento.referencia_id!, organizationId);
    return origen ? destino(tipo, origen) : { estado: "no-disponible" };
  } catch {
    return { estado: "error" };
  }
}
