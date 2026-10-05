import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { HISTORIAL_PAGE_SIZE, normalizeHistorialPaginas, type HistorialCategoria } from "@/lib/ventas-historial-navigation";
import type { UnifiedVenta } from "@/components/ventas/ventas-list-with-filters";
import { resumenVentaCotizacion } from "@/lib/cotizacion-venta-resumen";

const fuentes = [
  { tabla: "ventas_madera", fecha: "fecha", categoria: "madera", tipo: "venta-madera" },
  { tabla: "ventas_madera_cortada", fecha: "fecha", categoria: "madera", tipo: "madera" },
  { tabla: "ventas_mueble_terminado", fecha: "fecha", categoria: "muebles", tipo: "mueble" },
  { tabla: "servicios_aserradero", fecha: "fecha", categoria: "aserradero", tipo: "aserradero" },
  { tabla: "alquileres", fecha: "fecha_inicio", categoria: "alquileres", tipo: "alquiler" },
  { tabla: "cotizaciones_unificadas", fecha: "fecha", categoria: "otros", tipo: "cotizacion" },
] as const;
type Fuente = (typeof fuentes)[number];
type Registro = {
  id: string;
  cliente_id: string;
  fecha?: string;
  fecha_inicio?: string;
  correlativo?: string | null;
  activo?: string;
  codigo?: string | null;
  monto_total?: number | null;
  total?: number;
  precio_cobrado?: number;
  pies_cubicos?: number;
  mueble_catalogo_id?: string;
  cantidad?: number;
  estado_flujo?: string;
  detalle?: unknown;
  deleted_at?: string | null;
};
type Operacion = { fuente: Fuente; registro: Registro; fecha: string; categoria: UnifiedVenta["categoria"] };

export type VentasHistorialResult = {
  ventas: UnifiedVenta[];
  hasMore: boolean;
  failedCategories: HistorialCategoria[];
  paginas: number;
  cotizacionesLoadFailed: boolean;
};

// Consultas pequeñas evitan que el límite de respuesta de Supabase corte el
// historial al alcanzar 1.000 registros. Se lee una fila extra para detectar el final.
async function readSource(fuente: Fuente, cantidad: number, organizationId: string): Promise<Registro[]> {
  const supabase = getSupabaseServerClient();
  const rows: Registro[] = [];
  for (let offset = 0; offset < cantidad; offset += 250) {
    const hasta = Math.min(offset + 249, cantidad - 1);
    const query = supabase.from(fuente.tabla).select("*").eq("organization_id", organizationId);
    // Servicios de aserradero no tiene esta columna en el esquema del proyecto.
    if (fuente.tipo !== "aserradero") query.is("deleted_at", null);
    if (fuente.tipo === "cotizacion") query.eq("estado_flujo", "cobrada");
    const { data, error } = await query
      .order(fuente.fecha, { ascending: false }).order("id", { ascending: false })
      .range(offset, hasta).abortSignal(AbortSignal.timeout(10_000));
    if (error) throw new Error("No se pudieron cargar las operaciones.");
    const chunk = (data ?? []) as Registro[];
    rows.push(...chunk);
    if (chunk.length < hasta - offset + 1) break;
  }
  return rows;
}

async function readNames(tabla: "clientes" | "muebles_catalogo", ids: string[], organizationId: string) {
  const nombres = new Map<string, string>();
  const unicos = [...new Set(ids)];
  const supabase = getSupabaseServerClient();
  for (let offset = 0; offset < unicos.length; offset += 100) {
    const { data, error } = await supabase.from(tabla).select("id,nombre")
      .eq("organization_id", organizationId).in("id", unicos.slice(offset, offset + 100))
      .abortSignal(AbortSignal.timeout(10_000));
    if (error) throw new Error("No se pudieron cargar los datos de las operaciones.");
    for (const row of data ?? []) nombres.set(row.id, row.nombre);
  }
  return nombres;
}

export async function getVentasHistorial(paginas = 1, organizationId = DEFAULT_ORG_ID): Promise<VentasHistorialResult> {
  paginas = normalizeHistorialPaginas(String(paginas));
  const limite = paginas * HISTORIAL_PAGE_SIZE;
  const failedCategories = new Set<HistorialCategoria>();
  let cotizacionesLoadFailed = false;
  const demo = !hasSupabaseEnv() ? await import("@/lib/demo-store") : null;
  const grupos = await Promise.all(fuentes.map(async (fuente): Promise<Operacion[]> => {
    try {
      const rows: Registro[] = demo
        ? (fuente.tipo === "cotizacion" ? demo.demoCotizacionesUnificadasRows().filter(row => row.estado_flujo === "cobrada")
          : fuente.tipo === "alquiler" ? demo.demoAlquilerRows()
          : fuente.tipo === "mueble" ? demo.demoVentasMuebleTerminadoRows()
          : fuente.tipo === "aserradero" ? demo.demoServiciosAserraderoRows()
          : demo.demoVentasRows().filter(row => Boolean(row.tipo_corte) === (fuente.tipo === "madera")))
          .filter(row => row.organization_id === organizationId && !("deleted_at" in row && row.deleted_at))
        : await readSource(fuente, limite + 1, organizationId);
      return rows.map(registro => ({
        fuente, registro, fecha: registro.fecha_inicio ?? registro.fecha ?? "",
        categoria: fuente.tipo === "cotizacion" ? resumenVentaCotizacion(registro.detalle).categoria : fuente.categoria,
      }));
    } catch {
      if (fuente.tipo === "cotizacion") cotizacionesLoadFailed = true;
      else failedCategories.add(fuente.categoria);
      return [];
    }
  }));
  // El desempate por origen e ID mantiene estable el orden cuando coinciden fechas.
  const operaciones = grupos.flat().filter(row => !failedCategories.has(row.categoria))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.registro.id.localeCompare(a.registro.id) || a.fuente.tipo.localeCompare(b.fuente.tipo));
  const hasMore = operaciones.length > limite;
  const visibles = operaciones.slice(0, limite);
  let clientes: Map<string, string>;
  let muebles: Map<string, string>;
  try {
    [clientes, muebles] = demo ? [
      new Map(demo.demoClientesRows().filter(row => row.organization_id === organizationId).map(row => [row.id, row.nombre])),
      new Map(demo.demoMueblesCatalogoRows().filter(row => row.organization_id === organizationId).map(row => [row.id, row.nombre])),
    ] : await Promise.all([
      readNames("clientes", visibles.map(row => row.registro.cliente_id), organizationId),
      readNames("muebles_catalogo", visibles.flatMap(row => row.registro.mueble_catalogo_id ? [row.registro.mueble_catalogo_id] : []), organizationId),
    ]);
  } catch {
    for (const row of visibles) failedCategories.add(row.categoria);
    return { ventas: [], hasMore, failedCategories: [...failedCategories], paginas, cotizacionesLoadFailed };
  }
  const ventas = visibles.map(({ fuente, registro: v, fecha, categoria }): UnifiedVenta => {
    const concepto = fuente.tipo === "cotizacion" ? `Cotización cobrada ${v.correlativo ?? v.id.slice(0, 8)} · ${resumenVentaCotizacion(v.detalle).rubro}`
      : fuente.tipo === "alquiler" ? `Alquiler Mixer: ${v.activo} (${v.codigo ?? "Contrato"})`
      : fuente.tipo === "mueble" ? `Mueble: ${muebles.get(v.mueble_catalogo_id ?? "") ?? "Mueble terminado"} (x${v.cantidad})`
      : fuente.tipo === "aserradero" ? `Servicio Aserradero (${Number(v.pies_cubicos ?? 0).toFixed(2)} PT)`
      : `Madera: ${v.correlativo ?? "Venta de Madera"}`;
    const importe = fuente.tipo === "alquiler" ? v.monto_total : fuente.tipo === "aserradero" ? v.precio_cobrado : v.total;
    return {
      id: v.id, fecha, clienteNombre: clientes.get(v.cliente_id) ?? "Cliente por definir",
      concepto, total: importe == null || !Number.isFinite(Number(importe)) ? null : Number(importe),
      categoria, detalleHref: `/ventas/detalle/${fuente.tipo}/${v.id}`,
    };
  });
  return { ventas, hasMore, failedCategories: [...failedCategories], paginas, cotizacionesLoadFailed };
}
