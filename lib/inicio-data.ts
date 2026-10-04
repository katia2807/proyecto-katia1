import { DEFAULT_ORG_ID } from "@/lib/constants";
import { demoInicioData } from "@/lib/demo-store";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Tables = Database["public"]["Tables"];
export type InicioSection<T> = { data: T; available: true } | { data: null; available: false };

export type InicioValues = {
  inventario: { total: number; stockBajo: number };
  ventasBorrador: number;
  penalidadesActivas: number;
  alertasCriticas: number;
  adelantosPendientes: number;
  empleadosActivos: number;
  mes: { ingresos: number; egresos: number };
  caja: Tables["movimientos_caja"]["Row"][];
  ventas: Tables["ventas_madera"]["Row"][];
  clientes: number;
  cotizaciones: number;
};

export type InicioData = { [K in keyof InicioValues]: InicioSection<InicioValues[K]> };

export const INICIO_SECTION_LABELS: Record<keyof InicioValues, string> = {
  inventario: "Stock por reponer",
  ventasBorrador: "Ventas sin confirmar",
  penalidadesActivas: "Penalidades activas",
  alertasCriticas: "Alertas críticas",
  adelantosPendientes: "Adelantos pendientes",
  empleadosActivos: "Empleados activos",
  mes: "Ingresos y egresos del mes",
  caja: "Caja reciente",
  ventas: "Ventas recientes",
  clientes: "Clientes",
  cotizaciones: "Cotizaciones",
};

async function loadSection<T>(label: string, load: (signal: AbortSignal) => Promise<T>): Promise<InicioSection<T>> {
  try {
    return { data: await load(AbortSignal.timeout(10_000)), available: true };
  } catch (error) {
    console.error(`[Inicio: ${label}]`, error);
    return { data: null, available: false };
  }
}

/** Totales independientes del historial reciente; un error nunca se convierte en cero. */
export async function getInicioData(): Promise<InicioData> {
  if (!hasSupabaseEnv()) {
    const values = demoInicioData();
    return Object.fromEntries(
      Object.entries(values).map(([key, data]) => [key, { data, available: true }]),
    ) as InicioData;
  }

  // Se crea dentro de cada carga para que incluso un error de configuración sea recuperable.
  const query = (table: string) => getSupabaseServerClient().from(table);
  const count = async (request: PromiseLike<{ count: number | null; error: unknown }>) => {
    const result = await request;
    if (result.error) throw result.error;
    if (result.count === null) throw new Error("No se recibió el total de registros.");
    return result.count;
  };
  const rows = async <T>(request: PromiseLike<{ data: T[] | null; error: unknown }>) => {
    const result = await request;
    if (result.error) throw result.error;
    if (result.data === null) throw new Error("No se recibieron los registros.");
    return result.data;
  };
  const orgCount = (table: string, signal: AbortSignal) => query(table)
    .select("id", { count: "exact", head: true }).eq("organization_id", DEFAULT_ORG_ID).abortSignal(signal);

  const monthParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima", year: "numeric", month: "numeric",
  }).formatToParts(new Date());
  const year = Number(monthParts.find((part) => part.type === "year")?.value);
  const month = Number(monthParts.find((part) => part.type === "month")?.value);

  const loaders: { [K in keyof InicioValues]: (signal: AbortSignal) => Promise<InicioValues[K]> } = {
    inventario: async (signal) => {
      // PostgREST no compara dos columnas con .lte(). Se recorren páginas pequeñas
      // para comparar stock y mínimo sin truncar el catálogo al límite del servidor.
      let total = 0;
      let stockBajo = 0;
      let expectedTotal: number | null = null;
      do {
        const result = await query("inventario_productos")
          .select("id,stock_actual,stock_minimo", { count: "exact" })
          .eq("organization_id", DEFAULT_ORG_ID).eq("activo", true).is("deleted_at", null)
          .order("id").range(total, total + 499).abortSignal(signal);
        if (result.error) throw result.error;
        if (result.data === null || result.count === null) throw new Error("Inventario no disponible.");
        if (expectedTotal !== null && expectedTotal !== result.count) {
          throw new Error("El inventario cambió durante la consulta. Vuelve a intentarlo.");
        }
        expectedTotal = result.count;
        if (result.data.length === 0 && total < expectedTotal) throw new Error("Inventario incompleto.");
        for (const product of result.data) {
          if (Number(product.stock_actual) <= Number(product.stock_minimo)) stockBajo += 1;
        }
        total += result.data.length;
      } while (total < expectedTotal);
      return { total, stockBajo };
    },
    ventasBorrador: (signal) => count(orgCount("ventas_madera", signal).eq("estado", "borrador").is("deleted_at", null)),
    penalidadesActivas: (signal) => count(orgCount("alquileres", signal).gt("penalidad", 0).neq("estado", "cerrado").is("deleted_at", null)),
    alertasCriticas: (signal) => count(orgCount("alertas_operativas", signal).eq("prioridad", "alta").neq("estado", "resuelta")),
    adelantosPendientes: (signal) => count(orgCount("adelantos", signal).eq("estado", "pendiente")),
    empleadosActivos: (signal) => count(orgCount("empleados", signal).eq("activo", true)),
    clientes: (signal) => count(orgCount("clientes", signal).is("deleted_at", null)),
    cotizaciones: (signal) => count(orgCount("cotizaciones_unificadas", signal).is("deleted_at", null)),
    mes: async (signal) => {
      const { data, error } = await query("utilidad_mensual").select("ingresos,egresos")
        .eq("organization_id", DEFAULT_ORG_ID).eq("anio", year).eq("mes", month).abortSignal(signal).maybeSingle();
      if (error) throw error;
      // Una consulta correcta sin movimientos este mes sí equivale a cero.
      return { ingresos: Number(data?.ingresos ?? 0), egresos: Number(data?.egresos ?? 0) };
    },
    caja: (signal) => rows<Tables["movimientos_caja"]["Row"]>(query("movimientos_caja").select("*")
      .eq("organization_id", DEFAULT_ORG_ID).is("voided_at", null).is("deleted_at", null)
      .order("fecha", { ascending: false }).order("id").limit(4).abortSignal(signal)),
    ventas: (signal) => rows<Tables["ventas_madera"]["Row"]>(query("ventas_madera").select("*")
      .eq("organization_id", DEFAULT_ORG_ID).is("deleted_at", null)
      .order("fecha", { ascending: false }).order("id").limit(4).abortSignal(signal)),
  };

  const entries = await Promise.all(
    (Object.keys(loaders) as (keyof InicioValues)[]).map(async (key) => [
      key,
      await loadSection<InicioValues[keyof InicioValues]>(INICIO_SECTION_LABELS[key], loaders[key]),
    ] as const),
  );
  return Object.fromEntries(entries) as InicioData;
}
