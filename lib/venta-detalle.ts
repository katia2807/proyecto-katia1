import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resumenVentaCotizacion } from "@/lib/cotizacion-venta-resumen";

const tipos = {
  madera: { tabla: "ventas_madera_cortada", operacion: "Venta de madera cortada" },
  "venta-madera": { tabla: "ventas_madera", operacion: "Venta de madera" },
  mueble: { tabla: "ventas_mueble_terminado", operacion: "Venta de muebles" },
  aserradero: { tabla: "servicios_aserradero", operacion: "Servicio de aserradero" },
  alquiler: { tabla: "alquileres", operacion: "Alquiler" },
  cotizacion: { tabla: "cotizaciones_unificadas", operacion: "Venta desde cotización guiada" },
} as const;

export type VentaDetalleTipo = keyof typeof tipos;

type RegistroDetalle = {
  id: string;
  organization_id: string;
  cliente_id: string;
  fecha?: string | null;
  fecha_inicio?: string | null;
  total?: number | string | null;
  precio_cobrado?: number | string | null;
  monto_total?: number | string | null;
  correlativo?: string | null;
  codigo?: string | null;
  activo?: string | null;
  estado?: string | null;
  dias_alquiler?: number | null;
  tarifa_unidad?: string | null;
  deleted_at?: string | null;
  estado_flujo?: string;
  detalle?: unknown;
};

export type VentaDetalle = {
  operacion: string;
  clienteNombre: string;
  fecha: string;
  referencia: string | null;
  total: number | null;
  impresionHref: string;
  impresionLabel: string;
  completarHref: string | null;
  estado?: string;
  descripcion?: string | null;
};

export function isVentaDetalleTipo(tipo: string): tipo is VentaDetalleTipo {
  return Object.hasOwn(tipos, tipo);
}

async function getRegistro(tipo: VentaDetalleTipo, id: string, organizationId: string): Promise<RegistroDetalle | null> {
  if (!hasSupabaseEnv()) {
    const demo = await import("@/lib/demo-store");
    const rows = tipo === "cotizacion" ? demo.demoCotizacionesUnificadasRows().filter(row => row.estado_flujo === "cobrada")
      : tipo === "alquiler" ? demo.demoAlquilerRows()
      : tipo === "mueble" ? demo.demoVentasMuebleTerminadoRows()
      : tipo === "aserradero" ? demo.demoServiciosAserraderoRows()
      : demo.demoVentasRows().filter((row) => Boolean(row.tipo_corte) === (tipo === "madera"));
    return rows.find((row) => row.id === id && row.organization_id === organizationId) ?? null;
  }
  const query = getSupabaseServerClient()
    .from(tipos[tipo].tabla)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id);
  if (tipo === "cotizacion") query.eq("estado_flujo", "cobrada");
  if (tipo !== "aserradero") query.is("deleted_at", null);
  const { data, error } = await query.abortSignal(AbortSignal.timeout(10_000))
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el detalle de la operación.");
  return data as RegistroDetalle | null;
}

async function getClienteNombre(id: string, organizationId: string) {
  if (!hasSupabaseEnv()) {
    const { demoClientesRows } = await import("@/lib/demo-store");
    return demoClientesRows().find((row) => row.id === id && row.organization_id === organizationId)?.nombre;
  }
  const { data, error } = await getSupabaseServerClient()
    .from("clientes")
    .select("nombre")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .abortSignal(AbortSignal.timeout(10_000))
    .maybeSingle();
  if (error) throw new Error("No se pudieron cargar los datos del cliente.");
  return data?.nombre as string | undefined;
}

export async function getVentaDetalle(tipo: VentaDetalleTipo, id: string, organizationId: string): Promise<VentaDetalle | null> {
  const row = await getRegistro(tipo, id, organizationId);
  if (!row || row.deleted_at || (tipo === "cotizacion" && row.estado_flujo !== "cobrada")) return null;
  const clienteNombre = await getClienteNombre(row.cliente_id, organizationId);
  const importe = tipo === "alquiler" ? row.monto_total
    : tipo === "aserradero" ? row.precio_cobrado : row.total;
  const total = importe == null || importe === "" || !Number.isFinite(Number(importe)) ? null : Number(importe);
  const alquiler = tipo === "alquiler";
  const cotizacion = tipo === "cotizacion" ? resumenVentaCotizacion(row.detalle) : null;
  const necesitaCompletar = alquiler && (
    total == null || !row.tarifa_unidad || row.dias_alquiler == null || row.dias_alquiler <= 0
  );
  return {
    operacion: cotizacion ? cotizacion.rubro : alquiler && row.activo ? `Alquiler de ${row.activo}` : tipos[tipo].operacion,
    clienteNombre: clienteNombre || "Cliente por definir",
    fecha: (alquiler ? row.fecha_inicio : row.fecha) || "",
    referencia: (alquiler ? row.codigo : row.correlativo) || null,
    total,
    impresionHref: cotizacion ? `/cotizacion/unificada/${id}/pdf` : alquiler ? `/ventas/alquiler-mixer/${id}/pdf` : `/ventas/comprobante/${tipo}/${id}`,
    impresionLabel: cotizacion ? "Ver documento de cotización" : alquiler ? "Imprimir contrato" : "Imprimir comprobante",
    completarHref: necesitaCompletar && row.estado === "abierto"
      ? `/ventas/alquiler-mixer/${id}/editar?desde=detalle` : null,
    ...(cotizacion ? { estado: "Cobrada", descripcion: cotizacion.descripcion } : {}),
  };
}
