import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ hasSupabaseEnv: vi.fn(), getSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
import { getGerencialSources, readGerencialTable, normalizeGerencialTab } from "@/lib/gerencial-data";
let rows: Record<string, Record<string, unknown>[]>;
let requests: { url: URL; method: string }[];
let mode: "normal" | "failure" | "count" | "duplicate" | "nocount";
const org = "00000000-0000-0000-0000-000000000001";
const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input)); requests.push({ url, method: init?.method ?? "GET" });
  const table = url.pathname.split("/").at(-1)!; const offset = Number(url.searchParams.get("offset") ?? 0); const limit = Number(url.searchParams.get("limit") ?? 1000);
  if (mode === "failure" && table === "movimientos_caja" && offset > 0) return new Response(JSON.stringify({ message: "Fallo aislado" }), { status: 400 });
  let result = [...(rows[table] ?? [])];
  for (const [key, filter] of url.searchParams) {
    if (filter.startsWith("eq.")) result = result.filter(r => String(r[key]) === filter.slice(3));
    if (filter === "is.null") result = result.filter(r => r[key] == null);
  }
  result.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const page = result.slice(offset, offset + limit);
  if (mode === "duplicate" && offset > 0 && page.length > 0) page[0] = result[0];
  const count = result.length + (mode === "count" && offset > 0 ? 1 : 0);
  return new Response(JSON.stringify(page), { headers: { "content-type": "application/json", ...(mode === "nocount" ? {} : { "content-range": `${offset}-${offset + page.length - 1}/${count}` }) } });
};
describe("Lectura completa de Centro de Mando", () => {
  beforeEach(() => {
    rows = {}; requests = []; mode = "normal"; vi.clearAllMocks(); mocks.hasSupabaseEnv.mockReturnValue(true);
    mocks.getSupabaseServerClient.mockReturnValue(createClient("https://mando.test", "test-key", { global: { fetch: fixtureFetch }, auth: { persistSession: false, autoRefreshToken: false } }));
  });
  test("recorre más de 1000 filas y filtra organización, anulados y borrados antes de paginar", async () => {
    rows.movimientos_caja = Array.from({ length: 1201 }, (_, i) => ({ id: String(i).padStart(5, "0"), organization_id: org }));
    rows.movimientos_caja.push({ id: "borrado", organization_id: org, deleted_at: "2026-10-01" }, { id: "anulado", organization_id: org, voided_at: "2026-10-01" }, { id: "ajeno", organization_id: "otro" });
    expect(await readGerencialTable("movimientos_caja")).toHaveLength(1201);
    expect(requests).toHaveLength(3); expect(requests.every(r => r.method === "GET" && r.url.searchParams.get("deleted_at") === "is.null" && r.url.searchParams.get("voided_at") === "is.null" && r.url.searchParams.get("organization_id") === `eq.${org}`)).toBe(true);
  });
  test.each(["failure", "count", "duplicate", "nocount"] as const)("%s invalida la fuente sin devolver suma parcial", async type => {
    rows.movimientos_caja = Array.from({ length: 601 }, (_, i) => ({ id: String(i).padStart(5, "0"), organization_id: org })); mode = type;
    await expect(readGerencialTable("movimientos_caja")).rejects.toThrow();
  });
  test("una fuente fallida se separa de otras fuentes consultadas correctamente", async () => {
    rows.movimientos_caja = Array.from({ length: 601 }, (_, i) => ({ id: String(i).padStart(5, "0"), organization_id: org })); mode = "failure";
    const s = await getGerencialSources("hoy"); expect(s.movimientos_caja).toBeNull(); expect(s.ventas_madera).toEqual([]);
  });
  test("Futuro no carga inventario ni servicios innecesarios", async () => {
    await getGerencialSources("futuro"); expect(requests.some(r => r.url.pathname.includes("inventario") || r.url.pathname.includes("servicios_aserradero"))).toBe(false);
  });
  test("los enlaces antiguos siguen funcionando y un tab inválido vuelve a Hoy", () => {
    expect(normalizeGerencialTab("pasado")).toBe("pasado"); expect(normalizeGerencialTab("incorrecto")).toBe("hoy"); expect(normalizeGerencialTab("futuro", "criticas")).toBe("hoy");
  });
});
