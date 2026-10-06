import { DEFAULT_ORG_ID } from "@/lib/constants";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/runtime";
import { fechaHoyPeru } from "@/lib/utils";
import { importeCliente } from "@/lib/clientes-model";
import type { Database } from "@/lib/supabase/types";

type Tables = Database["public"]["Tables"];
type TableName = keyof Tables;
type Row<T extends TableName> = Tables[T]["Row"];
export type CotizacionCliente = {
  id: string; cliente_id: string; fecha: string; correlativo: string | null; tipo: string;
  especie_madera: string; estado: string; monto: number | null; href: string; actual: boolean;
};
export type VentaMaderaCliente = Pick<Row<"ventas_madera">, "id" | "cliente_id" | "fecha" | "estado" | "total" | "correlativo"> & { comprobanteTipo: "madera" | "venta-madera" };

// La ficha consulta por cliente antes de paginar. El listado pagina las fuentes
// completas: un límite global de ventas recientes no sirve para sumar por cliente.
export async function readClientesTable<T extends TableName>(tabla: T, deleted = false, clienteId?: string): Promise<Row<T>[]> {
  const rows: Row<T>[] = [];
  const supabase = getSupabaseServerClient();
  const signal = AbortSignal.timeout(20_000);
  for (let offset = 0; ; offset += 500) {
    const query = supabase.from(tabla).select("*").eq("organization_id", DEFAULT_ORG_ID);
    if (deleted) query.is("deleted_at", null);
    if (clienteId) query.eq("cliente_id", clienteId);
    const { data, error } = await query.order("id").range(offset, offset + 499).abortSignal(signal);
    if (error || !data) throw new Error("No se pudieron cargar los datos de clientes.");
    const chunk = data as Row<T>[];
    rows.push(...chunk);
    if (chunk.length < 500) return rows;
  }
}

export type ClienteHistorial = {
  cotizaciones: CotizacionCliente[];
  ventasMadera: VentaMaderaCliente[];
  ventasMuebles: Row<"ventas_mueble_terminado">[];
  contratos: Row<"alquileres">[];
  servicios: Row<"servicios_aserradero">[];
  ordenes: Row<"ordenes_produccion">[];
};

export async function getClienteHistorial(clienteId?: string): Promise<ClienteHistorial> {
  const demo = !hasSupabaseEnv() ? await import("@/lib/demo-store") : null;
  const visible = (row: { organization_id: string; cliente_id?: string | null; deleted_at?: string | null }) => row.organization_id === DEFAULT_ORG_ID && !row.deleted_at && (!clienteId || row.cliente_id === clienteId);
  const [anteriores, actuales, madera, cortada, ventasMuebles, contratos, servicios, ordenes] = demo ? [
    demo.demoCotizacionesRows().filter(visible) as Row<"cotizaciones_mueble">[],
    demo.demoCotizacionesUnificadasRows().filter(visible) as Row<"cotizaciones_unificadas">[],
    demo.demoVentasRows().filter(visible).filter(v => !v.tipo_corte),
    demo.demoVentasRows().filter(visible).filter(v => v.tipo_corte),
    demo.demoVentasMuebleTerminadoRows().filter(visible) as Row<"ventas_mueble_terminado">[],
    demo.demoAlquilerRows().filter(visible) as Row<"alquileres">[],
    demo.demoServiciosAserraderoRows().filter(visible) as Row<"servicios_aserradero">[],
    demo.demoOrdenesProduccionRows().filter(visible) as Row<"ordenes_produccion">[],
  ] : await Promise.all([
    readClientesTable("cotizaciones_mueble", false, clienteId), readClientesTable("cotizaciones_unificadas", true, clienteId),
    readClientesTable("ventas_madera", true, clienteId), readClientesTable("ventas_madera_cortada", true, clienteId),
    readClientesTable("ventas_mueble_terminado", true, clienteId), readClientesTable("alquileres", true, clienteId),
    readClientesTable("servicios_aserradero", false, clienteId), readClientesTable("ordenes_produccion", true, clienteId),
  ]);
  const cotizaciones = new Map<string, CotizacionCliente>();
  for (const c of anteriores) cotizaciones.set(c.id, {
    id: c.id, cliente_id: c.cliente_id, fecha: c.fecha, correlativo: "correlativo" in c && typeof c.correlativo === "string" ? c.correlativo : null,
    tipo: c.tipo === "servicio_corte" ? "Servicio de corte" : "Mueble personalizado", especie_madera: c.especie_madera,
    estado: c.estado, monto: importeCliente(c.precio_acordado), actual: false, href: `/ventas/muebles-personalizados/${c.id}/pdf`,
  });
  for (const c of actuales) cotizaciones.set(c.id, {
    id: c.id, cliente_id: c.cliente_id, fecha: c.fecha, correlativo: c.correlativo,
    tipo: "Cotización actual", especie_madera: "—", estado: c.estado_flujo, monto: importeCliente(c.total),
    actual: true, href: `/cotizacion?editar=${c.id}#cotizacion-wizard`,
  });
  const recientes = <T extends { fecha: string; id: string }>(rows: T[]) => rows.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  return {
    cotizaciones: recientes([...cotizaciones.values()]),
    ventasMadera: recientes([...madera.map(v => ({ ...v, comprobanteTipo: "venta-madera" as const })), ...cortada.map(v => ({ ...v, correlativo: "correlativo" in v ? v.correlativo as string | null : null, comprobanteTipo: "madera" as const }))]),
    ventasMuebles: recientes(ventasMuebles), contratos: contratos.sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio) || b.id.localeCompare(a.id)),
    servicios: recientes(servicios), ordenes,
  };
}

export type ClienteResumen = { operaciones: number; total: number; importesPorDefinir: number; pedidosActivos: number; cobrosVencidos: number };
export function cobrosClientes(historial: ClienteHistorial, hoy = fechaHoyPeru()) {
  // Conserva los criterios de crédito existentes; no deduce deuda del estado del cliente.
  return [
    ...historial.ventasMuebles.filter(v => v.modalidad_pago === "credito" && v.fecha_pago_credito && v.fecha_pago_credito < hoy && v.estado_entrega !== "entregado")
      .map(v => ({ id: v.id, cliente_id: v.cliente_id, referencia: v.correlativo ?? v.id.slice(0, 8), fecha_vencimiento: v.fecha_pago_credito!, monto: importeCliente(v.total) })),
    ...historial.contratos.filter(c => c.modalidad_pago === "credito" && c.fecha_pago_credito && c.fecha_pago_credito < hoy && c.estado === "abierto")
      .map(c => ({ id: c.id, cliente_id: c.cliente_id, referencia: c.codigo ?? c.id.slice(0, 8), fecha_vencimiento: c.fecha_pago_credito!, monto: importeCliente(c.monto_total) })),
  ].sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
}
export function resumenClientes(historial: ClienteHistorial, hoy = fechaHoyPeru()) {
  const resumen = new Map<string, ClienteResumen>();
  const get = (id: string) => {
    const r = resumen.get(id) ?? { operaciones: 0, total: 0, importesPorDefinir: 0, pedidosActivos: 0, cobrosVencidos: 0 };
    resumen.set(id, r); return r;
  };
  const add = (id: string, importe: unknown, incluir: boolean) => {
    const r = get(id); r.operaciones++;
    const valor = importeCliente(importe);
    if (valor === null) r.importesPorDefinir++;
    else if (incluir) r.total = Math.round((r.total + valor) * 100) / 100;
  };
  for (const c of historial.cotizaciones) add(c.cliente_id, c.monto, c.actual && c.estado === "cobrada");
  for (const v of historial.ventasMadera) add(v.cliente_id, v.total, v.estado === "confirmada");
  for (const v of historial.ventasMuebles) {
    add(v.cliente_id, v.total, true);
  }
  for (const c of historial.contratos) {
    add(c.cliente_id, c.monto_total, c.estado === "cerrado");
  }
  for (const s of historial.servicios) if (s.cliente_id) add(s.cliente_id, s.precio_cobrado, true);
  for (const o of historial.ordenes) if (o.estado !== "terminado" && o.estado !== "entregado") get(o.cliente_id).pedidosActivos++;
  for (const c of cobrosClientes(historial, hoy)) get(c.cliente_id).cobrosVencidos++;
  return resumen;
}
