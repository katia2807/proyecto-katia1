import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({ hasSupabaseEnv: vi.fn(), getSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/store-persistence", () => ({ readStoreFromDisk: () => null, writeStoreToDisk: vi.fn() }));

import { DEFAULT_ORG_ID } from "@/lib/constants";
import { getMueblesCatalogoRows } from "@/lib/data";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let requests: Array<{ table: string; method: string }>;
let unavailable: boolean;

// El SDK real recibe respuestas en memoria; ninguna petición sale a una base real.
const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  const table = url.pathname.split("/").at(-1)!;
  const method = init?.method ?? "GET";
  requests.push({ table, method });
  if (unavailable && table === "muebles_catalogo") {
    return new Response(JSON.stringify({ message: "No disponible" }), { status: 400 });
  }
  let rows = [...(tables[table] ?? [])];
  for (const [key, value] of url.searchParams) {
    if (value.startsWith("eq.")) rows = rows.filter(row => String(row[key]) === value.slice(3));
  }
  if (method === "POST") tables[table].push(JSON.parse(String(init?.body)));
  if (method === "PATCH") for (const row of rows) Object.assign(row, JSON.parse(String(init?.body)));
  rows.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
  return new Response(method === "HEAD" ? null : JSON.stringify(rows), {
    headers: { "content-type": "application/json", "content-range": `0-${rows.length - 1}/${rows.length}` },
  });
};

describe("Catálogo: consultar conserva los datos guardados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unavailable = false;
    requests = [];
    tables = {
      muebles_catalogo: [
        { id: "mueble", organization_id: DEFAULT_ORG_ID, codigo: "M-01", nombre: "Ropero", activo: true,
          precio_lista: 650, stock_disponible: 7, foto_url: "catalogo.jpg" },
        { id: "inactivo", organization_id: DEFAULT_ORG_ID, nombre: "Armario", activo: false, precio_lista: 850 },
        { id: "otra-empresa", organization_id: "otra", nombre: "Ajeno", activo: true, precio_lista: 900 },
      ],
      inventario_productos: [
        { id: "mueble", organization_id: DEFAULT_ORG_ID, codigo: "M-01", nombre: "Ropero", categoria: "Muebles",
          activo: true, costo_unitario: 250, stock_actual: 3, foto_url: null },
        { id: "sin-catalogo", organization_id: DEFAULT_ORG_ID, codigo: "M-02", nombre: "Mesa", categoria: "Muebles",
          activo: true, costo_unitario: 100, stock_actual: 2, foto_url: "inventario.jpg" },
      ],
    };
    mocks.hasSupabaseEnv.mockReturnValue(true);
    mocks.getSupabaseServerClient.mockReturnValue(createClient("https://catalogo.test", "test-key", {
      global: { fetch: fixtureFetch }, auth: { persistSession: false, autoRefreshToken: false },
    }));
  });

  test("abrir o recargar no inserta muebles ni cambia precio, stock o fotos", async () => {
    const before = structuredClone(tables);
    for (let index = 0; index < 2; index++) {
      expect(await getMueblesCatalogoRows()).toEqual([before.muebles_catalogo[0]]);
    }
    expect(tables).toEqual(before);
    expect(requests).toEqual([
      { table: "muebles_catalogo", method: "GET" }, { table: "muebles_catalogo", method: "GET" },
    ]);
  });

  test("Inventario puede consultar inactivos sin alterar el filtro habitual de Ventas", async () => {
    expect((await getMueblesCatalogoRows(true)).map(row => row.id)).toEqual(["inactivo", "mueble"]);
    expect((await getMueblesCatalogoRows()).map(row => row.id)).toEqual(["mueble"]);
    expect(requests.every(request => request.method === "GET")).toBe(true);
  });

  test("un fallo de lectura no intenta crear o reparar registros", async () => {
    const before = structuredClone(tables);
    unavailable = true;
    expect(await getMueblesCatalogoRows(true)).toEqual([]);
    expect(tables).toEqual(before);
    expect(requests).toEqual([{ table: "muebles_catalogo", method: "GET" }]);
  });
});
