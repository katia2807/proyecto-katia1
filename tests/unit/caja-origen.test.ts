import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ hasSupabaseEnv: vi.fn(), getSupabaseServerClient: vi.fn(), requireAuthContext: vi.fn(),
  demoCajaRows: vi.fn(), demoVentasRows: vi.fn(), demoCotizacionesRows: vi.fn(), demoOrdenesProduccionRows: vi.fn(),
  demoCotizacionesUnificadasRows: vi.fn(), demoAlquilerRows: vi.fn(), demoVentasMuebleTerminadoRows: vi.fn(), demoServiciosAserraderoRows: vi.fn(),
}));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.requireAuthContext }));
vi.mock("@/lib/demo-store", () => mocks);
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(`REDIRECT:${href}`); }, useRouter: () => ({ refresh: vi.fn() }) }));

import { getCajaOrigen } from "@/lib/caja-origen-data";
import { cajaOrigenLink, safeCajaHref } from "@/lib/caja-origen-navigation";
import { buildCajaHref, normalizeCajaFiltros } from "@/lib/caja-filtros";
import CajaOrigenPage from "@/app/(dashboard)/caja/origen/[id]/page";

const org = "00000000-0000-0000-0000-000000000001";
const id = "00000000-0000-0000-0000-000000000010";
const ref = "00000000-0000-0000-0000-000000000020";
const cotId = "00000000-0000-0000-0000-000000000030";
type Row = Record<string, unknown> & { id: string; organization_id: string };
const registro = (id: string, values: Record<string, unknown> = {}): Row => ({ id, organization_id: org, deleted_at: null, voided_at: null, ...values });
let tables: Record<string, Row[]>;
let requests: { url: URL; method: string }[];
let failures: Set<string>;

// El SDK recibe respuestas de prueba; ninguna llamada alcanza una base real.
const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  requests.push({ url, method: init?.method ?? "GET" });
  const table = url.pathname.split("/").at(-1)!;
  if (failures.has(table)) return new Response(JSON.stringify({ message: "Fallo local" }), { status: 400 });
  const data = (tables[table] ?? []).filter(row => [...url.searchParams].every(([field, value]) => !value.startsWith("eq.") && value !== "is.null" || (value === "is.null" ? row[field] == null : String(row[field]) === value.slice(3))));
  return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
};

describe("Caja: operación relacionada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tables = { movimientos_caja: [registro(id, { modulo_origen: "ventas_madera", referencia_id: ref })], ventas_madera: [registro(ref)] };
    requests = []; failures = new Set();
    mocks.hasSupabaseEnv.mockReturnValue(true);
    mocks.getSupabaseServerClient.mockImplementation(() => createClient("https://origen.test", "test-key", { global: { fetch: fixtureFetch }, auth: { persistSession: false, autoRefreshToken: false } }));
    mocks.requireAuthContext.mockResolvedValue({ role: "owner_admin", uiRole: "owner_admin", organizationId: org });
    mocks.demoCajaRows.mockImplementation(() => tables.movimientos_caja ?? []);
    mocks.demoVentasRows.mockImplementation(() => [...(tables.ventas_madera ?? []), ...(tables.ventas_madera_cortada ?? []).map(row => ({ ...row, tipo_corte: "dimensionado" }))]);
    mocks.demoCotizacionesRows.mockImplementation(() => tables.cotizaciones_mueble ?? []);
    mocks.demoOrdenesProduccionRows.mockImplementation(() => tables.ordenes_produccion ?? []);
    mocks.demoCotizacionesUnificadasRows.mockImplementation(() => tables.cotizaciones_unificadas ?? []);
    mocks.demoAlquilerRows.mockImplementation(() => tables.alquileres ?? []);
    mocks.demoVentasMuebleTerminadoRows.mockImplementation(() => tables.ventas_mueble_terminado ?? []);
    mocks.demoServiciosAserraderoRows.mockImplementation(() => tables.servicios_aserradero ?? []);
  });

  test.each([
    ["ventas_madera", "ventas_madera", "venta-madera"], ["ventas_pdf", "ventas_madera", "venta-madera"],
    ["ventas_madera_cortada", "ventas_madera_cortada", "madera"], ["ventas_muebles_terminados", "ventas_mueble_terminado", "mueble"],
    ["ventas_aserradero", "servicios_aserradero", "aserradero"], ["aserradero", "servicios_aserradero", "aserradero"],
    ["ventas_alquiler", "alquileres", "alquiler"], ["alquiler", "alquileres", "alquiler"],
    ["cotizacion_unificada", "cotizaciones_unificadas", "cotizacion"],
  ])("abre la operación correcta de %s sin cambiar registros", async (modulo, tabla, tipo) => {
    tables.movimientos_caja = [registro(id, { modulo_origen: modulo, referencia_id: ref })];
    tables[tabla] = [registro(ref, { estado_flujo: "cobrada" })];
    for (const supabase of [true, false]) {
      mocks.hasSupabaseEnv.mockReturnValue(supabase);
      expect(await getCajaOrigen(id, org)).toEqual({ estado: "encontrado", href: `/ventas/detalle/${tipo}/${ref}` });
    }
    expect(requests.every(request => request.method === "GET")).toBe(true);
    expect(requests.every(request => request.url.searchParams.get("organization_id") === `eq.${org}`)).toBe(true);
    if (tabla === "servicios_aserradero") expect(requests.at(-1)?.url.searchParams.has("deleted_at")).toBe(false);
  });

  test.each(["deleted_at", "voided_at", "organization_id"])("no abre un movimiento ajeno, anulado o eliminado (%s)", async campo => {
    tables.movimientos_caja[0][campo] = campo === "organization_id" ? "otra" : "2026-10-04";
    for (const supabase of [true, false]) {
      mocks.hasSupabaseEnv.mockReturnValue(supabase);
      expect(await getCajaOrigen(id, org)).toEqual({ estado: "movimiento-no-disponible" });
    }
    expect(requests).toHaveLength(1);
  });

  test.each(["deleted_at", "organization_id"])("no enlaza una operación eliminada o de otra empresa (%s)", async campo => {
    tables.ventas_madera[0][campo] = campo === "organization_id" ? "otra" : "2026-10-04";
    for (const supabase of [true, false]) {
      mocks.hasSupabaseEnv.mockReturnValue(supabase);
      expect(await getCajaOrigen(id, org)).toEqual({ estado: "no-disponible" });
    }
  });

  test("un origen que dejó de existir se distingue de un fallo de carga", async () => {
    tables.ventas_madera = [];
    expect(await getCajaOrigen(id, org)).toEqual({ estado: "no-disponible" });
    failures.add("ventas_madera");
    expect(await getCajaOrigen(id, org)).toEqual({ estado: "error" });
  });

  test.each([null, "../../admin/usuarios", "https://otro.test", "no-es-id"])("no inventa destinos a partir de una referencia inválida: %s", async referencia => {
    tables.movimientos_caja[0].referencia_id = referencia;
    expect(await getCajaOrigen(id, org)).toEqual({ estado: "sin-vinculo" });
    expect(cajaOrigenLink({ id, modulo_origen: "ventas_madera", referencia_id: referencia }, "/caja")).toBeNull();
    expect(requests).toHaveLength(1);
  });

  test("no consulta ni construye un destino desde un ID de movimiento inválido", async () => {
    expect(await getCajaOrigen("../../admin/usuarios", org)).toEqual({ estado: "movimiento-no-disponible" });
    expect(requests).toHaveLength(0);
  });

  test("un registro manual no adquiere un vínculo solo por mencionar una venta en las notas", async () => {
    tables.movimientos_caja[0].modulo_origen = "caja";
    tables.movimientos_caja[0].descripcion = `Venta ${ref}`;
    expect(await getCajaOrigen(id, org)).toEqual({ estado: "sin-vinculo" });
  });

  test("las cotizaciones que aún no son ventas abren su documento", async () => {
    tables.movimientos_caja[0].modulo_origen = "cotizacion_unificada";
    tables.cotizaciones_unificadas = [registro(ref, { estado_flujo: "en_produccion" })];
    expect(await getCajaOrigen(id, org)).toEqual({ estado: "encontrado", href: `/cotizacion/unificada/${ref}/pdf` });
  });

  test.each(["ventas", "muebles_corte"])("resuelve referencias antiguas a la cotización personalizada (%s)", async modulo => {
    tables.movimientos_caja[0].modulo_origen = modulo;
    tables.cotizaciones_mueble = [registro(ref)];
    for (const supabase of [true, false]) {
      mocks.hasSupabaseEnv.mockReturnValue(supabase);
      expect(await getCajaOrigen(id, org)).toEqual({ estado: "encontrado", href: `/ventas/muebles-personalizados/${ref}/pdf` });
    }
  });

  test.each(["cotizacion_id", "cotizacion_unificada_id"])("sigue la orden de producción hasta su cotización (%s)", async campo => {
    tables.movimientos_caja[0].modulo_origen = "ventas";
    tables.ordenes_produccion = [registro(ref, { [campo]: cotId })];
    tables[campo === "cotizacion_id" ? "cotizaciones_mueble" : "cotizaciones_unificadas"] = [registro(cotId, { estado_flujo: "pendiente" })];
    const destino = campo === "cotizacion_id" ? `/ventas/muebles-personalizados/${cotId}/pdf` : `/cotizacion/unificada/${cotId}/pdf`;
    for (const supabase of [true, false]) {
      mocks.hasSupabaseEnv.mockReturnValue(supabase);
      expect(await getCajaOrigen(id, org), `Modo Supabase: ${supabase}`).toEqual({ estado: "encontrado", href: destino });
    }
  });

  test.each(["eliminada", "otra empresa", "dos referencias", "sin cotización"])("no sigue una orden inválida: %s", async caso => {
    tables.movimientos_caja[0].modulo_origen = "ventas";
    tables.ordenes_produccion = [registro(ref, { cotizacion_id: cotId })];
    tables.cotizaciones_mueble = [registro(cotId)];
    if (caso === "eliminada") tables.ordenes_produccion[0].deleted_at = "2026-10-04";
    if (caso === "otra empresa") tables.cotizaciones_mueble[0].organization_id = "otra";
    if (caso === "dos referencias") tables.ordenes_produccion[0].cotizacion_unificada_id = cotId;
    if (caso === "sin cotización") tables.cotizaciones_mueble = [];
    expect(await getCajaOrigen(id, org)).toEqual({ estado: "no-disponible" });
  });

  test("guarda búsqueda, vista y página con acentos y símbolos en el regreso a Caja", () => {
    const caja = buildCajaHref("empresa", normalizeCajaFiltros({ buscar: "José & Carlos #1", desde: "2026-04-01", hasta: "2026-04-30", medio: "yape", tipo: "egreso", comprobante: "boleta" }), 3);
    const link = cajaOrigenLink({ id, modulo_origen: "ventas_madera", referencia_id: ref }, caja)!;
    expect(new URL(link.href, "https://katia.local").searchParams.get("volver")).toBe(caja);
    expect(safeCajaHref(caja)).toBe(caja);
  });

  test.each(["https://otro.test/caja", "//otro.test/caja", "/caja/origen/123", "/caja/../admin/usuarios", "javascript:alert(1)"])("rechaza un regreso fuera del historial: %s", destino => {
    expect(safeCajaHref(destino)).toBe("/caja#movimientos-caja");
  });

  test("la pantalla comprueba los permisos antes de abrir la operación", async () => {
    mocks.requireAuthContext.mockResolvedValue({ role: "caja", uiRole: null, organizationId: org });
    const page = await CajaOrigenPage({ params: Promise.resolve({ id }) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Acceso limitado");
    expect(html).not.toContain(`/ventas/detalle/venta-madera/${ref}`);
  });

  test("una persona con permiso de lectura puede abrir el origen sin registrar cambios", async () => {
    mocks.requireAuthContext.mockResolvedValue({ role: "owner_admin", uiRole: "readonly", organizationId: org });
    await expect(CajaOrigenPage({ params: Promise.resolve({ id }) })).rejects.toThrow(`REDIRECT:/ventas/detalle/venta-madera/${ref}`);
    expect(requests.every(request => request.method === "GET")).toBe(true);
  });

  test("el aviso de error ofrece reintentar y volver con los mismos filtros", async () => {
    failures.add("ventas_madera");
    const volver = "/caja?vista=personal&buscar=Katia&pagina=2#movimientos-caja";
    const page = await CajaOrigenPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({ volver }) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Reintentar");
    expect(html).toContain("/caja?vista=personal&amp;buscar=Katia&amp;pagina=2#movimientos-caja");
  });
});
