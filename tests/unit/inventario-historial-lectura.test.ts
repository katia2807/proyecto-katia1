import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({ hasSupabaseEnv: vi.fn(), getSupabaseServerClient: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/store-persistence", () => ({ readStoreFromDisk: () => null, writeStoreToDisk: mocks.write }));
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { getInventarioRobustoData } from "@/lib/data";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let totalMovimientos: number;
let countFails: boolean;
let requests: Array<{ table: string; method: string }>;

// SDK real, respuestas en memoria: no se contacta Supabase ni se modifica un archivo de datos.
const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  const table = url.pathname.split("/").at(-1)!;
  const method = init?.method ?? "GET";
  requests.push({ table, method });
  if (table === "inventario_movimientos" && method === "HEAD" && countFails) {
    return new Response(null, { status: 400 });
  }
  let rows = [...(tables[table] ?? [])];
  for (const [key, value] of url.searchParams) {
    if (value.startsWith("eq.")) rows = rows.filter(r => String(r[key]) === value.slice(3));
    if (value === "is.null") rows = rows.filter(r => r[key] == null);
  }
  const total = table === "inventario_movimientos" ? totalMovimientos : rows.length;
  rows.sort((a, b) => table === "inventario_movimientos"
    ? String(b.fecha).localeCompare(String(a.fecha)) : String(a.nombre).localeCompare(String(b.nombre)));
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? rows.length);
  rows = rows.slice(offset, offset + limit);
  return new Response(method === "HEAD" ? null : JSON.stringify(rows), {
    headers: { "content-type": "application/json", "content-range": `${offset}-${offset + rows.length - 1}/${total}` },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T15:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  requests = [];
  countFails = false;
  tables = {
    inventario_productos: ["30", "29", "nuevo", "baja"].map(id => ({ id, organization_id: DEFAULT_ORG_ID,
      nombre: id, codigo: id, categoria: "Prueba", unidad: "unidad", activo: id !== "baja",
      stock_actual: 2, stock_minimo: 1, costo_unitario: null, foto_url: null, created_at: "2026-10-05T12:00:00Z" })),
    inventario_movimientos: [
      { id: "m30", organization_id: DEFAULT_ORG_ID, producto_id: "30", fecha: "2026-09-06", tipo: "salida_venta", cantidad: 1, costo_unitario: null },
      { id: "m29", organization_id: DEFAULT_ORG_ID, producto_id: "29", fecha: "2026-09-07", tipo: "salida_venta", cantidad: 1, costo_unitario: null },
    ],
  };
  totalMovimientos = tables.inventario_movimientos.length;
  mocks.hasSupabaseEnv.mockReturnValue(true);
  mocks.getSupabaseServerClient.mockReturnValue(createClient("https://inventario.test", "test-key", {
    global: { fetch: fixtureFetch }, auth: { persistSession: false, autoRefreshToken: false },
  }));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Inventario: alcance de lectura y clasificación de alertas", () => {
  test.each(["2026-10-01T07:00:00Z", "2026-11-01T02:00:00Z"])(
    "los movimientos del mes usan el calendario de Perú (%s)", async (ahora) => {
      vi.setSystemTime(new Date(ahora));
      tables.inventario_movimientos = ["2026-09-30", "2026-10-01", "2026-10-31"].map((fecha, i) => ({
        id: `mes${i}`, organization_id: DEFAULT_ORG_ID, producto_id: "30", fecha,
        tipo: "salida_venta", cantidad: 1, costo_unitario: null,
      }));
      totalMovimientos = 3;
      const result = await getInventarioRobustoData();
      expect(result.indicadores.movimientosDelMes).toBe(2);
    },
  );

  test("la consulta completa distingue 30 días, 29 días y un producto recién creado sin historial", async () => {
    const before = structuredClone(tables);
    const result = await getInventarioRobustoData();
    expect(result.historialMovimientos).toEqual({ cargados: 2, total: 2 });
    expect(result.loadWarning).toBeNull();
    expect(result.sinMovimiento.map(p => p.id)).toEqual(["30"]);
    expect(result.sinMovimientosRegistrados.map(p => p.id)).toEqual(["nuevo"]);
    expect(result.indicadores.productosSinMovimiento30d).toBe(1);
    expect(tables).toEqual(before);
    expect(requests.every(r => r.method === "GET" || r.method === "HEAD")).toBe(true);
    expect(mocks.write).not.toHaveBeenCalled();
  });

  test("una respuesta recortada mantiene el total real y advierte sobre indicadores parciales", async () => {
    totalMovimientos = 5200;
    const result = await getInventarioRobustoData();
    expect(result.historialMovimientos).toEqual({ cargados: 2, total: 5200 });
    expect(result.indicadores.totalMovimientos).toBe(5200);
    expect(result.loadWarning).toContain("Historial parcial: se cargaron 2 de 5200");
    expect(result.loadWarning).toContain("indicadores y las exportaciones");
    expect(result.kardex).toHaveLength(2);
  });

  test("un fallo del conteo no se presenta como historial completo ni inventa registros", async () => {
    countFails = true;
    const result = await getInventarioRobustoData();
    expect(result.historialMovimientos).toEqual({ cargados: 2, total: null });
    expect(result.loadWarning).toContain("No se pudo comprobar si el historial está completo");
    expect(result.kardex).toHaveLength(2);
    expect(requests.every(r => r.method === "GET" || r.method === "HEAD")).toBe(true);
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
