import { beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_ORG_ID as org } from "@/lib/constants";
import { defaultCotizacionDetalleV1 } from "@/lib/cotizacion-unificada-payload";

const mocks = vi.hoisted(() => ({ disk: vi.fn(), auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.auth }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: () => false }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: () => { throw new Error("La prueba local no usa Supabase"); } }));
vi.mock("@/lib/company-config", () => ({ getEmpresaConfig: vi.fn() }));
vi.mock("@/lib/numeracion", () => ({ nextCorrelativo: vi.fn().mockResolvedValue("LOCAL-001") }));
vi.mock("@/lib/store-persistence", () => ({ readStoreFromDisk: () => null, writeStoreToDisk: mocks.disk }));
let demo: typeof import("@/lib/demo-store");
let actions: typeof import("@/app/actions");
let cliente: string;
const form = (values: Record<string, unknown>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
};
const totalCaja = () => demo.demoCajaRows().filter(m => m.organization_id === org).reduce((sum, m) => sum + m.monto, 0);
const falloDisco = () => mocks.disk.mockImplementationOnce(() => { throw new Error("Disco de prueba no disponible"); });
beforeEach(async () => {
  vi.resetModules();
  mocks.disk.mockReset();
  mocks.auth.mockResolvedValue({ userId: "10000000-0000-4000-8000-000000000001", organizationId: org, role: "owner_admin", uiRole: null });
  demo = await import("@/lib/demo-store");
  actions = await import("@/app/actions");
  demo.demoResetStore();
  cliente = demo.demoClientesRows().find(c => c.organization_id === org)!.id;
  vi.clearAllMocks();
});

describe.each(["madera", "aserradero", "cortada"])("Cobros locales de %s", tipo => {
  test.each([["credito", 0], ["adelanto", 300]] as const)("%s registra el importe recibido y Yape", async (modalidad, esperado) => {
    const inicial = totalCaja();
    const base = { cliente_id: cliente, fecha: "2026-10-10", total: 1000, estado: "confirmada",
      metodo_pago: "yape", modalidad_pago: modalidad, adelanto: 300, tipo_comprobante: "ninguno", fecha_pago_credito: "2026-10-31" };
    if (tipo === "madera") await actions.createVentaMadera(form({ ...base,
      inventario_producto_id: demo.demoInventarioProductosRows().find(p => p.organization_id === org)!.id, cantidad_producto: 1 }));
    else if (tipo === "aserradero") await actions.createServicioAserradero(form({ ...base, pies_cubicos: 10, costo_cubicaje: 100, precio_cobrado: 1000, lineas_json: "[]" }));
    else await actions.createVentaMaderaCortada(form({ ...base, chofer_id: "", tipo_entrega: "entrega_local", direccion_entrega: "", estado_entrega: "pendiente",
      monto_credito: 0, tipo_corte: "tabla", total_pt: 20, precio_por_pt: 50, cantidad_piezas: 10, precio_unitario_comercial: 100, inventario_producto_id: "",
      lineas_cubicaje: JSON.stringify([{ cantidad: 10, espesor: 1, ancho: 6, largo: 4, descripcion: "Pieza ficticia" }]) }));
    expect(totalCaja() - inicial).toBe(esperado);
    if (esperado > 0) expect(demo.demoCajaRows()[0].medio).toBe("yape");
  });
});
const contrato = () => demo.demoCreateContratoAlquiler({ organization_id: org, cliente_id: cliente, activo: "mixer", fecha_inicio: "2026-10-10",
  tarifa: 1000, monto_total: 1000, deposito_30: 300, metodo_pago: "yape", confirmaIngreso: false });
const cerrar = (id: string) => actions.cerrarContratoAlquiler(form({ contrato_id: id, fecha_cierre: "2026-10-10", observaciones: "" }));
test("un cierre local repetido no duplica el saldo", async () => {
  const id = contrato().id, inicial = totalCaja();
  expect(await cerrar(id)).toEqual({ ok: true });
  expect(await cerrar(id)).toMatchObject({ ok: false });
  expect(totalCaja() - inicial).toBe(700);
});
test("un fallo al guardar el cierre local restaura todo y permite reintentar", async () => {
  const id = contrato().id, anterior = demo.demoExportStore();
  falloDisco();
  expect(await cerrar(id)).toMatchObject({ ok: false });
  expect(demo.demoExportStore()).toEqual(anterior);
  expect(await cerrar(id)).toEqual({ ok: true });
  expect(mocks.disk).toHaveBeenLastCalledWith(expect.anything(), { strict: true });
});
test("una compra local no queda confirmada si falla el guardado conjunto", async () => {
  demo.demoCreateProveedor({ organization_id: org, nombre: "Proveedor ficticio" });
  const proveedor = demo.demoProveedoresRows()[0].id;
  const data = form({ proveedor_id: proveedor, fecha: "2026-10-10", especie_madera: "Prueba", detalle: "", cantidad: 10,
    unidad: "PT", precio_unitario: 100, modalidad_pago: "fiado", adelanto: 300, estado: "confirmada", url_comprobante: "" });
  const anterior = demo.demoExportStore();
  falloDisco();
  await expect(actions.createCompraMadera(data)).rejects.toThrow(/Disco/);
  expect(demo.demoExportStore()).toEqual(anterior);
  await actions.createCompraMadera(data);
  expect(totalCaja() - anterior.caja.reduce((s, m) => s + m.monto, 0)).toBe(300);
});
const cotizacion = () => demo.demoCreateCotizacionUnificada({ organization_id: org, cliente_id: cliente, fecha: "2026-10-10",
  correlativo: "LOCAL-COT", tipo_cliente: "natural", total: 1000, estado_flujo: "lista_produccion", detalle: defaultCotizacionDetalleV1() });
const aprobar = (id: string) => actions.aprobarCotizacionAOrden(form({ cotizacion_id: id, notas: "", adelanto: 300, metodo_adelanto: "yape" }));
test("el adelanto local se vincula a la orden y el cobro final suma solo el saldo", async () => {
  const id = cotizacion().id, inicial = totalCaja();
  await aprobar(id);
  expect(await actions.consultarCobroCotizacionUnificada(id)).toEqual({ ok: true, total: 1000, cobrado: 300, saldo: 700 });
  expect(await actions.registrarCobroCotizacionUnificada(id, { medio: "banco", totalEsperado: 1000, saldoEsperado: 700 })).toEqual({ ok: true });
  expect(totalCaja() - inicial).toBe(1000);
  expect(await actions.registrarCobroCotizacionUnificada(id, { medio: "banco", totalEsperado: 1000, saldoEsperado: 700 })).toMatchObject({ ok: false });
});
test("un fallo local al aprobar restaura la orden, el estado y Caja", async () => {
  const id = cotizacion().id, anterior = demo.demoExportStore();
  falloDisco();
  await expect(aprobar(id)).rejects.toThrow(/Disco/);
  expect(demo.demoExportStore()).toEqual(anterior);
  await aprobar(id);
  await expect(aprobar(id)).rejects.toThrow(/ya tiene una orden/);
});
test("un fallo del cobro local conserva el adelanto y el estado anterior", async () => {
  const id = cotizacion().id;
  await aprobar(id);
  const anterior = demo.demoExportStore();
  falloDisco();
  expect(await actions.registrarCobroCotizacionUnificada(id, { medio: "banco", totalEsperado: 1000, saldoEsperado: 700 })).toMatchObject({ ok: false });
  expect(demo.demoExportStore()).toEqual(anterior);
  expect(await actions.registrarCobroCotizacionUnificada(id, { medio: "banco", totalEsperado: 1000, saldoEsperado: 700 })).toEqual({ ok: true });
});
