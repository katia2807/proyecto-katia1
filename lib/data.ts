import { DEFAULT_ORG_ID } from "@/lib/constants";
import {
  demoAlquilerRows,
  demoCajaRows,
  demoChoferesRows,
  demoCierresRows,
  demoClientesRows,
  demoComprasMaderaRows,
  demoCortesRows,
  demoCotizacionesRows,
  demoCotizacionesUnificadasRows,
  demoGetCotizacionUnificada,
  demoInventarioMovimientosRows,
  demoInventarioProductosRows,
  demoInventarioResumen,
  demoMueblesCatalogoRows,
  demoOrdenesProduccionRows,
  demoPersonalRows,
  demoProveedoresRows,
  demoRegistroCategoriasRows,
  demoRegistrosGeneralesRows,
  demoSecurityControlRows,
  demoServiciosAserraderoRows,
  demoServiciosEspecialesTarifaRows,
  demoSnapshot,
  type ServicioEspecialTarifaRow,
  demoUtilidadRows,
  demoVentasMuebleTerminadoRows,
  demoVentasRows,
  demoZonasEntregaRows,
  type SecurityControlItem,
} from "@/lib/demo-store";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type CajaRow = Database["public"]["Tables"]["movimientos_caja"]["Row"];
type VentaRow = Database["public"]["Tables"]["ventas_madera"]["Row"];
type AlquilerRow = Database["public"]["Tables"]["alquileres"]["Row"];
type ChoferDbRow = Database["public"]["Tables"]["choferes"]["Row"];
type ZonaEntregaDbRow = Database["public"]["Tables"]["zonas_entrega"]["Row"];
type EmpleadoRow = Database["public"]["Tables"]["empleados"]["Row"];
type AdelantoRow = Database["public"]["Tables"]["adelantos"]["Row"];
type SueldoRow = Database["public"]["Tables"]["sueldos"]["Row"];
type AlertaRow = Database["public"]["Tables"]["alertas_operativas"]["Row"];
type CotizacionRow = Database["public"]["Tables"]["cotizaciones_mueble"]["Row"];
type ClienteRow = Database["public"]["Tables"]["clientes"]["Row"];
type ProveedorRow = Database["public"]["Tables"]["proveedores"]["Row"];
type RegistroCategoriaRow = Database["public"]["Tables"]["registro_categorias"]["Row"];
type RegistroGeneralRow = Database["public"]["Tables"]["registros_generales"]["Row"];
type CompraMaderaRow = Database["public"]["Tables"]["compras_madera"]["Row"];
type UtilidadRow = Database["public"]["Views"]["utilidad_mensual"]["Row"];
type CorteRow = Database["public"]["Tables"]["cotizacion_cortes"]["Row"];
type CotizacionUnificadaRow = Database["public"]["Tables"]["cotizaciones_unificadas"]["Row"];
type CierreRow = Database["public"]["Tables"]["cierres_mensuales"]["Row"];
type InventarioProductoRow = Database["public"]["Tables"]["inventario_productos"]["Row"];
type InventarioMovimientoRow = Database["public"]["Tables"]["inventario_movimientos"]["Row"];
type OrdenProduccionRow = Database["public"]["Tables"]["ordenes_produccion"]["Row"];
type MuebleCatalogoRow = Database["public"]["Tables"]["muebles_catalogo"]["Row"];
type VentaMuebleTerminadoRow = Database["public"]["Tables"]["ventas_mueble_terminado"]["Row"];
type ServicioAserraderoRow = Database["public"]["Tables"]["servicios_aserradero"]["Row"];

const fallback = {
  caja: [] as CajaRow[],
  ventas: [] as VentaRow[],
  alquileres: [] as AlquilerRow[],
  empleados: [] as EmpleadoRow[],
  adelantos: [] as AdelantoRow[],
  sueldos: [] as SueldoRow[],
  alertas: [] as AlertaRow[],
  cotizaciones: [] as CotizacionRow[],
  clientes: [] as ClienteRow[],
  proveedores: [] as ProveedorRow[],
  registroCategorias: [] as RegistroCategoriaRow[],
  registrosGenerales: [] as RegistroGeneralRow[],
  comprasMadera: [] as CompraMaderaRow[],
  utilidad: [] as UtilidadRow[],
  cortes: [] as CorteRow[],
  cotizacionesUnificadas: [] as CotizacionUnificadaRow[],
  cierres: [] as CierreRow[],
  inventarioProductos: [] as InventarioProductoRow[],
  inventarioMovimientos: [] as InventarioMovimientoRow[],
  ordenesProduccion: [] as OrdenProduccionRow[],
  mueblesCatalogo: [] as MuebleCatalogoRow[],
  ventasMuebleTerminado: [] as VentaMuebleTerminadoRow[],
  serviciosAserradero: [] as ServicioAserraderoRow[],
  choferes: [] as ChoferDbRow[],
  zonasEntrega: [] as ZonaEntregaDbRow[],
};

async function safeQuery<T>(fn: () => Promise<T>, fallbackValue: T) {
  try {
    return await fn();
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      console.error("[safeQuery]", error);
    }
    return fallbackValue;
  }
}

export async function getDashboardSnapshot() {
  if (!hasSupabaseEnv()) {
    return demoSnapshot();
  }
  try {
    const supabase = getSupabaseServerClient();
    const orgId = DEFAULT_ORG_ID;
    const now = new Date();
    const anioMesActual = now.getFullYear();
    const mesCalendarioActual = now.getMonth() + 1;

    const [caja, ventas, alquileres, empleados, alertas, utilidad, utilidadMesActual] = await Promise.all([
      safeQuery(async () => {
        const { data } = await supabase
          .from("movimientos_caja")
          .select("*")
          .eq("organization_id", orgId)
          .is("voided_at", null)
          .order("fecha", { ascending: false })
          .limit(8);
        return data ?? fallback.caja;
      }, fallback.caja),
      safeQuery(async () => {
        const { data } = await supabase
          .from("ventas_madera")
          .select("*")
          .eq("organization_id", orgId)
          .order("fecha", { ascending: false })
          .limit(8);
        return data ?? fallback.ventas;
      }, fallback.ventas),
      safeQuery(async () => {
        const { data } = await supabase
          .from("alquileres")
          .select("*")
          .eq("organization_id", orgId)
          .order("fecha_inicio", { ascending: false })
          .limit(8);
        return data ?? fallback.alquileres;
      }, fallback.alquileres),
      safeQuery(async () => {
        const { data } = await supabase
          .from("empleados")
          .select("*")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false });
        return data ?? fallback.empleados;
      }, fallback.empleados),
      safeQuery(async () => {
        const { data } = await supabase
          .from("alertas_operativas")
          .select("*")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(8);
        return data ?? fallback.alertas;
      }, fallback.alertas),
      safeQuery(async () => {
        const { data } = await supabase
          .from("utilidad_mensual")
          .select("*")
          .eq("organization_id", orgId)
          .order("anio", { ascending: false })
          .order("mes", { ascending: false })
          .limit(6);
        return data ?? fallback.utilidad;
      }, fallback.utilidad),
      safeQuery(async () => {
        const { data } = await supabase
          .from("utilidad_mensual")
          .select("ingresos, egresos")
          .eq("organization_id", orgId)
          .eq("anio", anioMesActual)
          .eq("mes", mesCalendarioActual)
          .maybeSingle();
        return data;
      }, null),
    ]);

    return {
      caja,
      ventas,
      alquileres,
      empleados,
      alertas,
      utilidad,
      ingresosMesActual: Number(utilidadMesActual?.ingresos ?? 0),
      egresosMesActual: Number(utilidadMesActual?.egresos ?? 0),
    };
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      console.error("[getDashboardSnapshot]", error);
    }
    return demoSnapshot();
  }
}

export async function getCajaRows() {
  if (!hasSupabaseEnv()) {
    return demoCajaRows();
  }
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("movimientos_caja")
    .select("*")
    .eq("organization_id", DEFAULT_ORG_ID)
    .is("voided_at", null)
    .order("fecha", { ascending: false })
    .limit(50);
  return data ?? fallback.caja;
}

export async function getVentasRows() {
  if (!hasSupabaseEnv()) {
    return demoVentasRows();
  }
  const supabase = getSupabaseServerClient();
  return safeQuery(async () => {
    const [{ data: vm }, { data: vc }] = await Promise.all([
      supabase
        .from("ventas_madera")
        .select("*")
        .eq("organization_id", DEFAULT_ORG_ID)
        .order("fecha", { ascending: false })
        .limit(80),
      supabase
        .from("ventas_madera_cortada")
        .select("*")
        .eq("organization_id", DEFAULT_ORG_ID)
        .order("fecha", { ascending: false })
        .limit(80),
    ]);
    const base = vm ?? fallback.ventas;
    const cortadaRows = vc ?? [];
    const cortadaAsVentas: VentaRow[] = cortadaRows.map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      cliente_id: row.cliente_id,
      fecha: row.fecha,
      estado: row.estado,
      total: Number(row.total),
      correlativo: null,
      created_at: row.created_at,
      created_by: row.created_by,
    }));
    return [...cortadaAsVentas, ...base]
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
      .slice(0, 50);
  }, fallback.ventas);
}

export async function getClientesRows() {
  if (!hasSupabaseEnv()) {
    return demoClientesRows();
  }
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("clientes")
    .select("*")
    .eq("organization_id", DEFAULT_ORG_ID)
    .order("nombre");
  return data ?? fallback.clientes;
}

export async function getProveedoresRows() {
  if (!hasSupabaseEnv()) {
    return demoProveedoresRows();
  }
  const supabase = getSupabaseServerClient();
  return safeQuery(async () => {
    const { data } = await supabase
      .from("proveedores")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .order("nombre");
    return data ?? fallback.proveedores;
  }, fallback.proveedores);
}

export async function getRegistroCategoriasRows() {
  if (!hasSupabaseEnv()) {
    return demoRegistroCategoriasRows();
  }
  const supabase = getSupabaseServerClient();
  return safeQuery(async () => {
    const { data } = await supabase
      .from("registro_categorias")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .eq("activo", true)
      .order("nombre");
    return data ?? fallback.registroCategorias;
  }, fallback.registroCategorias);
}

export async function getRegistrosGeneralesRows(categoriaId?: string) {
  if (!hasSupabaseEnv()) {
    const rows = demoRegistrosGeneralesRows();
    if (!categoriaId) return rows;
    return rows.filter((row) => row.categoria_id === categoriaId);
  }
  const supabase = getSupabaseServerClient();
  return safeQuery(async () => {
    let query = supabase
      .from("registros_generales")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .order("fecha", { ascending: false });
    if (categoriaId) {
      query = query.eq("categoria_id", categoriaId);
    }
    const { data } = await query.limit(100);
    return data ?? fallback.registrosGenerales;
  }, fallback.registrosGenerales);
}

export async function getComprasMaderaRows() {
  if (!hasSupabaseEnv()) {
    return demoComprasMaderaRows();
  }
  const supabase = getSupabaseServerClient();
  return safeQuery(async () => {
    const { data } = await supabase
      .from("compras_madera")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .order("fecha", { ascending: false })
      .limit(50);
    return data ?? fallback.comprasMadera;
  }, fallback.comprasMadera);
}

export async function getCotizacionesRows() {
  if (!hasSupabaseEnv()) {
    return demoCotizacionesRows();
  }
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("cotizaciones_mueble")
    .select("*")
    .eq("organization_id", DEFAULT_ORG_ID)
    .order("fecha", { ascending: false })
    .limit(50);
  return data ?? fallback.cotizaciones;
}

export async function getCortesRows(cotizacionId?: string) {
  if (!hasSupabaseEnv()) {
    return demoCortesRows(cotizacionId);
  }
  const supabase = getSupabaseServerClient();
  let query = supabase.from("cotizacion_cortes").select("*").order("created_at", { ascending: false });
  if (cotizacionId) {
    query = query.eq("cotizacion_id", cotizacionId);
  }
  const { data } = await query.limit(100);
  return data ?? fallback.cortes;
}

export async function getCotizacionesUnificadasRows(): Promise<CotizacionUnificadaRow[]> {
  if (!hasSupabaseEnv()) {
    return demoCotizacionesUnificadasRows() as CotizacionUnificadaRow[];
  }
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("cotizaciones_unificadas")
    .select("*")
    .eq("organization_id", DEFAULT_ORG_ID)
    .order("fecha", { ascending: false })
    .limit(100);
  return data ?? fallback.cotizacionesUnificadas;
}

export async function getCotizacionUnificadaById(id: string): Promise<CotizacionUnificadaRow | null> {
  if (!hasSupabaseEnv()) {
    const row = demoGetCotizacionUnificada(id);
    return row ? (row as CotizacionUnificadaRow) : null;
  }
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("cotizaciones_unificadas")
    .select("*")
    .eq("id", id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();
  return data ?? null;
}

export async function getAlquilerRows() {
  if (!hasSupabaseEnv()) {
    return demoAlquilerRows();
  }
  const supabase = getSupabaseServerClient();
  return safeQuery(async () => {
    const { data } = await supabase
      .from("alquileres")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .order("fecha_inicio", { ascending: false })
      .limit(100);
    return data ?? fallback.alquileres;
  }, fallback.alquileres);
}

export async function getPersonalRows() {
  if (!hasSupabaseEnv()) {
    return demoPersonalRows();
  }
  const supabase = getSupabaseServerClient();
  const [empleados, adelantos, sueldos] = await Promise.all([
    supabase
      .from("empleados")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .order("nombre"),
    supabase
      .from("adelantos")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .order("fecha", { ascending: false })
      .limit(30),
    supabase
      .from("sueldos")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .order("periodo", { ascending: false })
      .limit(30),
  ]);

  return {
    empleados: empleados.data ?? fallback.empleados,
    adelantos: adelantos.data ?? fallback.adelantos,
    sueldos: sueldos.data ?? fallback.sueldos,
  };
}

export async function getUtilidadRows() {
  if (!hasSupabaseEnv()) {
    return demoUtilidadRows();
  }
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("utilidad_mensual")
    .select("*")
    .eq("organization_id", DEFAULT_ORG_ID)
    .order("anio", { ascending: false })
    .order("mes", { ascending: false })
    .limit(24);
  return data ?? fallback.utilidad;
}

export async function getCierresRows() {
  if (!hasSupabaseEnv()) {
    return demoCierresRows();
  }
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("cierres_mensuales")
    .select("*")
    .eq("organization_id", DEFAULT_ORG_ID)
    .order("anio", { ascending: false })
    .order("mes", { ascending: false })
    .limit(24);
  return data ?? fallback.cierres;
}

export async function getSecurityControlRows(): Promise<SecurityControlItem[]> {
  if (!hasSupabaseEnv()) {
    return demoSecurityControlRows();
  }
  const supabase = getSupabaseServerClient();
  return safeQuery(async () => {
    const { data } = await supabase
      .from("security_control_items")
      .select("id,title,owner,completed,updated_at")
      .eq("organization_id", DEFAULT_ORG_ID)
      .order("sort_order", { ascending: true });
    return (data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      owner: r.owner,
      completed: r.completed,
      updated_at: r.updated_at,
    }));
  }, []);
}

export async function getInventarioProductosRows(includeInactive = false) {
  if (!hasSupabaseEnv()) {
    const rows = demoInventarioProductosRows();
    if (includeInactive) return rows;
    return rows.filter((row) => row.activo !== false);
  }

  const supabase = getSupabaseServerClient();
  let query = supabase
    .from("inventario_productos")
    .select("*")
    .eq("organization_id", DEFAULT_ORG_ID)
    .order("nombre");
  if (!includeInactive) {
    query = query.eq("activo", true);
  }
  const { data } = await query;

  return data ?? fallback.inventarioProductos;
}

export async function getInventarioMovimientosRows() {
  if (!hasSupabaseEnv()) {
    return demoInventarioMovimientosRows();
  }

  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("inventario_movimientos")
    .select("*")
    .eq("organization_id", DEFAULT_ORG_ID)
    .order("fecha", { ascending: false })
    .limit(100);

  return data ?? fallback.inventarioMovimientos;
}

export async function getInventarioResumen() {
  if (!hasSupabaseEnv()) {
    return demoInventarioResumen();
  }

  const [productos, movimientos] = await Promise.all([
    getInventarioProductosRows(),
    getInventarioMovimientosRows(),
  ]);

  const vendidos = new Map<string, number>();
  for (const m of movimientos) {
    if (m.tipo !== "salida_venta") continue;
    vendidos.set(m.producto_id, (vendidos.get(m.producto_id) ?? 0) + Number(m.cantidad));
  }

  const ranking = productos.map((p) => ({
    ...p,
    vendido: vendidos.get(p.id) ?? 0,
  }));

  const masVendidos = [...ranking].sort((a, b) => b.vendido - a.vendido).slice(0, 5);
  const menosVendidos = [...ranking].sort((a, b) => a.vendido - b.vendido).slice(0, 5);
  const stockBajo = ranking.filter((p) => Number(p.stock_actual) <= Number(p.stock_minimo));

  return { productos, movimientos, masVendidos, menosVendidos, stockBajo };
}

export async function getInventarioRobustoData() {
  const [productosAll, movimientos] = await Promise.all([
    getInventarioProductosRows(true),
    getInventarioMovimientosRows(),
  ]);
  const productos = productosAll.filter((p) => p.activo !== false);

  const vendidos = new Map<string, number>();
  const ajustes = new Map<string, number>();
  const ultimosMovimientosPorProducto = new Map<string, string>();
  const costoPromedio = new Map<string, { totalCantidad: number; totalCosto: number }>();

  for (const m of movimientos) {
    if (!ultimosMovimientosPorProducto.has(m.producto_id)) {
      ultimosMovimientosPorProducto.set(m.producto_id, m.fecha);
    }
    if (m.tipo === "salida_venta") {
      vendidos.set(m.producto_id, (vendidos.get(m.producto_id) ?? 0) + Number(m.cantidad));
    }
    if (m.tipo === "ajuste") {
      ajustes.set(m.producto_id, (ajustes.get(m.producto_id) ?? 0) + 1);
    }
    if (m.tipo === "entrada_compra" && m.costo_unitario && Number(m.costo_unitario) > 0) {
      const curr = costoPromedio.get(m.producto_id) ?? { totalCantidad: 0, totalCosto: 0 };
      curr.totalCantidad += Number(m.cantidad);
      curr.totalCosto += Number(m.cantidad) * Number(m.costo_unitario);
      costoPromedio.set(m.producto_id, curr);
    }
  }

  const hoyMs = Date.now();
  const enriched = productosAll.map((p) => {
    const costo = costoPromedio.get(p.id);
    const costoUnitarioPromedio =
      costo && costo.totalCantidad > 0 ? Number((costo.totalCosto / costo.totalCantidad).toFixed(4)) : 0;
    const valorStock = Number((Number(p.stock_actual) * costoUnitarioPromedio).toFixed(2));
    const ultimoMov = ultimosMovimientosPorProducto.get(p.id) ?? null;
    const diasSinMovimiento = ultimoMov
      ? Math.floor((hoyMs - new Date(ultimoMov).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    return {
      ...p,
      vendido: vendidos.get(p.id) ?? 0,
      ajustes: ajustes.get(p.id) ?? 0,
      costo_unitario_promedio: costoUnitarioPromedio,
      valor_stock: valorStock,
      dias_sin_movimiento: diasSinMovimiento,
      ultimo_movimiento: ultimoMov,
    };
  });

  const stockBajo = enriched.filter((p) => p.activo !== false && Number(p.stock_actual) <= Number(p.stock_minimo));
  const sinMovimiento = enriched.filter((p) => p.activo !== false && (p.dias_sin_movimiento ?? 9999) >= 30);
  const totalStock = enriched
    .filter((p) => p.activo !== false)
    .reduce((acc, p) => acc + Number(p.stock_actual), 0);
  const valorInventario = enriched
    .filter((p) => p.activo !== false)
    .reduce((acc, p) => acc + Number(p.valor_stock), 0);
  const rotacionPromedio =
    productos.length > 0
      ? Number(
          (
            enriched
              .filter((p) => p.activo !== false)
              .reduce((acc, p) => acc + Number(p.vendido), 0) / productos.length
          ).toFixed(2),
        )
      : 0;

  const categorias = Array.from(new Set(enriched.map((p) => p.categoria))).sort((a, b) => a.localeCompare(b));
  const rankingMasVendidos = [...enriched]
    .filter((p) => p.activo !== false)
    .sort((a, b) => Number(b.vendido) - Number(a.vendido))
    .slice(0, 10);
  const rankingMenosVendidos = [...enriched]
    .filter((p) => p.activo !== false)
    .sort((a, b) => Number(a.vendido) - Number(b.vendido))
    .slice(0, 10);
  const topAjustes = [...enriched]
    .filter((p) => p.activo !== false)
    .sort((a, b) => Number(b.ajustes) - Number(a.ajustes))
    .slice(0, 10);

  const kardex = movimientos.map((m) => {
    const p = productosAll.find((x) => x.id === m.producto_id);
    return {
      ...m,
      producto_codigo: p?.codigo ?? "N/A",
      producto_nombre: p?.nombre ?? "Producto eliminado",
      categoria: p?.categoria ?? "N/A",
      impacto: m.tipo === "entrada_compra" ? Number(m.cantidad) : m.tipo === "salida_venta" ? -Number(m.cantidad) : Number(m.cantidad),
    };
  });

  const reposicionSugerida = stockBajo.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    categoria: p.categoria,
    stock_actual: Number(p.stock_actual),
    stock_minimo: Number(p.stock_minimo),
    sugerido_reponer: Math.max(Number(p.stock_minimo) * 2 - Number(p.stock_actual), 0),
  }));

  return {
    productos: enriched,
    movimientos,
    categorias,
    stockBajo,
    sinMovimiento,
    reposicionSugerida,
    rankingMasVendidos,
    rankingMenosVendidos,
    topAjustes,
    kardex,
    indicadores: {
      totalProductosActivos: productos.length,
      totalProductosInactivos: productosAll.filter((p) => p.activo === false).length,
      totalMovimientos: movimientos.length,
      totalStock: Number(totalStock.toFixed(2)),
      valorInventario: Number(valorInventario.toFixed(2)),
      rotacionPromedio,
      productosConStockBajo: stockBajo.length,
      productosSinMovimiento30d: sinMovimiento.length,
    },
  };
}

export async function getChoferesRows() {
  if (!hasSupabaseEnv()) {
    return demoChoferesRows();
  }
  const supabase = getSupabaseServerClient();
  return safeQuery(async () => {
    const { data } = await supabase
      .from("choferes")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .eq("activo", true)
      .order("nombre", { ascending: true })
      .limit(200);
    return data ?? fallback.choferes;
  }, fallback.choferes);
}

export async function getMueblesCatalogoRows() {
  if (!hasSupabaseEnv()) {
    return demoMueblesCatalogoRows();
  }
  const supabase = getSupabaseServerClient();
  return safeQuery(async () => {
    const { data } = await supabase
      .from("muebles_catalogo")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .eq("activo", true)
      .order("nombre", { ascending: true })
      .limit(500);
    return data ?? fallback.mueblesCatalogo;
  }, fallback.mueblesCatalogo);
}

export async function getVentasMuebleTerminadoRows() {
  if (!hasSupabaseEnv()) {
    return demoVentasMuebleTerminadoRows();
  }
  const supabase = getSupabaseServerClient();
  return safeQuery(async () => {
    const { data } = await supabase
      .from("ventas_mueble_terminado")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? fallback.ventasMuebleTerminado;
  }, fallback.ventasMuebleTerminado);
}

export async function getOrdenesProduccionRows() {
  if (!hasSupabaseEnv()) {
    return demoOrdenesProduccionRows();
  }
  const supabase = getSupabaseServerClient();
  return safeQuery(async () => {
    const { data } = await supabase
      .from("ordenes_produccion")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? fallback.ordenesProduccion;
  }, fallback.ordenesProduccion);
}

export async function getServiciosAserraderoRows() {
  if (!hasSupabaseEnv()) {
    return demoServiciosAserraderoRows();
  }
  const supabase = getSupabaseServerClient();
  return safeQuery(async () => {
    const { data } = await supabase
      .from("servicios_aserradero")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? fallback.serviciosAserradero;
  }, fallback.serviciosAserradero);
}

export async function getServiciosEspecialesTarifaRows(): Promise<ServicioEspecialTarifaRow[]> {
  if (!hasSupabaseEnv()) {
    return demoServiciosEspecialesTarifaRows();
  }
  const supabase = getSupabaseServerClient();
  return safeQuery(async () => {
    const { data } = await supabase
      .from("servicios_especiales_tarifa")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .eq("activo", true)
      .order("nombre", { ascending: true });
    return (data ?? []) as ServicioEspecialTarifaRow[];
  }, []);
}

export async function getZonasEntregaRows() {
  if (!hasSupabaseEnv()) {
    return demoZonasEntregaRows();
  }
  const supabase = getSupabaseServerClient();
  return safeQuery(async () => {
    const { data } = await supabase
      .from("zonas_entrega")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .eq("activo", true)
      .order("distancia_km", { ascending: true })
      .limit(100);
    return data ?? fallback.zonasEntrega;
  }, fallback.zonasEntrega);
}

export type CobroVencido = {
  id: string;
  origen: "venta_mueble_terminado" | "contrato_alquiler";
  fecha_emision: string;
  fecha_vencimiento: string;
  cliente_id: string;
  monto: number;
  referencia: string;
};

/**
 * Devuelve las ventas/contratos a crédito cuya fecha límite ya pasó. Permite
 * mostrar alertas de cobranza tanto en el hub de ventas como en /reportes.
 */
export async function getCobrosVencidos(hoy: string = new Date().toISOString().slice(0, 10)) {
  const [ventas, contratos] = await Promise.all([
    getVentasMuebleTerminadoRows(),
    getAlquilerRows(),
  ]);

  const cobros: CobroVencido[] = [];

  for (const v of ventas) {
    if (
      v.modalidad_pago === "credito" &&
      v.fecha_pago_credito &&
      v.fecha_pago_credito < hoy &&
      v.estado_entrega !== "entregado"
    ) {
      cobros.push({
        id: v.id,
        origen: "venta_mueble_terminado",
        fecha_emision: v.fecha,
        fecha_vencimiento: v.fecha_pago_credito,
        cliente_id: v.cliente_id,
        monto: Number(v.total),
        referencia: v.correlativo ?? v.id.slice(0, 8),
      });
    }
  }

  for (const c of contratos) {
    if (
      c.modalidad_pago === "credito" &&
      c.fecha_pago_credito &&
      c.fecha_pago_credito < hoy &&
      c.estado === "abierto"
    ) {
      cobros.push({
        id: c.id,
        origen: "contrato_alquiler",
        fecha_emision: c.fecha_inicio,
        fecha_vencimiento: c.fecha_pago_credito,
        cliente_id: c.cliente_id,
        monto: Number(c.monto_total ?? c.tarifa),
        referencia: c.codigo ?? c.id.slice(0, 8),
      });
    }
  }

  return cobros.sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
}
