import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  hasSupabaseEnv: vi.fn(), getSupabaseServerClient: vi.fn(), requireAuthContext: vi.fn(),
  demoGetCotizacionUnificada: vi.fn(), demoUpdateCotizacionUnificada: vi.fn(),
  demoCajaRows: vi.fn(), demoCreateCaja: vi.fn(), revalidatePath: vi.fn(),
  getEmpresaConfig: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.requireAuthContext }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/numeracion", () => ({ nextCorrelativo: vi.fn() }));
vi.mock("@/lib/company-config", () => ({ getEmpresaConfig: mocks.getEmpresaConfig }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/demo-store", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/demo-store")>(),
  demoGetCotizacionUnificada: mocks.demoGetCotizacionUnificada,
  demoUpdateCotizacionUnificada: mocks.demoUpdateCotizacionUnificada,
  demoCajaRows: mocks.demoCajaRows, demoCreateCaja: mocks.demoCreateCaja,
}));

import { registrarCobroCotizacionUnificada, cambiarEstadoCotizacionUnificada, cambiarEstadoCotizacion, saveCotizacionUnificada, marcarListaProduccionCotizacion, deleteCotizacionUnificada, pasarCotizacionAProduccion } from "@/app/actions";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { defaultCotizacionDetalleV1 } from "@/lib/cotizacion-unificada-payload";

const id = "11111111-1111-4111-8111-111111111111";
let row: { id: string; total: number; correlativo: string; estado_flujo: string; detalle?: unknown; deleted_at?: string | null };
let caja: Record<string, unknown>[];
let fallo: "caja" | "lectura" | "cambio" | "cobro" | "eliminacion" | null;
let escrituras: { tabla: string; body: Record<string, unknown>; url: URL }[];

// El SDK real construye las consultas. El servidor de prueba aplica los filtros
// para comprobar que un cambio simultáneo impide cobrar una versión anterior.
const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  const tabla = url.pathname.split("/").pop()!;
  const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
  expect(url.searchParams.get("organization_id")).toBe(`eq.${DEFAULT_ORG_ID}`);
  if (init?.method === "PATCH" || init?.method === "DELETE") {
    const body = init.method === "PATCH" ? JSON.parse(String(init.body)) : { delete: true };
    escrituras.push({ tabla, body, url });
    if (fallo === "cambio") { row.total = 900; fallo = null; }
    if (fallo === "cobro") { row.estado_flujo = "cobrada"; fallo = null; }
    if (fallo === "eliminacion") { row.deleted_at = "2026-10-04T10:00:00Z"; fallo = null; }
    const estado = url.searchParams.get("estado_flujo");
    const total = url.searchParams.get("total");
    if ((url.searchParams.get("deleted_at") === "is.null" && row.deleted_at) ||
        (estado === "neq.cobrada" && row.estado_flujo === "cobrada") ||
        (estado === "in.(lista_produccion,en_produccion)" && !["lista_produccion", "en_produccion"].includes(row.estado_flujo)) ||
        (estado?.startsWith("eq.") && estado !== `eq.${row.estado_flujo}`) ||
        (total && total !== `eq.${row.total}`)) return response([]);
    if (init.method === "PATCH") Object.assign(row, body);
    else row.deleted_at = "2026-10-04T10:00:00Z";
    return response([{ id }]);
  }
  if (init?.method === "POST") {
    // Las inserciones llevan la organización en el cuerpo, no en el filtro.
    throw new Error("Inserción sin tratar");
  }
  if (fallo === "lectura") return response({ message: "Lectura no disponible", code: "XX000" }, 500);
  return response(tabla === "cotizaciones_unificadas"
    ? (url.searchParams.get("deleted_at") === "is.null" && row.deleted_at ? [] : [row])
    : caja.filter((mov) => !mov.voided_at));
};

const withInsert: typeof fetch = async (input, init) => {
  if (init?.method !== "POST") return fixtureFetch(input, init);
  const url = new URL(String(input));
  const tabla = url.pathname.split("/").pop()!;
  const body = JSON.parse(String(init.body));
  expect(body.organization_id).toBe(DEFAULT_ORG_ID);
  escrituras.push({ tabla, body, url });
  if (fallo === "caja") return new Response(JSON.stringify({ message: "Caja no disponible", code: "XX000" }), { status: 500, headers: { "content-type": "application/json" } });
  caja.push(body);
  return new Response(null, { status: 201 });
};

describe.each([false, true])("Cobro total (Supabase=%s)", (real) => {
  beforeEach(() => {
    vi.clearAllMocks();
    row = { id, total: 650, correlativo: "N°0026", estado_flujo: "lista_produccion" };
    caja = []; fallo = null; escrituras = [];
    mocks.hasSupabaseEnv.mockReturnValue(real);
    mocks.requireAuthContext.mockResolvedValue({ role: "owner_admin", uiRole: "owner_admin", userId: "usuario" });
    mocks.getEmpresaConfig.mockResolvedValue({ margen_ganancia_default_pct: 30 });
    mocks.demoGetCotizacionUnificada.mockImplementation(() => row);
    mocks.demoUpdateCotizacionUnificada.mockImplementation((_id, body) => Object.assign(row, body));
    mocks.demoCajaRows.mockImplementation(() => caja);
    mocks.demoCreateCaja.mockImplementation((body) => { if (fallo === "caja") throw new Error("Caja no disponible"); caja.push(body); });
    mocks.getSupabaseServerClient.mockImplementation(() => createClient("https://cotizacion-cobro.test", "test-key", {
      global: { fetch: withInsert }, auth: { persistSession: false, autoRefreshToken: false },
    }));
  });

  test.each(["efectivo", "banco", "yape", "otro"] as const)("registra una sola vez el total por %s", async (medio) => {
    expect(await registrarCobroCotizacionUnificada(id, { medio, totalEsperado: 650 })).toEqual({ ok: true });
    expect(row.estado_flujo).toBe("cobrada");
    expect(caja).toHaveLength(1);
    expect(caja[0]).toMatchObject({ monto: 650, medio, referencia_id: id, modulo_origen: "cotizacion_unificada" });
    expect(await registrarCobroCotizacionUnificada(id, { medio, totalEsperado: 650 })).toMatchObject({ ok: false });
    expect(caja).toHaveLength(1);
  });
  test("una vista con otro total no registra ingresos ni cambia el estado", async () => {
    expect(await registrarCobroCotizacionUnificada(id, { medio: "yape", totalEsperado: 520 })).toMatchObject({ ok: false });
    expect(row.estado_flujo).toBe("lista_produccion");
    expect(caja).toHaveLength(0);
    expect(escrituras).toHaveLength(0);
  });
  test("rechaza un cobro anterior aunque el estado haya sido reabierto", async () => {
    caja.push({ organization_id: DEFAULT_ORG_ID, referencia_id: id, modulo_origen: "cotizacion_unificada", tipo: "ingreso", monto: 650 });
    expect(await registrarCobroCotizacionUnificada(id, { medio: "banco", totalEsperado: 650 })).toMatchObject({ ok: false });
    expect(row.estado_flujo).toBe("lista_produccion");
    expect(caja).toHaveLength(1);
  });
  test("si Caja rechaza el ingreso, conserva el estado anterior", async () => {
    fallo = "caja";
    expect(await registrarCobroCotizacionUnificada(id, { medio: "yape", totalEsperado: 650 })).toMatchObject({ ok: false });
    expect(row.estado_flujo).toBe("lista_produccion");
    expect(caja).toHaveLength(0);
  });
  test("los cambios de estado no pueden reabrir una cotización cobrada", async () => {
    row.estado_flujo = "cobrada";
    expect(await cambiarEstadoCotizacionUnificada(id, "lista_produccion")).toMatchObject({ ok: false });
    const form = new FormData(); form.set("id", id); form.set("nuevo_estado", "pendiente");
    await expect(cambiarEstadoCotizacion(form)).rejects.toThrow(/cobrada/);
    expect(row.estado_flujo).toBe("cobrada");
  });
  test("marcar cobrada exige pasar por el registro de dinero", async () => {
    expect(await cambiarEstadoCotizacionUnificada(id, "cobrada")).toMatchObject({ ok: false });
    expect(row.estado_flujo).toBe("lista_produccion");
    expect(caja).toHaveLength(0);
  });
  test.each(["pendiente", "terminado", "entregado", "inactivo", "deudor"])("no cobra una propuesta con estado %s", async (estado) => {
    row.estado_flujo = estado;
    expect(await registrarCobroCotizacionUnificada(id, { medio: "efectivo", totalEsperado: 650 })).toMatchObject({ ok: false });
    expect(row.estado_flujo).toBe(estado);
    expect(caja).toHaveLength(0);
  });
  test("valida medio e importe y exige autorización antes de modificar datos", async () => {
    expect(await registrarCobroCotizacionUnificada(id, { medio: "tarjeta" as "otro", totalEsperado: 650 })).toMatchObject({ ok: false });
    expect(await registrarCobroCotizacionUnificada(id, { medio: "efectivo", totalEsperado: 0 })).toMatchObject({ ok: false });
    mocks.requireAuthContext.mockRejectedValueOnce(new Error("Sin permiso"));
    expect(await registrarCobroCotizacionUnificada(id, { medio: "efectivo", totalEsperado: 650 })).toMatchObject({ ok: false });
    expect(caja).toHaveLength(0);
    expect(escrituras).toHaveLength(0);
  });
  test("una cotización eliminada no permite cobrar, aceptar, cambiar estado o editar", async () => {
    row.deleted_at = "2026-10-04T10:00:00Z";
    const detalle = defaultCotizacionDetalleV1();
    detalle.rubros.aserradero = true;
    detalle.aserradero!.precioHora = 500;
    detalle.aserradero!.horas = 1;
    expect(await registrarCobroCotizacionUnificada(id, { medio: "yape", totalEsperado: 650 })).toMatchObject({ ok: false });
    expect(await marcarListaProduccionCotizacion(id)).toMatchObject({ ok: false });
    expect(await cambiarEstadoCotizacionUnificada(id, "pendiente")).toMatchObject({ ok: false });
    expect(await pasarCotizacionAProduccion(id)).toMatchObject({ ok: false });
    expect(await saveCotizacionUnificada({ id, clienteId: id, tipoCliente: "empresa", fecha: "2026-10-04", detalle, total: 650, estadoFlujo: "pendiente" })).toMatchObject({ ok: false });
    expect(row.estado_flujo).toBe("lista_produccion");
    expect(caja).toHaveLength(0);
    expect(escrituras.filter(escritura => escritura.tabla === "movimientos_caja")).toHaveLength(0);
    expect(mocks.demoUpdateCotizacionUnificada).not.toHaveBeenCalled();
  });
  test("el rol de solo lectura rechaza guardar y cobrar antes de consultar los datos", async () => {
    mocks.requireAuthContext.mockResolvedValue({ role: "owner_admin", uiRole: "readonly", userId: "usuario" });
    expect(await registrarCobroCotizacionUnificada(id, { medio: "efectivo", totalEsperado: 650 })).toMatchObject({ ok: false });
    const detalle = defaultCotizacionDetalleV1();
    detalle.rubros.aserradero = true;
    detalle.aserradero!.precioHora = 500;
    detalle.aserradero!.horas = 1;
    expect(await saveCotizacionUnificada({ clienteId: id, tipoCliente: "empresa", fecha: "2026-10-04", detalle, total: 650, estadoFlujo: "pendiente" })).toMatchObject({ ok: false });
    expect(mocks.getSupabaseServerClient).not.toHaveBeenCalled();
    expect(mocks.demoGetCotizacionUnificada).not.toHaveBeenCalled();
    expect(mocks.demoCreateCaja).not.toHaveBeenCalled();
  });
  if (real) {
    test("una eliminación desde otra pestaña no borra una propuesta recién cobrada", async () => {
      fallo = "cobro";
      expect(await deleteCotizacionUnificada(id)).toMatchObject({ ok: false });
      expect(row.estado_flujo).toBe("cobrada");
      expect(row.deleted_at).toBeUndefined();
    });
    test("eliminar una propuesta sin cobrar conserva la posibilidad de eliminación", async () => {
      expect(await deleteCotizacionUnificada(id)).toEqual({ ok: true });
      expect(row.deleted_at).toBeDefined();
      expect(caja).toHaveLength(0);
    });
    test("eliminar entre la lectura y el cobro no genera ingresos", async () => {
      fallo = "eliminacion";
      expect(await registrarCobroCotizacionUnificada(id, { medio: "banco", totalEsperado: 650 })).toMatchObject({ ok: false });
      expect(row.estado_flujo).toBe("lista_produccion");
      expect(caja).toHaveLength(0);
    });
    test("una edición no sobrescribe una cotización cobrada después de leerla", async () => {
      const detalle = defaultCotizacionDetalleV1();
      detalle.rubros.aserradero = true;
      detalle.aserradero = { modo: "hora", precioHora: 500, horas: 1, montoTotalFijo: 0, descripcion: "Propuesta" };
      row.detalle = detalle;
      fallo = "cobro";
      expect(await saveCotizacionUnificada({ id, clienteId: id, tipoCliente: "empresa", fecha: "2026-10-04", detalle, total: 650, estadoFlujo: "pendiente" })).toMatchObject({ ok: false });
      expect(row.estado_flujo).toBe("cobrada");
      expect(row.total).toBe(650);
    });
    test("aceptar desde otra pestaña no reabre una cotización recién cobrada", async () => {
      fallo = "cobro";
      expect(await marcarListaProduccionCotizacion(id)).toMatchObject({ ok: false });
      expect(row.estado_flujo).toBe("cobrada");
    });
    test("un cambio de total entre la lectura y el cobro impide el ingreso", async () => {
      fallo = "cambio";
      expect(await registrarCobroCotizacionUnificada(id, { medio: "banco", totalEsperado: 650 })).toMatchObject({ ok: false });
      expect(row.total).toBe(900);
      expect(row.estado_flujo).toBe("lista_produccion");
      expect(caja).toHaveLength(0);
    });
    test("una lectura fallida no avanza al registro del cobro", async () => {
      fallo = "lectura";
      expect(await registrarCobroCotizacionUnificada(id, { medio: "banco", totalEsperado: 650 })).toMatchObject({ ok: false });
      expect(escrituras).toHaveLength(0);
      expect(row.estado_flujo).toBe("lista_produccion");
    });
  }
});
