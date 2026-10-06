import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({ requireAuthContext: vi.fn(), getSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.requireAuthContext }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: () => true }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/numeracion", () => ({ nextCorrelativo: vi.fn() }));
vi.mock("@/lib/store-persistence", () => ({ readStoreFromDisk: () => null, writeStoreToDisk: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { DEFAULT_ORG_ID } from "@/lib/constants";
import { updateInventarioProducto, updateMuebleCatalogo } from "@/app/actions";

const id = "22222222-2222-4222-8222-222222222222";
type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let writes: Array<{ table: string; patch: Row }>;

const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  const table = url.pathname.split("/").at(-1)!;
  let selected = [...tables[table]];
  for (const [key, value] of url.searchParams) {
    if (value.startsWith("eq.")) selected = selected.filter(row => String(row[key]) === value.slice(3));
    if (key === "or") {
      const filters = value.slice(1, -1).split(",");
      selected = selected.filter(row => filters.some(filter => {
        const [field, op, expected] = filter.split(".");
        return op === "ilike" ? String(row[field]).toLowerCase() === expected.toLowerCase() : String(row[field]) === expected;
      }));
    }
  }
  const isUpdate = init?.method === "PATCH";
  if (isUpdate) {
    const patch = JSON.parse(String(init?.body)) as Row;
    writes.push({ table, patch });
    for (const row of selected) Object.assign(row, patch);
  }
  const single = new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object");
  return new Response(JSON.stringify(single ? selected[0] : selected), { headers: { "content-type": "application/json" } });
};

describe("Guardados: costo y precio de venta independientes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writes = [];
    tables = {
      inventario_productos: [{ id, organization_id: DEFAULT_ORG_ID, codigo: "M-01", nombre: "Ropero", costo_unitario: 250, stock_actual: 5, foto_url: "antes.jpg" }],
      muebles_catalogo: [{ id, organization_id: DEFAULT_ORG_ID, codigo: "M-01", nombre: "Ropero", precio_lista: 650, stock_disponible: 5, foto_url: "antes.jpg" }],
    };
    mocks.requireAuthContext.mockResolvedValue({ role: "owner_admin", uiRole: "owner_admin" });
    mocks.getSupabaseServerClient.mockReturnValue(createClient("https://guardado.test", "test-key", {
      global: { fetch: fixtureFetch }, auth: { persistSession: false, autoRefreshToken: false },
    }));
  });

  function inventarioForm() {
    const form = new FormData();
    for (const [key, value] of Object.entries({ id, codigo: "M-01", nombre: "Ropero", categoria: "Muebles",
      unidad: "unidad", stock_minimo: "1", stock_actual: "8", costo_unitario: "300", foto_url: "inventario.jpg" })) form.set(key, value);
    return form;
  }

  function catalogoForm() {
    const form = new FormData();
    for (const [key, value] of Object.entries({ id, precio_lista: "720", descripcion: "Precio revisado", foto_url: "catalogo.jpg" })) form.set(key, value);
    return form;
  }

  test("editar costo conserva el precio y sigue actualizando stock y foto al guardar", async () => {
    await updateInventarioProducto(inventarioForm());
    expect(tables.inventario_productos[0]).toMatchObject({ costo_unitario: 300, stock_actual: 8, foto_url: "inventario.jpg" });
    expect(tables.muebles_catalogo[0]).toMatchObject({ precio_lista: 650, stock_disponible: 8, foto_url: "inventario.jpg" });
    expect(writes.filter(write => write.table === "muebles_catalogo").every(write => !("precio_lista" in write.patch))).toBe(true);
  });

  test("editar precio conserva el costo y sigue compartiendo la foto al guardar", async () => {
    await updateMuebleCatalogo(catalogoForm());
    expect(tables.muebles_catalogo[0]).toMatchObject({ precio_lista: 720, foto_url: "catalogo.jpg" });
    expect(tables.inventario_productos[0]).toMatchObject({ costo_unitario: 250, stock_actual: 5, foto_url: "catalogo.jpg" });
    expect(writes.filter(write => write.table === "inventario_productos").every(write => !("costo_unitario" in write.patch))).toBe(true);
  });

  test("un usuario de solo lectura no puede guardar ni sincronizar", async () => {
    const before = structuredClone(tables);
    mocks.requireAuthContext.mockResolvedValue({ role: "owner_admin", uiRole: "readonly" });
    await expect(updateInventarioProducto(inventarioForm())).rejects.toThrow("solo lectura");
    await expect(updateMuebleCatalogo(catalogoForm())).rejects.toThrow("solo lectura");
    expect(tables).toEqual(before);
    expect(writes).toEqual([]);
  });
});
