import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ hasSupabaseEnv: vi.fn(), getSupabaseServerClient: vi.fn(), demoCajaRows: vi.fn() }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/demo-store", () => ({ demoCajaRows: mocks.demoCajaRows }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { getCajaPanelData } from "@/lib/caja-resumen-data";
import { CajaResumen } from "@/components/caja/caja-resumen";
import { normalizeCajaFiltros } from "@/lib/caja-filtros";

type Row = Record<string, unknown> & { id: string };
const org = "00000000-0000-0000-0000-000000000001";
let rows: Row[];
let requests: URL[];
let backendLimit: number;
let failOffset: number | null;
let emptyOffset: number | null;
let countChanges: boolean;
let duplicatePage: boolean;
let omitCount: boolean;
const movimiento = (n: number, overrides: Record<string, unknown> = {}): Row => ({
  id: `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`, organization_id: org,
  fecha: "2026-10-04", created_at: "2026-10-04T12:00:00Z", tipo: "ingreso", monto: 1,
  medio: "efectivo", categoria: "Prueba", es_personal: false, voided_at: null, deleted_at: null,
  ...overrides,
});

// El SDK real procesa rangos y conteos en respuestas locales; no se consulta la base del negocio.
const fixtureFetch: typeof fetch = async input => {
  const url = new URL(String(input));
  requests.push(url);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  if (offset === failOffset) return new Response(JSON.stringify({ message: "Fallo local" }), { status: 400 });
  let found = rows.filter(row => row.organization_id === url.searchParams.get("organization_id")?.slice(3));
  for (const [field, filter] of url.searchParams) if (filter === "is.null") found = found.filter(row => row[field] == null);
  found.sort((a, b) => {
    for (const order of url.searchParams.get("order")?.split(",") ?? []) {
      const [field, direction] = order.split(".");
      const diff = String(a[field] ?? "").localeCompare(String(b[field] ?? ""));
      if (diff) return direction === "desc" ? -diff : diff;
    }
    return 0;
  });
  const total = found.length + (countChanges && offset > 0 ? 1 : 0);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 1000), backendLimit);
  const start = duplicatePage && offset > 0 ? 0 : offset;
  const page = offset === emptyOffset ? [] : found.slice(start, start + limit);
  return new Response(JSON.stringify(page), { headers: {
    "content-type": "application/json",
    ...(!omitCount ? { "content-range": `${page.length ? `${offset}-${offset + page.length - 1}` : "*"}/${total}` } : {}),
  } });
};

describe("Caja: resumen completo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rows = []; requests = []; backendLimit = 1000; failOffset = null; emptyOffset = null;
    countChanges = false; duplicatePage = false; omitCount = false;
    mocks.hasSupabaseEnv.mockReturnValue(true);
    mocks.getSupabaseServerClient.mockImplementation(() => createClient("https://caja.test", "test-key", {
      global: { fetch: fixtureFetch }, auth: { persistSession: false, autoRefreshToken: false },
    }));
    mocks.demoCajaRows.mockImplementation(() => [...rows]);
  });

  test("incluye más de 50 y 1.000 movimientos y solo envía 50 a la tabla", async () => {
    rows = Array.from({ length: 1203 }, (_, i) => movimiento(i + 1));
    rows.push(movimiento(1204, { fecha: "2020-01-01", tipo: "egreso", monto: "7.25" }));
    rows.push(movimiento(1205, { fecha: "2019-12-31", tipo: "egreso", monto: 9.50, es_personal: true }));
    const result = await getCajaPanelData();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.empresa).toMatchObject({ ingresos: 1203, gastos: 7.25, saldo: 1195.75, movimientos: 1204, desde: "2020-01-01", hasta: "2026-10-04" });
    expect(result.personal).toMatchObject({ ingresos: 0, gastos: 9.5, saldo: -9.5, movimientos: 1 });
    expect(result.totalVista).toBe(1205);
    expect(result.rows).toHaveLength(50);
    expect(requests.map(url => url.searchParams.get("offset"))).toEqual(["0", "500", "1000"]);
    expect(requests.every(url => url.searchParams.get("voided_at") === "is.null" && url.searchParams.get("deleted_at") === "is.null")).toBe(true);
  });

  test("el tamaño elegido pagina 20 filas sin alterar el saldo completo ni repetir registros", async () => {
    rows = Array.from({length:55},(_,n)=>movimiento(n+1));
    const first = await getCajaPanelData("empresa",org,normalizeCajaFiltros({por_pagina:"20"}));
    const second = await getCajaPanelData("empresa",org,normalizeCajaFiltros({por_pagina:"20",pagina:"2"}));
    if (!first.ok || !second.ok) throw new Error("No cargó el historial ficticio");
    expect(first.rows).toHaveLength(20);
    expect(second.rows).toHaveLength(20);
    expect(first.empresa.saldo).toBe(55);
    expect(second.empresa.saldo).toBe(55);
    expect(new Set([...first.rows,...second.rows].map(r=>r.id)).size).toBe(40);
  });

  test("continúa hasta el conteo exacto si el servidor devuelve páginas más pequeñas", async () => {
    backendLimit = 100;
    rows = Array.from({ length: 251 }, (_, i) => movimiento(i + 1));
    const result = await getCajaPanelData();
    expect(result.ok && result.empresa.saldo).toBe(251);
    expect(requests.map(url => url.searchParams.get("offset"))).toEqual(["0", "100", "200"]);
  });

  test("separa empresa y personal y encuentra filas personales anteriores a las últimas 50", async () => {
    rows = Array.from({ length: 60 }, (_, i) => movimiento(i + 1));
    rows.push(movimiento(70, { fecha: "2025-01-01", es_personal: true, monto: 30 }));
    rows.push(movimiento(71, { fecha: "2025-01-02", es_personal: true, tipo: "egreso", monto: 50 }));
    const result = await getCajaPanelData("personal");
    expect(result.ok && result.personal.saldo).toBe(-20);
    expect(result.ok && result.empresa.saldo).toBe(60);
    expect(result.totalVista).toBe(2);
    expect(result.rows.map(row => row.id)).toEqual([movimiento(71).id, movimiento(70).id]);
  });

  test("excluye anulados, eliminados y otra organización antes del cálculo y del rango", async () => {
    rows = [movimiento(1), movimiento(2, { voided_at: "2026-10-04T12:00:00Z", monto: 100 }), movimiento(3, { deleted_at: "2026-10-04T12:00:00Z", monto: 200 }), movimiento(4, { organization_id: "otra", monto: 300 })];
    const result = await getCajaPanelData("empresa");
    expect(result.ok && result.empresa.saldo).toBe(1);
    expect(result.totalVista).toBe(1);
    expect(result.rows.map(row => row.id)).toEqual([movimiento(1).id]);
  });

  test("consulta la organización indicada", async () => {
    rows = [movimiento(1), movimiento(2, { organization_id: "otra", monto: 20 })];
    const result = await getCajaPanelData("empresa", "otra");
    expect(result.ok && result.empresa.saldo).toBe(20);
    expect(requests[0].searchParams.get("organization_id")).toBe("eq.otra");
  });

  test("suma centavos sin acumular errores de decimales y no trata transferencias como gastos", async () => {
    rows = [movimiento(1, { monto: 0.1 }), movimiento(2, { monto: 0.2 }), movimiento(3, { tipo: "egreso", monto: 0.15 }), movimiento(4, { tipo: "transferencia", monto: 99 })];
    const result = await getCajaPanelData();
    expect(result.ok && result.empresa).toMatchObject({ ingresos: 0.3, gastos: 0.15, saldo: 0.15, transferencias: 1 });
  });

  test("un historial vacío comprobado devuelve cero y ningún período inventado", async () => {
    const result = await getCajaPanelData();
    expect(result.ok && result.empresa).toMatchObject({ ingresos: 0, gastos: 0, saldo: 0, movimientos: 0, desde: null, hasta: null });
    expect(result.totalVista).toBe(0);
  });

  test.each(["fallo", "vacío", "conteo", "duplicado", "sin conteo"])("invalida el resumen completo si hay %s en la carga", async caso => {
    rows = Array.from({ length: 501 }, (_, i) => movimiento(i + 1));
    if (caso === "fallo") failOffset = 500;
    if (caso === "vacío") emptyOffset = 500;
    if (caso === "conteo") countChanges = true;
    if (caso === "duplicado") duplicatePage = true;
    if (caso === "sin conteo") omitCount = true;
    expect(await getCajaPanelData()).toEqual({ ok: false, empresa: null, personal: null, rows: [], totalVista: null });
  });

  test.each([NaN, -1, null])("rechaza un importe inválido (%s) sin convertirlo en un saldo de cero", async monto => {
    rows = [movimiento(1, { monto })];
    expect((await getCajaPanelData()).ok).toBe(false);
  });

  test("el modo local también calcula todo el historial y excluye eliminados", async () => {
    mocks.hasSupabaseEnv.mockReturnValue(false);
    rows = Array.from({ length: 65 }, (_, i) => movimiento(i + 1));
    rows.push(movimiento(70, { tipo: "egreso", monto: 7, fecha: "2020-01-01" }));
    rows.push(movimiento(71, { monto: 999, deleted_at: "2026-10-04T12:00:00Z" }));
    const result = await getCajaPanelData();
    expect(result.ok && result.empresa.saldo).toBe(58);
    expect(result.rows).toHaveLength(50);
    expect(result.totalVista).toBe(66);
    expect(mocks.getSupabaseServerClient).not.toHaveBeenCalled();
  });

  test("el aviso distingue un fallo de carga de un historial realmente vacío", async () => {
    const unavailable = renderToStaticMarkup(createElement(CajaResumen, { resumen: null, vista: "todos" }));
    expect(unavailable).toContain("No se pudo cargar Caja completa");
    expect(unavailable).toContain("Reintentar");
    expect(unavailable).toContain("No disponible");
    expect(unavailable).not.toMatch(/S\/[^<]*0[,.]00/);
    const result = await getCajaPanelData();
    const empty = renderToStaticMarkup(createElement(CajaResumen, { resumen: result.empresa, vista: "todos" }));
    expect(empty).toContain("Aún sin movimientos");
    expect(empty).not.toContain("No disponible");
  });

  test.each([true, false])("encuentra movimientos antiguos con todos los filtros sin alterar el saldo (Supabase=%s)", async supabase => {
    mocks.hasSupabaseEnv.mockReturnValue(supabase);
    rows = Array.from({ length: 501 }, (_, i) => movimiento(i + 1, { descripcion: "Ingreso reciente" }));
    rows.push(movimiento(600, { fecha: "2024-01-01", tipo: "egreso", medio: "yape", monto: 25, categoria: "compra_madera", descripcion: "Compra a José Pérez. Boleta B001-100." }));
    rows.push(movimiento(601, { fecha: "2024-01-01", tipo: "egreso", medio: "yape", monto: 40, categoria: "compra_madera", descripcion: "Compra a José Pérez. Boleta B001-101.", es_personal: true }));
    const filtros = normalizeCajaFiltros({ buscar: "Jose Perez", desde: "2024-01-01", hasta: "2024-01-01", tipo: "egreso", medio: "yape", comprobante: "boleta" });
    const empresa = await getCajaPanelData("empresa", org, filtros);
    expect(empresa.ok).toBe(true);
    if (!empresa.ok) return;
    expect(empresa.rows.map(row => row.id)).toEqual([movimiento(600).id]);
    expect(empresa.totalVista).toBe(502);
    expect(empresa.totalResultados).toBe(1);
    expect(empresa.empresa.saldo).toBe(476);
    expect(empresa.personal.saldo).toBe(-40);
    const personal = await getCajaPanelData("personal", org, filtros);
    expect(personal.rows.map(row => row.id)).toEqual([movimiento(601).id]);
    expect(personal.ok && personal.totalResultados).toBe(1);
  });

  test("pagina las coincidencias de todo el historial sin saltos ni duplicados y conserva el saldo", async () => {
    rows = Array.from({ length: 255 }, (_, i) => movimiento(i + 1, { tipo: i % 2 === 0 ? "ingreso" : "egreso", descripcion: "Cliente José Pérez" }));
    const ids: string[] = [];
    for (let pagina = 1; pagina <= 3; pagina++) {
      const data = await getCajaPanelData("empresa", org, normalizeCajaFiltros({ buscar: "José", tipo: "ingreso", pagina: String(pagina) }));
      expect(data.ok).toBe(true);
      if (!data.ok) return;
      expect(data.totalResultados).toBe(128);
      expect(data.totalVista).toBe(255);
      expect(data.empresa.saldo).toBe(1);
      expect(data.pagina).toBe(pagina);
      expect(data.rows).toHaveLength(pagina === 3 ? 28 : 50);
      ids.push(...data.rows.map(row => row.id));
    }
    expect(new Set(ids).size).toBe(128);
    expect(ids).toEqual(rows.filter(row => row.tipo === "ingreso").sort((a, b) => b.id.localeCompare(a.id)).map(row => row.id));
    const ultima = await getCajaPanelData("empresa", org, normalizeCajaFiltros({ tipo: "ingreso", pagina: "99" }));
    expect(ultima.ok && ultima.pagina).toBe(3);
    expect(ultima.rows).toHaveLength(28);
  });

  test("ningún resultado o un rango inválido conservan el resumen general comprobado", async () => {
    rows = [movimiento(1, { monto: 100 })];
    for (const filtros of [normalizeCajaFiltros({ buscar: "Sin coincidencia" }), normalizeCajaFiltros({ desde: "2026-10-05", hasta: "2026-10-04" })]) {
      const data = await getCajaPanelData("empresa", org, filtros);
      expect(data.ok && data.empresa.saldo).toBe(100);
      expect(data.ok && data.totalResultados).toBe(0);
      expect(data.rows).toEqual([]);
    }
  });
});
