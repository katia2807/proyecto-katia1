import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  hasSupabaseEnv: vi.fn(), getSupabaseServerClient: vi.fn(),
  wizard: vi.fn(), master: vi.fn(), demoRows: vi.fn(), demoById: vi.fn(),
}));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/demo-store", () => ({ demoCotizacionesUnificadasRows: mocks.demoRows, demoGetCotizacionUnificada: mocks.demoById }));
vi.mock("@/lib/current-user-role", () => ({ getDashboardSession: async () => ({ role: "owner_admin", uiRole: "owner_admin" }) }));
vi.mock("@/lib/numeracion", () => ({ previewCorrelativo: async () => "N°0106" }));
vi.mock("@/lib/company-config", () => ({ DEFAULT_EMPRESA_CONFIG: {}, getEmpresaConfig: async () => ({}) }));
vi.mock("@/lib/data", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/data")>(),
  getInventarioProductosRows: async () => [], getMueblesCatalogoRows: async () => [],
  getClientesRows: async () => [{ id: "cliente", nombre: "Cliente ficticio" }],
}));
vi.mock("@/components/cotizacion-unificada-wizard", () => ({
  CotizacionUnificadaWizard: (props: unknown) => { mocks.wizard(props); return createElement("div", null, "FORMULARIO COTIZACION"); },
}));
vi.mock("@/components/cotizacion-master-detail", () => ({
  CotizacionMasterDetail: (props: unknown) => { mocks.master(props); return createElement("div", null, "LISTADO COTIZACIONES"); },
}));

import CotizacionPage from "@/app/(dashboard)/cotizacion/page";
import { getCotizacionesUnificadasHistorial, getCotizacionUnificadaById } from "@/lib/data";
import { DEFAULT_ORG_ID } from "@/lib/constants";

type Fila = ReturnType<typeof fixtureRow>;
function fixtureRow(indice: number) {
  return {
    id: `00000000-0000-4000-8000-${String(indice).padStart(12, "0")}`,
    organization_id: DEFAULT_ORG_ID, cliente_id: "cliente", fecha: "2026-10-06", correlativo: `N°${indice}`,
    tipo_cliente: "natural", total: 100, estado_flujo: "pendiente", detalle: {},
    created_at: new Date(Date.UTC(2026, 9, 6, 10, 0, indice)).toISOString(), deleted_at: null as string | null,
  };
}
let filas: Fila[];
let fallo: "historial" | "seleccion" | "interrumpida" | null;
let requests: { url: URL; method: string }[];
const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  requests.push({ url, method: init?.method ?? "GET" });
  const id = url.searchParams.get("id")?.replace(/^eq\./, "");
  if (fallo === "interrumpida") throw new DOMException("Interrupción ficticia", "AbortError");
  if ((fallo === "historial" && !id) || (fallo === "seleccion" && id)) {
    return new Response(JSON.stringify({ message: "Fallo de prueba", code: "TEST" }), { status: 400 });
  }
  const disponibles = filas.filter((fila) => fila.organization_id === DEFAULT_ORG_ID && fila.deleted_at === null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const limite = Number(url.searchParams.get("limit") ?? disponibles.length);
  const resultado = id ? disponibles.filter((fila) => fila.id === id) : disponibles.slice(0, limite);
  return new Response(JSON.stringify(resultado), {
    status: 200, headers: { "content-type": "application/json", "content-range": `0-${Math.max(0, resultado.length - 1)}/${disponibles.length}` },
  });
};

describe("carga y alcance del historial de Cotizaciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    filas = Array.from({ length: 105 }, (_, indice) => fixtureRow(indice));
    fallo = null; requests = [];
    mocks.hasSupabaseEnv.mockReturnValue(true);
    mocks.getSupabaseServerClient.mockReturnValue(createClient("https://cotizaciones-test.supabase.co", "clave-ficticia", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fixtureFetch },
    }));
    mocks.demoRows.mockReturnValue([]); mocks.demoById.mockReturnValue(null);
  });

  test("devuelve 100 filas y el conteo real sin consultar otras organizaciones ni escribir", async () => {
    filas.push({ ...fixtureRow(999), organization_id: "otra-organizacion" });
    filas.push({ ...fixtureRow(998), deleted_at: "2026-10-06T10:00:00Z" });
    const resultado = await getCotizacionesUnificadasHistorial();
    expect(resultado.rows).toHaveLength(100);
    expect(resultado.totalCount).toBe(105);
    expect(resultado.loadWarning).toBeNull();
    expect(requests.every((request) => request.method === "GET")).toBe(true);
    expect(requests[0].url.searchParams.get("organization_id")).toBe(`eq.${DEFAULT_ORG_ID}`);
    expect(requests[0].url.searchParams.get("deleted_at")).toBe("is.null");
    expect(requests[0].url.searchParams.get("order")).toBe("fecha.desc,created_at.desc");
  });

  test("un fallo de consulta tiene aviso y conteo desconocido, no cero registros", async () => {
    fallo = "historial";
    expect(await getCotizacionesUnificadasHistorial()).toMatchObject({ rows: [], totalCount: null, loadWarning: expect.any(String) });
  });

  test("una consulta interrumpida no se confunde con historial vacío", async () => {
    fallo = "interrumpida";
    expect((await getCotizacionesUnificadasHistorial()).loadWarning).toBeTruthy();
  });

  test("una carga vacía correcta conserva conteo cero y no muestra aviso", async () => {
    filas = [];
    expect(await getCotizacionesUnificadasHistorial()).toEqual({ rows: [], totalCount: 0, loadWarning: null });
  });

  test("la copia local aplica el mismo límite y omite filas eliminadas o de otra organización", async () => {
    mocks.hasSupabaseEnv.mockReturnValue(false);
    mocks.demoRows.mockReturnValue([...filas, { ...fixtureRow(999), deleted_at: "eliminada" }, { ...fixtureRow(998), organization_id: "otra" }]);
    expect(await getCotizacionesUnificadasHistorial()).toMatchObject({ rows: expect.any(Array), totalCount: 105, loadWarning: null });
    expect((await getCotizacionesUnificadasHistorial()).rows).toHaveLength(100);
  });

  test("editar una cotización fuera de las 100 la carga por ID y aclara el alcance", async () => {
    const antigua = filas[0];
    const html = renderToStaticMarkup(await CotizacionPage({ searchParams: Promise.resolve({ editar: antigua.id }) }));
    expect(html).toContain("Mostrando 101 de 105 cotizaciones");
    expect(mocks.wizard.mock.calls[0][0].cotizacionesGuardadas[0].id).toBe(antigua.id);
    expect(requests.some((request) => request.url.searchParams.get("id") === `eq.${antigua.id}`)).toBe(true);
  });

  test("una cotización ya incluida no provoca una segunda lectura por ID", async () => {
    await CotizacionPage({ searchParams: Promise.resolve({ editar: filas[104].id }) });
    expect(requests).toHaveLength(1);
  });

  test("un enlace inexistente no muestra el formulario nuevo", async () => {
    const html = renderToStaticMarkup(await CotizacionPage({ searchParams: Promise.resolve({ editar: fixtureRow(777).id }) }));
    expect(html).toContain("No se encontró la cotización solicitada");
    expect(html).not.toContain("FORMULARIO COTIZACION");
    expect(mocks.wizard).not.toHaveBeenCalled();
  });

  test("un enlace inválido se avisa sin consultarlo en la base", async () => {
    const html = renderToStaticMarkup(await CotizacionPage({ searchParams: Promise.resolve({ editar: "no-es-un-id" }) }));
    expect(html).toContain("El enlace de la cotización no es válido");
    expect(requests).toHaveLength(1);
    expect(mocks.wizard).not.toHaveBeenCalled();
  });

  test("si falla la lectura de la cotización solicitada no muestra formulario nuevo", async () => {
    fallo = "seleccion";
    const html = renderToStaticMarkup(await CotizacionPage({ searchParams: Promise.resolve({ editar: filas[0].id }) }));
    expect(html).toContain("No se pudo cargar la cotización solicitada");
    expect(mocks.wizard).not.toHaveBeenCalled();
    await expect(getCotizacionUnificadaById(filas[0].id, { throwOnError: true })).rejects.toThrow("Fallo de prueba");
    expect(await getCotizacionUnificadaById(filas[0].id)).toBeNull();
  });

  test("si falla el historial la página muestra el aviso y evita el mensaje de ausencia", async () => {
    fallo = "historial";
    const html = renderToStaticMarkup(await CotizacionPage({}));
    expect(html).toContain("No se pudo cargar el historial de cotizaciones");
    expect(html).not.toContain("0 cotizaciones registradas");
    expect(mocks.master).not.toHaveBeenCalled();
    expect(mocks.wizard.mock.calls[0][0].historialLoadWarning).toBeTruthy();
  });
});
