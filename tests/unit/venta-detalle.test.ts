import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  hasSupabaseEnv: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  requireAuthContext: vi.fn(),
  demoVentasRows: vi.fn(),
  demoAlquilerRows: vi.fn(),
  demoVentasMuebleTerminadoRows: vi.fn(),
  demoServiciosAserraderoRows: vi.fn(),
  demoCotizacionesUnificadasRows: vi.fn(),
  demoClientesRows: vi.fn(),
  demoCajaRows: vi.fn(),
  demoCreateCaja: vi.fn(),
  demoDeleteOneById: vi.fn(),
  persistStore: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.requireAuthContext }));
vi.mock("@/lib/demo-store", () => mocks);
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/numeracion", () => ({ nextCorrelativo: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));

import { getVentaDetalle, isVentaDetalleTipo } from "@/lib/venta-detalle";
import VentaDetallePage from "@/app/(dashboard)/ventas/detalle/[tipo]/[id]/page";
import { getAlquilerById, getCotizacionUnificadaById, getCotizacionesUnificadasRows } from "@/lib/data";
import { updateContratoAlquiler } from "@/app/actions";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { defaultCotizacionDetalleV1 } from "@/lib/cotizacion-unificada-payload";

type Row = Record<string, unknown>;
const org = "empresa-actual";
let tables: Record<string, Row[]>;
let requests: URL[];
let failures: Set<string>;
let mutations: { table: string; method: string }[];

function row(id: string, values: Row = {}): Row {
  return { id, organization_id: org, cliente_id: "cliente", deleted_at: null, ...values };
}

// Respuestas locales con el SDK real para comprobar la selección de tabla y
// los filtros por empresa e ID, sin leer ni cambiar datos del negocio.
const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  requests.push(url);
  const table = url.pathname.split("/").at(-1)!;
  const method = init?.method ?? "GET";
  if (method !== "GET") mutations.push({ table, method });
  if (failures.has(table)) {
    return new Response(JSON.stringify({ message: "No disponible", code: "TEST_ERROR" }), { status: 400 });
  }
  const selected = (tables[table] ?? []).filter((record) => {
    for (const [field, value] of url.searchParams) {
      if (value.startsWith("eq.") && String(record[field]) !== value.slice(3)) return false;
      if (value === "is.null" && record[field] != null) return false;
    }
    return true;
  });
  if (method === "PATCH") {
    for (const record of selected) Object.assign(record, JSON.parse(String(init?.body)));
  } else if (method === "DELETE") {
    tables[table] = tables[table].filter((record) => !selected.includes(record));
  } else if (method === "POST") {
    tables[table] = [...(tables[table] ?? []), JSON.parse(String(init?.body))];
  }
  return new Response(JSON.stringify(selected), { headers: { "content-type": "application/json" } });
};

function datosContrato() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    id: "pendiente", cliente_id: "11111111-1111-4111-8111-111111111111", activo: "Bomba Mixer",
    codigo: "", representante: "", ruc_empresa: "", direccion_ejecucion: "",
    fecha_inicio: "2026-10-03", fecha_termino: "", dias_alquiler: "2", tarifa_unidad: "dia",
    tarifa: "650", monto_total: "1300", metodo_pago: "efectivo", modalidad_pago: "credito",
    fecha_pago_credito: "2026-10-10", adelanto: "0", monto_credito: "1300",
    penalidad_retraso_pago_pct: "3", penalidad_devolucion_tardia_pct: "3", penalidad_danios_pct: "3",
  })) form.set(key, value);
  return form;
}

function contratoConCaja(periodoCerrado: boolean, organizationId = org) {
  tables.alquileres = [row("pendiente", {
    organization_id: organizationId, estado: "abierto", monto_total: 900,
    activo: "Activo anterior", tarifa: 450, dias_alquiler: 2, deposito_30: 270,
  })];
  tables.movimientos_caja = [row("caja-alquiler", {
    organization_id: organizationId, referencia_id: "pendiente", modulo_origen: "ventas_alquiler",
    periodo_cerrado: periodoCerrado, monto: 270,
  })];
}

describe("Detalle de ventas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tables = { clientes: [row("cliente", { nombre: "Cliente actual" })] };
    requests = [];
    mutations = [];
    failures = new Set();
    mocks.hasSupabaseEnv.mockReturnValue(true);
    mocks.getSupabaseServerClient.mockImplementation(() => createClient("https://detalle.test", "test-key", {
      global: { fetch: fixtureFetch }, auth: { persistSession: false, autoRefreshToken: false },
    }));
    mocks.requireAuthContext.mockResolvedValue({ organizationId: org, role: "owner_admin", uiRole: "owner_admin" });
    mocks.demoVentasRows.mockImplementation(() => tables.demo_ventas ?? []);
    mocks.demoAlquilerRows.mockImplementation(() => tables.alquileres ?? []);
    mocks.demoVentasMuebleTerminadoRows.mockImplementation(() => tables.ventas_mueble_terminado ?? []);
    mocks.demoServiciosAserraderoRows.mockImplementation(() => tables.servicios_aserradero ?? []);
    mocks.demoCotizacionesUnificadasRows.mockImplementation(() => tables.cotizaciones_unificadas ?? []);
    mocks.demoClientesRows.mockImplementation(() => tables.clientes ?? []);
    mocks.demoCajaRows.mockReturnValue([]);
  });

  test("consulta el registro por ID aunque esté fuera de las primeras páginas del historial", async () => {
    tables.ventas_madera = Array.from({ length: 105 }, (_, i) => row(`venta-${i}`, { total: i }));
    const detalle = await getVentaDetalle("venta-madera", "venta-104", org);
    expect(detalle?.total).toBe(104);
    expect(requests[0].searchParams.get("id")).toBe("eq.venta-104");
    expect(requests[0].searchParams.get("organization_id")).toBe(`eq.${org}`);
  });

  test.each([true, false])("el detalle de cotización muestra el importe guardado, documento y descripción sin generar cobros (Supabase: %s)", async supabase => {
    mocks.hasSupabaseEnv.mockReturnValue(supabase);
    const detalle = defaultCotizacionDetalleV1();
    detalle.rubros.alquiler = true;
    detalle.alquiler!.nombre_maquinaria = "Mixer";
    detalle.descripcion_modo = "manual";
    detalle.descripcion_cliente = "Incluye traslado a la obra.";
    tables.cotizaciones_unificadas = Array.from({ length: 105 }, (_, i) => row(`cot-${i}`, {
      estado_flujo: "cobrada", total: 650, correlativo: `C-${i}`, fecha: "2026-10-04", detalle,
    }));
    const resultado = await getVentaDetalle("cotizacion", "cot-104", org);
    expect(resultado).toMatchObject({
      clienteNombre: "Cliente actual", total: 650, referencia: "C-104", fecha: "2026-10-04",
      estado: "Cobrada", operacion: "Alquiler de Mixer", descripcion: "Incluye traslado a la obra.",
      impresionHref: "/cotizacion/unificada/cot-104/pdf", impresionLabel: "Ver documento de cotización", completarHref: null,
    });
    const volver = "/ventas?categoria=alquileres&buscar=Mixer&historial=3#historial-ventas";
    const html = renderToStaticMarkup(await VentaDetallePage({
      params: Promise.resolve({ tipo: "cotizacion", id: "cot-104" }), searchParams: Promise.resolve({ volver }),
    }));
    expect(html).toContain(volver.replaceAll("&", "&amp;"));
    expect(html).toContain("Cobrada");
    expect(html).toContain("Incluye traslado a la obra.");
    expect(html).not.toContain("Completar datos");
    expect(html).not.toContain("Confirmar cobro");
    expect(mutations).toEqual([]);
    expect(mocks.demoCreateCaja).not.toHaveBeenCalled();
    if (supabase) expect(requests[0].searchParams.get("estado_flujo")).toBe("eq.cobrada");
  });

  test.each([true, false])("no abre como venta una propuesta sin cobrar o de otra empresa (Supabase: %s)", async supabase => {
    mocks.hasSupabaseEnv.mockReturnValue(supabase);
    tables.cotizaciones_unificadas = [
      row("pendiente", { estado_flujo: "pendiente", total: 650 }),
      row("ajena", { organization_id: "otra", estado_flujo: "cobrada", total: 650 }),
    ];
    expect(await getVentaDetalle("cotizacion", "pendiente", org)).toBeNull();
    expect(await getVentaDetalle("cotizacion", "ajena", org)).toBeNull();
    await expect(VentaDetallePage({ params: Promise.resolve({ tipo: "cotizacion", id: "pendiente" }) })).rejects.toThrow("NOT_FOUND");
    failures.add("cotizaciones_unificadas");
    if (supabase) await expect(getVentaDetalle("cotizacion", "pendiente", org)).rejects.toThrow("No se pudo cargar");
  });

  test("el detalle y documento rechazan una cotización eliminada y el listado tampoco la recupera", async () => {
    tables.cotizaciones_unificadas = [row("eliminada", {
      organization_id: DEFAULT_ORG_ID, estado_flujo: "cobrada", total: 650, deleted_at: "2026-10-04T10:00:00Z",
    })];
    expect(await getVentaDetalle("cotizacion", "eliminada", DEFAULT_ORG_ID)).toBeNull();
    expect(await getCotizacionUnificadaById("eliminada")).toBeNull();
    expect(await getCotizacionesUnificadasRows()).toEqual([]);
    expect(requests.every(url => url.searchParams.get("deleted_at") === "is.null")).toBe(true);
  });

  test("completar datos también carga contratos antiguos por ID y respeta su empresa", async () => {
    tables.alquileres = Array.from({ length: 105 }, (_, i) => row(`alquiler-${i}`));
    expect((await getAlquilerById("alquiler-104", org))?.id).toBe("alquiler-104");
    expect(await getAlquilerById("alquiler-104", "otra")).toBeNull();
    failures.add("alquileres");
    await expect(getAlquilerById("alquiler-104", org)).rejects.toThrow("No se pudo cargar");
  });

  test("no expone operaciones ni nombres de otra empresa", async () => {
    tables.alquileres = [row("ajeno", { organization_id: "otra", monto_total: 100 })];
    expect(await getVentaDetalle("alquiler", "ajeno", org)).toBeNull();
    tables.alquileres = [row("propio", { monto_total: 100 })];
    tables.clientes = [row("cliente", { organization_id: "otra", nombre: "Cliente ajeno" })];
    expect((await getVentaDetalle("alquiler", "propio", org))?.clienteNombre).toBe("Cliente por definir");
    expect(requests.at(-1)?.searchParams.get("organization_id")).toBe(`eq.${org}`);
  });

  test("una tarifa registrada no inventa el total de un alquiler incompleto", async () => {
    tables.alquileres = [row("pendiente", { tarifa: 650, monto_total: null, estado: "abierto" })];
    const detalle = await getVentaDetalle("alquiler", "pendiente", org);
    expect(detalle?.total).toBeNull();
    expect(detalle?.completarHref).toBe("/ventas/alquiler-mixer/pendiente/editar?desde=detalle");
  });

  test("conserva el cero registrado y el importe de cada origen", async () => {
    tables.ventas_madera_cortada = [row("madera", { total: 0 })];
    tables.ventas_mueble_terminado = [row("mueble", { total: "250.50" })];
    tables.servicios_aserradero = [row("servicio", { precio_cobrado: 320 })];
    expect((await getVentaDetalle("madera", "madera", org))?.total).toBe(0);
    expect((await getVentaDetalle("mueble", "mueble", org))?.total).toBe(250.5);
    expect((await getVentaDetalle("aserradero", "servicio", org))?.total).toBe(320);
  });

  test("no permite completar alquileres cerrados o ya completos", async () => {
    tables.alquileres = [
      row("cerrado", { estado: "cerrado", monto_total: null }),
      row("completo", { estado: "abierto", monto_total: 1300, dias_alquiler: 2, tarifa_unidad: "dia" }),
    ];
    expect((await getVentaDetalle("alquiler", "cerrado", org))?.completarHref).toBeNull();
    expect((await getVentaDetalle("alquiler", "completo", org))?.completarHref).toBeNull();
  });

  test("respeta el origen del comprobante incluso con IDs iguales", async () => {
    tables.ventas_madera = [row("compartido", { total: 900 })];
    tables.ventas_madera_cortada = [row("compartido", { total: 540 })];
    expect((await getVentaDetalle("venta-madera", "compartido", org))?.impresionHref).toBe("/ventas/comprobante/venta-madera/compartido");
    expect((await getVentaDetalle("madera", "compartido", org))?.total).toBe(540);
    expect(isVentaDetalleTipo("toString")).toBe(false);
  });

  test("demo también separa origen y empresa", async () => {
    mocks.hasSupabaseEnv.mockReturnValue(false);
    tables.demo_ventas = [row("corte", { tipo_corte: "seco", total: 80 }), row("ajena", { organization_id: "otra" })];
    expect(await getVentaDetalle("venta-madera", "corte", org)).toBeNull();
    expect((await getVentaDetalle("madera", "corte", org))?.total).toBe(80);
    expect(await getVentaDetalle("venta-madera", "ajena", org)).toBeNull();
  });

  test("excluye operaciones eliminadas y propaga errores sin presentarlos como datos pendientes", async () => {
    tables.ventas_madera = [row("eliminada", { deleted_at: "2026-10-03" })];
    expect(await getVentaDetalle("venta-madera", "eliminada", org)).toBeNull();
    failures.add("alquileres");
    await expect(getVentaDetalle("alquiler", "pendiente", org)).rejects.toThrow("No se pudo cargar");
    tables.ventas_madera = [row("activa", { total: 80 })];
    failures.add("clientes");
    await expect(getVentaDetalle("venta-madera", "activa", org)).rejects.toThrow("No se pudieron cargar");
  });

  test("el resumen mantiene impresión y oculta completar datos para el rol de solo lectura", async () => {
    tables.alquileres = [row("pendiente", { estado: "abierto", monto_total: null })];
    const props = { params: Promise.resolve({ tipo: "alquiler", id: "pendiente" }) };
    const editable = renderToStaticMarkup(await VentaDetallePage(props));
    expect(editable).toContain("Completar datos");
    mocks.requireAuthContext.mockResolvedValue({ organizationId: org, role: "owner_admin", uiRole: "readonly" });
    const readonly = renderToStaticMarkup(await VentaDetallePage(props));
    expect(readonly).not.toContain("Completar datos");
    expect(readonly).toContain("Imprimir contrato");
    expect(readonly).toContain("Total por definir");
  });

  test("guardar los datos completa el total y el resumen deja de pedir que se completen", async () => {
    mocks.hasSupabaseEnv.mockReturnValue(false);
    tables.alquileres = [row("pendiente", { estado: "abierto", monto_total: null })];
    tables.clientes = [row("11111111-1111-4111-8111-111111111111", { nombre: "Cliente de prueba" })];
    await expect(updateContratoAlquiler(datosContrato())).resolves.toEqual({ ok: true });
    expect(mocks.persistStore).toHaveBeenCalledOnce();
    expect(mocks.demoCreateCaja).not.toHaveBeenCalled();
    const detalle = await getVentaDetalle("alquiler", "pendiente", org);
    expect(detalle).toMatchObject({ total: 1300, clienteNombre: "Cliente de prueba", completarHref: null });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ventas");
  });

  test("el guardado sigue rechazando cantidades vacías y contratos cerrados", async () => {
    mocks.hasSupabaseEnv.mockReturnValue(false);
    tables.alquileres = [row("pendiente", { estado: "abierto", monto_total: null })];
    const incompleto = datosContrato();
    incompleto.set("dias_alquiler", "");
    expect((await updateContratoAlquiler(incompleto)).ok).toBe(false);
    expect(tables.alquileres[0].monto_total).toBeNull();
    tables.alquileres[0].estado = "cerrado";
    expect((await updateContratoAlquiler(datosContrato())).ok).toBe(false);
    expect(mocks.persistStore).not.toHaveBeenCalled();
    expect(tables.alquileres[0].monto_total).toBeNull();
  });

  test.each(["credito", "adelanto"])("demo conserva contrato y caja cerrada al guardar con %s", async (modalidad) => {
    mocks.hasSupabaseEnv.mockReturnValue(false);
    contratoConCaja(true);
    mocks.demoCajaRows.mockReturnValue(tables.movimientos_caja);
    const antes = structuredClone(tables);
    const form = datosContrato();
    form.set("modalidad_pago", modalidad);
    form.set("adelanto", "390");

    expect(await updateContratoAlquiler(form)).toEqual({
      ok: false, error: "El movimiento de caja pertenece a un período cerrado y no se puede editar.",
    });
    expect(tables).toEqual(antes);
    expect(mocks.persistStore).not.toHaveBeenCalled();
    expect(mocks.demoCreateCaja).not.toHaveBeenCalled();
    expect(mocks.demoDeleteOneById).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test.each(["credito", "adelanto"])("Supabase no envía escrituras si la caja está cerrada al guardar con %s", async (modalidad) => {
    contratoConCaja(true, DEFAULT_ORG_ID);
    const antes = structuredClone(tables);
    const form = datosContrato();
    form.set("modalidad_pago", modalidad);
    form.set("adelanto", "390");

    expect(await updateContratoAlquiler(form)).toEqual({
      ok: false, error: "El movimiento de caja pertenece a un período cerrado y no se puede editar.",
    });
    expect(mutations).toEqual([]);
    expect(tables).toEqual(antes);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test.each(["alquileres", "movimientos_caja"])("un error al consultar %s impide cualquier escritura", async (table) => {
    contratoConCaja(false, DEFAULT_ORG_ID);
    const antes = structuredClone(tables);
    failures.add(table);
    expect(await updateContratoAlquiler(datosContrato())).toEqual({ ok: false, error: "No disponible" });
    expect(mutations).toEqual([]);
    expect(tables).toEqual(antes);
  });

  test.each([false, true])("un contrato inexistente no genera movimientos de caja (Supabase: %s)", async (supabase) => {
    mocks.hasSupabaseEnv.mockReturnValue(supabase);
    const form = datosContrato();
    form.set("modalidad_pago", "adelanto");
    form.set("adelanto", "390");
    expect(await updateContratoAlquiler(form)).toEqual({ ok: false, error: "No se encontró el contrato de alquiler." });
    expect(mutations).toEqual([]);
    expect(mocks.demoCreateCaja).not.toHaveBeenCalled();
    expect(mocks.persistStore).not.toHaveBeenCalled();
  });

  test("demo permite actualizar un alquiler y su adelanto cuando la caja está abierta", async () => {
    mocks.hasSupabaseEnv.mockReturnValue(false);
    contratoConCaja(false);
    mocks.demoCajaRows.mockReturnValue(tables.movimientos_caja);
    const form = datosContrato();
    form.set("modalidad_pago", "adelanto");
    form.set("adelanto", "390");
    expect(await updateContratoAlquiler(form)).toEqual({ ok: true });
    expect(tables.alquileres[0].monto_total).toBe(1300);
    expect(tables.movimientos_caja[0].monto).toBe(390);
    expect(mocks.persistStore).toHaveBeenCalledOnce();
  });

  test.each(["actualizar", "crear", "eliminar"])("Supabase permite %s el movimiento de un alquiler sin caja cerrada", async (operacion) => {
    contratoConCaja(false, DEFAULT_ORG_ID);
    const form = datosContrato();
    if (operacion === "crear") tables.movimientos_caja = [];
    if (operacion !== "eliminar") {
      form.set("modalidad_pago", "adelanto");
      form.set("adelanto", "390");
    }

    expect(await updateContratoAlquiler(form)).toEqual({ ok: true });
    expect(tables.alquileres[0].monto_total).toBe(1300);
    if (operacion === "eliminar") expect(tables.movimientos_caja).toEqual([]);
    else expect(tables.movimientos_caja[0].monto).toBe(390);
    expect(mutations).toEqual([
      { table: "alquileres", method: "PATCH" },
      { table: "movimientos_caja", method: operacion === "eliminar" ? "DELETE" : operacion === "crear" ? "POST" : "PATCH" },
    ]);
  });
});
