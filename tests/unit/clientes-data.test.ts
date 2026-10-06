import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ hasSupabaseEnv: vi.fn(), getSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/store-persistence", () => ({ readStoreFromDisk: () => null, writeStoreToDisk: vi.fn() }));
import { getClienteHistorial, resumenClientes } from "@/lib/clientes-data";
import { getClientesRows } from "@/lib/data";

type Registro = { id: string; organization_id: string } & Record<string, unknown>;
const org = "00000000-0000-0000-0000-000000000001";
let tablas: Record<string, Registro[]>;
let fallo: string | null;
let requests: { url: URL; method: string }[];
const row = (id: string, extra: Record<string, unknown> = {}): Registro => ({ id, organization_id: org, cliente_id: "cliente", fecha: "2026-10-06", total: 100, ...extra });
const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input)); requests.push({ url, method: init?.method ?? "GET" });
  const tabla = url.pathname.split("/").at(-1)!;
  if (tabla === fallo) return new Response(JSON.stringify({ message: "Fallo de prueba" }), { status: 400 });
  let rows = [...(tablas[tabla] ?? [])];
  for (const [campo, filtro] of url.searchParams) {
    if (filtro.startsWith("eq.")) rows = rows.filter(r => String(r[campo]) === filtro.slice(3));
    if (filtro === "is.null") rows = rows.filter(r => r[campo] == null);
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 1000);
  return new Response(JSON.stringify(rows.slice(offset, offset + Math.min(limit, 1000))), { headers: { "content-type": "application/json" } });
};

describe("Historial completo de Clientes sin escrituras", () => {
  beforeEach(() => {
    vi.clearAllMocks(); tablas = {}; fallo = null; requests = [];
    mocks.hasSupabaseEnv.mockReturnValue(true);
    mocks.getSupabaseServerClient.mockReturnValue(createClient("https://clientes.test", "test-key", { global: { fetch: fixtureFetch }, auth: { persistSession: false, autoRefreshToken: false } }));
  });
  test("consulta por cliente antes del límite y recupera sus ventas antiguas", async () => {
    tablas.ventas_madera = Array.from({ length: 1200 }, (_, i) => row(`venta-${i}`, { cliente_id: "otro", estado: "confirmada" }));
    tablas.ventas_madera.push(row("antigua", { fecha: "2020-01-01", estado: "confirmada" }));
    const historial = await getClienteHistorial("cliente");
    expect(historial.ventasMadera).toHaveLength(1);
    expect(historial.ventasMadera[0].id).toBe("antigua");
    expect(requests.every(r => r.url.searchParams.get("cliente_id") === "eq.cliente")).toBe(true);
    expect(requests.every(r => r.method === "GET")).toBe(true);
  });
  test("el listado suma todas las páginas y no solo las 50 ventas recientes", async () => {
    tablas.ventas_madera = Array.from({ length: 1105 }, (_, i) => row(`venta-${String(i).padStart(5, "0")}`, { estado: "confirmada" }));
    const historial = await getClienteHistorial();
    expect(historial.ventasMadera).toHaveLength(1105);
    expect(resumenClientes(historial).get("cliente")?.total).toBe(110500);
  });
  test("incluye las cotizaciones actuales y anteriores sin repetir el mismo ID", async () => {
    tablas.cotizaciones_mueble = [row("compartida", { precio_acordado: 300 }), row("anterior", { precio_acordado: 40 })];
    tablas.cotizaciones_unificadas = [row("compartida", { estado_flujo: "cobrada", total: 312 })];
    const historial = await getClienteHistorial("cliente");
    expect(historial.cotizaciones).toHaveLength(2);
    expect(resumenClientes(historial).get("cliente")).toMatchObject({ operaciones: 2, total: 312 });
  });
  test("no suma una propuesta pendiente, un borrador ni la tarifa de un alquiler abierto", async () => {
    tablas.cotizaciones_unificadas = [row("propuesta", { estado_flujo: "pendiente" })];
    tablas.ventas_madera = [row("borrador", { estado: "borrador", total: 80 }), row("venta", { estado: "confirmada", total: 50 })];
    tablas.alquileres = [row("contrato", { fecha_inicio: "2026-10-06", estado: "abierto", monto_total: null, tarifa: 500 })];
    const historial = await getClienteHistorial("cliente");
    expect(resumenClientes(historial).get("cliente")).toMatchObject({ operaciones: 4, total: 50, importesPorDefinir: 1 });
  });
  test("una fuente fallida impide devolver indicadores parciales como completos", async () => {
    fallo = "cotizaciones_unificadas";
    await expect(getClienteHistorial("cliente")).rejects.toThrow("No se pudieron cargar");
  });
  test("el lector compartido excluye borrados y otra organización y pagina más de 1000 clientes", async () => {
    tablas.clientes = Array.from({ length: 1201 }, (_, i) => row(`c-${String(i).padStart(5, "0")}`, { nombre: `Cliente ${i}` }));
    tablas.clientes.push(row("borrado", { nombre: "Borrado", deleted_at: "2026-10-05" }), row("otra-organizacion", { nombre: "Ajeno", organization_id: "otra" }));
    expect(await getClientesRows()).toHaveLength(1201);
    expect(requests.every(r => r.url.searchParams.get("deleted_at") === "is.null")).toBe(true);
  });
  test("el lector compartido distingue el fallo de una lista vacía", async () => {
    fallo = "clientes";
    await expect(getClientesRows()).rejects.toThrow("No se pudieron cargar");
    fallo = null;
    expect(await getClientesRows()).toEqual([]);
  });
});
