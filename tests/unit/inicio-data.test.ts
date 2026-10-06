import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  hasSupabaseEnv: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  demoInicioData: vi.fn(),
}));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/demo-store", () => ({ demoInicioData: mocks.demoInicioData }));
vi.mock("@/lib/company-config", () => ({ getEmpresaConfig: async () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { DEFAULT_ORG_ID } from "@/lib/constants";
import { getInicioData } from "@/lib/inicio-data";
import { getInventarioProductosRows } from "@/lib/data";
import { getVentasBorradorRows, getAlquileresConPenalidadRows, getAdelantosPendientesRows, getAlertasCriticasRows } from "@/lib/inicio-pendientes";
import DashboardPage from "@/app/(dashboard)/page";

type Fixture = Record<string, unknown>;
let tables: Record<string, Fixture[]>;
let failures: Set<string>;
let missingCount: Set<string>;
let requests: URL[];

function fixture(id: string, values: Fixture = {}): Fixture {
  return { id, organization_id: DEFAULT_ORG_ID, deleted_at: null, ...values };
}

// Usa el SDK real con respuestas PostgREST locales: comprueba filtros, HEAD,
// errores y paginación sin conectar con los datos del negocio.
const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  requests.push(url);
  const table = url.pathname.split("/").at(-1)!;
  if (failures.has(table)) {
    return new Response(JSON.stringify({ message: "Datos no disponibles", code: "TEST_FAILURE" }), { status: 400 });
  }
  let selected = [...(tables[table] ?? [])];
  for (const [key, value] of url.searchParams) {
    if (["select", "order", "offset", "limit"].includes(key)) continue;
    const [operator, expected] = value.split(".");
    selected = selected.filter((row) => {
      if (operator === "eq") return String(row[key]) === expected;
      if (operator === "neq") return String(row[key]) !== expected;
      if (operator === "gt") return Number(row[key]) > Number(expected);
      if (operator === "is" && expected === "null") return row[key] == null;
      throw new Error(`Filtro no soportado en el fixture: ${value}`);
    });
  }
  const total = selected.length;
  const order = url.searchParams.get("order")?.split(",") ?? [];
  selected.sort((a, b) => {
    for (const item of order) {
      const [key, direction] = item.split(".");
      const comparison = String(a[key]).localeCompare(String(b[key]));
      if (comparison) return direction === "desc" ? -comparison : comparison;
    }
    return 0;
  });
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 1000);
  const page = selected.slice(offset, offset + limit);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (!missingCount.has(table)) headers["content-range"] = `${offset}-${offset + page.length - 1}/${total}`;
  return new Response(init?.method === "HEAD" ? null : JSON.stringify(page), { headers });
};

describe("Inicio: totales y estados de carga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    tables = {};
    failures = new Set();
    missingCount = new Set();
    requests = [];
    mocks.hasSupabaseEnv.mockReturnValue(true);
    mocks.getSupabaseServerClient.mockImplementation(() => createClient("https://inicio.test", "test-key", {
      global: { fetch: fixtureFetch }, auth: { persistSession: false, autoRefreshToken: false },
    }));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  test("cuenta borradores antiguos aunque las últimas ventas estén confirmadas", async () => {
    tables.ventas_madera = Array.from({ length: 12 }, (_, index) => fixture(`venta-${index}`, {
      fecha: `2026-10-${String(index + 1).padStart(2, "0")}`, estado: "confirmada", total: 100,
    }));
    tables.ventas_madera.push(
      fixture("pendiente-antigua", { fecha: "2025-01-01", estado: "borrador" }),
      fixture("borrador-eliminado", { fecha: "2025-01-02", estado: "borrador", deleted_at: "2026-01-01" }),
      fixture("otra-empresa", { estado: "borrador", organization_id: "otra" }),
    );
    const inicio = await getInicioData();
    expect(inicio.ventasBorrador).toEqual({ data: 1, available: true });
    expect(inicio.ventas.data).toHaveLength(4);
    expect(inicio.ventas.data?.every((row) => row.estado === "confirmada")).toBe(true);
    expect((await getVentasBorradorRows()).map((row) => row.id)).toEqual(["pendiente-antigua"]);
  });

  test("muestra madera cortada aunque no existan ventas en la tabla anterior y abre su detalle", async () => {
    tables.ventas_madera_cortada = [fixture("cortada-reciente", { fecha: "2026-10-05", total: 8355.83 })];
    const inicio = await getInicioData();
    expect(inicio.ventas).toEqual({ available: true, data: [{
      id: "cortada-reciente", fecha: "2026-10-05", total: 8355.83, estado: "registrada", tipo: "madera",
    }] });
    const html = renderToStaticMarkup(await DashboardPage({}));
    expect(html).not.toContain("Sin ventas aún");
    expect(html).toContain('href="/ventas/detalle/madera/cortada-reciente"');
    expect(html).toContain("8,355.83");
  });

  test("combina los dos orígenes por fecha y muestra sólo cuatro ventas vigentes de la empresa", async () => {
    tables.ventas_madera = [
      fixture("legado-reciente", { fecha: "2026-10-07", total: 100, estado: "confirmada" }),
      fixture("legado-antiguo", { fecha: "2026-09-01", total: 90, estado: "borrador" }),
    ];
    tables.ventas_madera_cortada = Array.from({ length: 6 }, (_, index) => fixture(`cortada-${index + 1}`, {
      fecha: `2026-10-0${index + 1}`, total: 200,
    }));
    tables.ventas_madera_cortada.push(
      fixture("cortada-eliminada", { fecha: "2026-10-31", total: 500, deleted_at: "2026-10-01" }),
      fixture("cortada-otra-empresa", { fecha: "2026-10-30", total: 500, organization_id: "otra" }),
    );
    const inicio = await getInicioData();
    expect(inicio.ventas.data?.map(row => row.id)).toEqual(["legado-reciente", "cortada-6", "cortada-5", "cortada-4"]);
    const html = renderToStaticMarkup(await DashboardPage({}));
    expect(html).toContain('href="/ventas/detalle/venta-madera/legado-reciente"');
    expect(html).toContain('href="/ventas/detalle/madera/cortada-6"');
  });

  test("un fallo de madera cortada avisa de carga incompleta en vez de mostrar un resumen parcial", async () => {
    tables.ventas_madera = [fixture("legado-visible", { fecha: "2026-10-05", total: 100, estado: "confirmada" })];
    failures.add("ventas_madera_cortada");
    const inicio = await getInicioData();
    expect(inicio.ventas).toEqual({ data: null, available: false });
    expect(inicio.ventasBorrador).toEqual({ data: 0, available: true });
    const html = renderToStaticMarkup(await DashboardPage({}));
    expect(html).toContain("Verificación incompleta");
    expect(html).toContain("No se pudieron cargar las ventas recientes.");
    expect(html).not.toContain("Sin ventas aún");
    expect(html).not.toContain('href="/ventas/detalle/venta-madera/legado-visible"');
  });

  test("incluye penalidades y adelantos antiguos; excluye alertas resueltas", async () => {
    tables.alquileres = Array.from({ length: 12 }, (_, index) => fixture(`cerrado-${index}`, { estado: "cerrado", penalidad: 50 }));
    tables.alquileres.push(fixture("abierto-antiguo", { estado: "abierto", penalidad: 100 }));
    tables.adelantos = Array.from({ length: 35 }, (_, index) => fixture(`adelanto-${index}`, { estado: "descontado_nomina" }));
    tables.adelantos.push(fixture("pendiente-antiguo", { estado: "pendiente" }));
    tables.alertas_operativas = [
      fixture("resuelta", { prioridad: "alta", estado: "resuelta" }),
      fixture("activa", { prioridad: "alta", estado: "revisada" }),
    ];
    const inicio = await getInicioData();
    expect(inicio.penalidadesActivas.data).toBe(1);
    expect(inicio.adelantosPendientes.data).toBe(1);
    expect(inicio.alertasCriticas.data).toBe(1);
    expect((await getAlquileresConPenalidadRows()).map((row) => row.id)).toEqual(["abierto-antiguo"]);
    expect((await getAdelantosPendientesRows()).map((row) => row.id)).toEqual(["pendiente-antiguo"]);
    expect((await getAlertasCriticasRows()).map((row) => row.id)).toEqual(["activa"]);
  });

  test("revisa el stock más allá del límite de 1000 productos", async () => {
    tables.inventario_productos = Array.from({ length: 1005 }, (_, index) => fixture(String(index).padStart(4, "0"), {
      activo: true, stock_actual: index === 1004 ? 0 : 10, stock_minimo: 1,
    }));
    tables.inventario_productos.push(fixture("inactivo", { activo: false, stock_actual: 0, stock_minimo: 1 }));
    tables.inventario_productos.push(fixture("eliminado", { activo: true, stock_actual: 0, stock_minimo: 1, deleted_at: "2026-10-01" }));
    const inicio = await getInicioData();
    expect(inicio.inventario).toEqual({ data: { total: 1005, stockBajo: 1 }, available: true });
    expect(requests.filter((url) => url.pathname.endsWith("inventario_productos"))).toHaveLength(3);
    const productos = await getInventarioProductosRows();
    expect(productos).toHaveLength(1005);
    expect(productos.filter((row) => row.stock_actual <= row.stock_minimo).map((row) => row.id)).toEqual(["1004"]);
    const catalogoCompleto = await getInventarioProductosRows(true);
    expect(catalogoCompleto).toHaveLength(1006);
    expect(catalogoCompleto.some((row) => row.id === "eliminado")).toBe(false);
  });

  test("un fallo parcial conserva el resto y permite recuperar datos al reintentar", async () => {
    failures.add("utilidad_mensual");
    failures.add("ventas_madera");
    let inicio = await getInicioData();
    expect(inicio.mes).toEqual({ data: null, available: false });
    expect(inicio.ventasBorrador).toEqual({ data: null, available: false });
    expect(inicio.caja).toEqual({ data: [], available: true });
    expect(inicio.adelantosPendientes).toEqual({ data: 0, available: true });
    const html = renderToStaticMarkup(await DashboardPage({}));
    expect(html).toContain("Verificación incompleta");
    expect(html).toContain("Reintentar");
    expect(html).toContain("No disponible");
    expect(html).not.toContain("Todo bajo control");
    expect(html).not.toContain("Sin pendientes");
    expect(html).not.toContain("Sin ventas aún");
    failures.clear();
    inicio = await getInicioData();
    expect(inicio.mes).toEqual({ data: { ingresos: 0, egresos: 0 }, available: true });
  });

  test("un total ausente se marca como no disponible; cero verificado muestra Sin pendientes", async () => {
    missingCount.add("adelantos");
    expect((await getInicioData()).adelantosPendientes).toEqual({ data: null, available: false });
    missingCount.clear();
    const html = renderToStaticMarkup(await DashboardPage({}));
    expect(html).toContain("Todo bajo control");
    expect(html).toContain("Sin pendientes");
    expect(html).not.toContain("Verificación incompleta");
  });

  test("un fallo de configuración produce estados recuperables", async () => {
    mocks.getSupabaseServerClient.mockImplementation(() => { throw new Error("Sin configuración"); });
    const inicio = await getInicioData();
    expect(Object.values(inicio).every((section) => !section.available && section.data === null)).toBe(true);
  });

  test("el listado filtrado incluye más de una página de borradores", async () => {
    tables.ventas_madera = Array.from({ length: 505 }, (_, index) => fixture(`borrador-${index}`, {
      estado: "borrador", fecha: "2026-10-01",
    }));
    tables.ventas_madera.push(fixture("confirmada", { estado: "confirmada", fecha: "2026-10-02" }));
    const pendientes = await getVentasBorradorRows();
    expect(pendientes).toHaveLength(505);
    expect(new Set(pendientes.map((row) => row.id)).size).toBe(505);
    expect(pendientes.every((row) => row.estado === "borrador")).toBe(true);
  });

  test("el filtro no muestra un listado vacío como resultado de un error", async () => {
    failures.add("adelantos");
    await expect(getAdelantosPendientesRows()).rejects.toBeDefined();
  });

  test("los importes y el mes visible usan la misma fecha de Perú", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T02:00:00Z"));
    const html = renderToStaticMarkup(await DashboardPage({}));
    expect(html).toMatch(/sep?tiembre de 2026/);
    const monthQuery = requests.find((url) => url.pathname.endsWith("utilidad_mensual"))!;
    expect(monthQuery.searchParams.get("mes")).toBe("eq.9");
  });
});
