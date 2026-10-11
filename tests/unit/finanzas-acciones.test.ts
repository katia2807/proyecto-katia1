import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), client: vi.fn(), runtime: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.auth }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.runtime }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.client }));
vi.mock("@/lib/numeracion", () => ({ nextCorrelativo: vi.fn().mockResolvedValue("AUDIT-001") }));
vi.mock("@/lib/store-persistence", () => ({ readStoreFromDisk: () => null, writeStoreToDisk: vi.fn() }));
vi.mock("@/lib/company-config", () => ({ getEmpresaConfig: vi.fn() }));

import { createVentaMadera, createVentaMaderaCortada, createServicioAserradero, updateServicioAserradero,
  createVentaMuebleTerminado, createCompraMadera, cerrarContratoAlquiler, createVentaDesdePdf,
  aprobarCotizacionAOrden, registrarCobroCotizacionUnificada, consultarCobroCotizacionUnificada } from "@/app/actions";
import { DEFAULT_ORG_ID as org } from "@/lib/constants";
import { defaultCotizacionDetalleV1 } from "@/lib/cotizacion-unificada-payload";

const actor = "10000000-0000-4000-8000-000000000001", cliente = "20000000-0000-4000-8000-000000000001";
const producto = "30000000-0000-4000-8000-000000000001", contrato = "40000000-0000-4000-8000-000000000001";
const cot = "50000000-0000-4000-8000-000000000001";
let db: PGlite;
type Row = Record<string, unknown>;
const tables = new Set(["clientes", "proveedores", "inventario_productos", "muebles_catalogo", "ventas_madera", "ventas_madera_lineas",
  "inventario_movimientos", "ventas_mueble_terminado", "ventas_madera_cortada", "servicios_aserradero", "compras_madera",
  "alquileres", "cotizaciones_unificadas", "cotizaciones_mueble", "ordenes_produccion", "movimientos_caja"]);
const functions = new Set(["crear_compra_madera_con_caja", "cerrar_alquiler_con_caja", "consultar_cobro_cotizacion",
  "registrar_cobro_cotizacion_seguro", "aprobar_cotizacion_con_adelanto", "editar_aserradero_con_caja"]);
const name = (value: string) => { if (!/^[a-z_][a-z_0-9]*$/.test(value)) throw new Error("Nombre inválido"); return '"' + value + '"'; };
const parameter = (value: unknown) => typeof value === "object" && value !== null ? JSON.stringify(value) : value;

// Adaptador del protocolo: ejecuta la migración REAL. No reproduce reglas financieras ni usa red.
const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.hostname !== "finanzas.invalid") throw new Error("Conexión externa bloqueada por la prueba");
  const table = url.pathname.split("/").pop()!;
  const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
  try {
    const body: Row = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.pathname.includes("/rpc/")) {
      if (!functions.has(table)) throw new Error("RPC no permitida en la prueba");
      const keys = Object.keys(body);
      const result = await db.query<Row>("select " + name(table) + "(" + keys.map((key, i) => name(key) + " => $" + (i + 1)).join(",") + ") result", keys.map(key => parameter(body[key])));
      return response(result.rows[0].result);
    }
    if (!tables.has(table)) throw new Error("Tabla no permitida en la prueba");
    const params: unknown[] = [];
    const where: string[] = [];
    for (const [key, value] of url.searchParams) {
      if (value === "is.null") where.push(name(key) + " is null");
      else if (value.startsWith("eq.") || value.startsWith("neq.")) {
        params.push(value.slice(value.indexOf(".") + 1));
        where.push(name(key) + (value.startsWith("eq.") ? " = $" : " <> $") + params.length);
      }
    }
    const filter = where.length ? " where " + where.join(" and ") : "";
    const method = init?.method ?? "GET";
    let sql = "select * from " + name(table) + filter;
    if (method === "POST") {
      const keys = Object.keys(body);
      params.push(...keys.map(key => parameter(body[key])));
      sql = "insert into " + name(table) + "(" + keys.map(name).join(",") + ") values (" + keys.map((_, i) => "$" + (i + 1)).join(",") + ") returning *";
    } else if (method === "DELETE") sql = "delete from " + name(table) + filter + " returning *";
    else if (method === "PATCH") {
      const keys = Object.keys(body), offset = params.length;
      params.push(...keys.map(key => parameter(body[key])));
      sql = "update " + name(table) + " set " + keys.map((key, i) => name(key) + "=$" + (offset + i + 1)).join(",") + filter + " returning *";
    }
    const rows = (await db.query<Row>(sql, params)).rows;
    const single = new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object");
    return response(single ? rows[0] ?? null : rows);
  } catch (e) {
    const error = e as { message: string; code?: string };
    return response({ message: error.message, code: error.code ?? "XX000" }, 400);
  }
};
const data = (values: Row) => { const result = new FormData(); for (const [key, value] of Object.entries(values)) result.set(key, String(value)); return result; };
const totalCaja = async () => Number((await db.query<{ total: string }>("select coalesce(sum(monto),0)::text total from movimientos_caja")).rows[0].total);
const count = async (table: string) => Number((await db.query<{ n: number }>("select count(*) n from " + name(table))).rows[0].n);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync("tests/unit/fixtures/finanzas.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261010010000_cobros_y_cierres_seguros.sql", "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  vi.clearAllMocks();
  await db.exec("reset role; set auditoria.fallo_caja='no'; set auditoria.fallo_categoria=''; truncate perfiles," + [...tables].map(name).join(",") + " cascade;");
  await db.query("insert into perfiles values($1,$2,'owner_admin',null,null)", [actor, org]);
  await db.query("insert into clientes values($1,$2,'Cliente ficticio',null)", [cliente, org]);
  await db.query("insert into proveedores values($1,$2)", [cliente, org]);
  await db.query("insert into inventario_productos values($1,$2,'Tabla ficticia',100,'PT','Madera')", [producto, org]);
  await db.query("insert into muebles_catalogo values($1,$2,'Mueble ficticio',100)", [producto, org]);
  await db.query("insert into alquileres(id,organization_id,cliente_id,estado,monto_total,deposito_30,penalidad,penalidad_retraso_pago_pct,penalidad_devolucion_tardia_pct,penalidad_danios_pct,metodo_pago,codigo)values($1,$2,$3,'abierto',1000,300,0,3,3,3,'yape','AUDIT-ALQ')", [contrato, org, cliente]);
  await db.query("insert into cotizaciones_unificadas values($1,$2,$3,1000,'AUDIT-COT','2026-10-10','lista_produccion',$4,null)", [cot, org, cliente, JSON.stringify(defaultCotizacionDetalleV1())]);
  mocks.auth.mockResolvedValue({ userId: actor, organizationId: org, role: "owner_admin", uiRole: null });
  mocks.runtime.mockReturnValue(true);
  mocks.client.mockReturnValue(createClient("https://finanzas.invalid", "clave-ficticia", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fixtureFetch } }));
});

describe.each(["madera", "aserradero", "muebles", "madera cortada"])("Cobros de %s", (tipo) => {
  function venta(modalidad: string, adelanto = 0) {
    const base = { cliente_id: cliente, fecha: "2026-10-10", total: 1000, metodo_pago: "yape", modalidad_pago: modalidad,
      adelanto, estado: "confirmada", tipo_comprobante: "ninguno", fecha_pago_credito: "2026-10-31" };
    if (tipo === "madera") return createVentaMadera(data({ ...base, inventario_producto_id: producto, cantidad_producto: 1 }));
    if (tipo === "aserradero") return createServicioAserradero(data({ ...base, pies_cubicos: 10, costo_cubicaje: 100, precio_cobrado: 1000, lineas_json: "[]" }));
    const entrega = { chofer_id: "", tipo_entrega: "entrega_local", direccion_entrega: "", estado_entrega: "pendiente", monto_credito: 0 };
    if (tipo === "muebles") return createVentaMuebleTerminado(data({ ...base, ...entrega, mueble_catalogo_id: producto, cantidad: 2, precio_unitario: 500 }));
    return createVentaMaderaCortada(data({ ...base, ...entrega, tipo_corte: "tabla", total_pt: 20, precio_por_pt: 50,
      cantidad_piezas: 10, precio_unitario_comercial: 100, inventario_producto_id: "",
      lineas_cubicaje: JSON.stringify([{ cantidad: 10, espesor: 1, ancho: 6, largo: 4, descripcion: "Pieza ficticia" }]) }));
  }
  test.each([["contado", 0, 1000], ["credito", 0, 0], ["adelanto", 300, 300]] as const)("%s registra solo S/%s de adelanto o el total correspondiente", async (modalidad, adelanto, esperado) => {
    await venta(modalidad, adelanto);
    expect(await totalCaja()).toBe(esperado);
    if (esperado > 0) expect((await db.query<{ medio: string }>("select medio from movimientos_caja")).rows[0].medio).toBe("yape");
  });
  test("rechaza adelanto mayor que el total antes de guardar", async () => {
    await expect(venta("adelanto", 1500)).rejects.toThrow(/adelanto/i);
    expect(await totalCaja()).toBe(0);
  });
});

const cerrar = (penalidades = false) => cerrarContratoAlquiler(data({ contrato_id: contrato, fecha_cierre: "2026-10-10", observaciones: "",
  retraso_pago: penalidades, devolucion_tardia: penalidades, danios: penalidades }));
describe("Cierre completo del alquiler", () => {
  test("dos llamadas con la misma vista registran una sola vez S/700", async () => {
    const resultados = await Promise.all([cerrar(), cerrar()]);
    expect(resultados.filter(r => r.ok)).toHaveLength(1);
    expect(await totalCaja()).toBe(700);
  });
  test("penalidades originales: S/90 más saldo S/700", async () => {
    expect(await cerrar(true)).toEqual({ ok: true });
    expect(await totalCaja()).toBe(790);
  });
  test("fallo del saldo después de la penalidad revierte ambos ingresos y el cierre", async () => {
    await db.exec("set auditoria.fallo_categoria='alquiler_bomba_mixer'");
    expect(await cerrar(true)).toMatchObject({ ok: false });
    expect(await totalCaja()).toBe(0);
    expect((await db.query<{ estado: string }>("select estado from alquileres")).rows[0].estado).toBe("abierto");
    await db.exec("set auditoria.fallo_categoria=''");
    expect(await cerrar(true)).toEqual({ ok: true });
    expect(await totalCaja()).toBe(790);
  });
});
const aprobar = (adelanto: number) => aprobarCotizacionAOrden(data({ cotizacion_id: cot, notas: "", adelanto, metodo_adelanto: "yape" }));
describe("Cotización y adelantos ya recibidos", () => {
  test("adelanto S/300 y saldo S/700 suman S/1000 y solo se cobran una vez", async () => {
    await aprobar(300);
    expect(await consultarCobroCotizacionUnificada(cot)).toEqual({ ok: true, total: 1000, cobrado: 300, saldo: 700 });
    expect(await registrarCobroCotizacionUnificada(cot, { medio: "banco", totalEsperado: 1000, saldoEsperado: 700 })).toEqual({ ok: true });
    expect(await totalCaja()).toBe(1000);
    expect(await registrarCobroCotizacionUnificada(cot, { medio: "banco", totalEsperado: 1000, saldoEsperado: 700 })).toMatchObject({ ok: false });
    expect(await totalCaja()).toBe(1000);
  });
  test("un saldo anterior no cobra silenciosamente un importe diferente", async () => {
    await aprobar(300);
    expect(await registrarCobroCotizacionUnificada(cot, { medio: "yape", totalEsperado: 1000 })).toMatchObject({ ok: false });
    expect(await totalCaja()).toBe(300);
  });
  test("un fallo de Caja revierte la orden y permite reintentar", async () => {
    await db.exec("set auditoria.fallo_caja='si'");
    await expect(aprobar(300)).rejects.toThrow(/Caja/);
    expect(await count("ordenes_produccion")).toBe(0);
    expect((await db.query<{ estado_flujo: string }>("select estado_flujo from cotizaciones_unificadas")).rows[0].estado_flujo).toBe("lista_produccion");
    await db.exec("set auditoria.fallo_caja='no'");
    await aprobar(300);
    expect(await totalCaja()).toBe(300);
  });
  test("un fallo del cobro conserva el estado y el adelanto", async () => {
    await aprobar(300);
    await db.exec("set auditoria.fallo_caja='si'");
    expect(await registrarCobroCotizacionUnificada(cot, { medio: "yape", totalEsperado: 1000, saldoEsperado: 700 })).toMatchObject({ ok: false });
    expect(await totalCaja()).toBe(300);
    expect((await db.query<{ estado_flujo: string }>("select estado_flujo from cotizaciones_unificadas")).rows[0].estado_flujo).toBe("en_produccion");
  });
  test("doble aprobación crea una sola orden y un adelanto", async () => {
    const resultados = await Promise.allSettled([aprobar(300), aprobar(300)]);
    expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await count("ordenes_produccion")).toBe(1);
    expect(await totalCaja()).toBe(300);
  });
  test("aprobar y cobrar desde dos vistas no sobrepasa el total", async () => {
    await Promise.allSettled([aprobar(300), registrarCobroCotizacionUnificada(cot, { medio: "yape", totalEsperado: 1000 })]);
    expect(await totalCaja()).toBeLessThanOrEqual(1000);
  });
});
describe("Compra y PDF simulado", () => {
  const compra = () => createCompraMadera(data({ proveedor_id: cliente, fecha: "2026-10-10", especie_madera: "Cedro", detalle: "Ficticio", cantidad: 10, unidad: "PT", precio_unitario: 100, modalidad_pago: "contado", adelanto: 0, estado: "confirmada", url_comprobante: "" }));
  test("fallo del egreso no deja una compra confirmada", async () => {
    await db.exec("set auditoria.fallo_caja='si'");
    await expect(compra()).rejects.toThrow(/Caja/);
    expect(await count("compras_madera")).toBe(0);
    await db.exec("set auditoria.fallo_caja='no'");
    await compra();
    expect(await count("compras_madera")).toBe(1);
    expect(await totalCaja()).toBe(1000);
  });
  test("el acceso directo al importador simulado no escribe ningún registro", async () => {
    await expect(createVentaDesdePdf(data({ cliente_id: cliente, total: 1000 }))).rejects.toThrow(/no está disponible/);
    expect(await count("ventas_madera")).toBe(0);
    expect(await totalCaja()).toBe(0);
  });
});

describe("Editar aserradero conserva el cobro real", () => {
  async function crear(modalidad: string, adelanto: number) {
    await createServicioAserradero(data({ cliente_id: cliente, fecha: "2026-10-10", precio_cobrado: 1000, costo_cubicaje: 100,
      pies_cubicos: 10, lineas_json: "[]", metodo_pago: "yape", modalidad_pago: modalidad, adelanto, tipo_comprobante: "ninguno" }));
    return String((await db.query<Row>("select id from servicios_aserradero")).rows[0].id);
  }
  const editar = (id: string) => updateServicioAserradero(data({ id, cliente_id: cliente, fecha: "2026-10-10", precio_cobrado: 1200, costo_cubicaje: 100, pies_cubicos: 10, lineas_json: "[]" }));
  test.each([["credito", 0], ["adelanto", 300]] as const)("editar precio no transforma %s en cobro total", async (modalidad, adelanto) => {
    const id = await crear(modalidad, adelanto);
    await editar(id);
    expect(await totalCaja()).toBe(adelanto);
  });
  test("fallo de actualización de Caja no altera el precio del servicio", async () => {
    const id = await crear("contado", 0);
    await db.exec("set auditoria.fallo_caja='si'");
    await expect(editar(id)).rejects.toThrow(/Caja/);
    expect(Number((await db.query<Row>("select precio_cobrado from servicios_aserradero")).rows[0].precio_cobrado)).toBe(1000);
    expect(await totalCaja()).toBe(1000);
  });
  test("un período cerrado bloquea el editor antes de cambiar el servicio", async () => {
    const id = await crear("contado", 0);
    await db.exec("update movimientos_caja set periodo_cerrado=true");
    await expect(editar(id)).rejects.toThrow(/período cerrado/);
    expect(Number((await db.query<Row>("select precio_cobrado from servicios_aserradero")).rows[0].precio_cobrado)).toBe(1000);
  });
});

test("el permiso UI de lectura no hereda el rol propietario en las funciones nuevas", async () => {
  await db.exec("update perfiles set ui_role='readonly'");
  await expect(aprobar(300)).rejects.toThrow(/autorizado/);
  expect(await totalCaja()).toBe(0);
});
test("una sesión pública no puede ejecutar las funciones financieras", async () => {
  await db.exec("set role authenticated");
  try { await expect(db.query("select consultar_cobro_cotizacion($1,$2,$3)", [org, actor, cot])).rejects.toThrow(/permission denied/); }
  finally { await db.exec("reset role"); }
});

test("instalar la migración conserva incluso importes históricos que requieren revisión", async () => {
  const copia = new PGlite();
  try {
    await copia.exec(readFileSync("tests/unit/fixtures/finanzas.sql", "utf8"));
    await copia.query("insert into clientes values($1,$2,'Histórico ficticio',null)", [cliente, org]);
    await copia.query("insert into ventas_madera(organization_id,cliente_id,total,estado) values($1,$2,1000,'confirmada')", [org, cliente]);
    await copia.query("insert into servicios_aserradero(organization_id,cliente_id,precio_cobrado,adelanto) values($1,$2,1000,1500)", [org, cliente]);
    await copia.query("insert into movimientos_caja(organization_id,fecha,tipo,medio,categoria,monto,modulo_origen) values($1,'2026-10-01','ingreso','efectivo','histórico ficticio',1300,'ventas')", [org]);
    const cajaAnterior = (await copia.query("select * from movimientos_caja")).rows;
    const aserraderoAnterior = (await copia.query("select * from servicios_aserradero")).rows;
    await copia.exec(readFileSync("supabase/migrations/20261010010000_cobros_y_cierres_seguros.sql", "utf8"));
    expect((await copia.query("select * from movimientos_caja")).rows).toEqual(cajaAnterior);
    expect((await copia.query("select * from servicios_aserradero")).rows).toEqual(aserraderoAnterior);
    expect((await copia.query("select total,metodo_pago,modalidad_pago,adelanto from ventas_madera")).rows[0])
      .toEqual({ total: "1000.00", metodo_pago: null, modalidad_pago: null, adelanto: null });
    await expect(copia.query("insert into servicios_aserradero(organization_id,cliente_id,precio_cobrado,adelanto) values($1,$2,1000,1500)", [org, cliente]))
      .rejects.toThrow(/aserradero_adelanto_dentro_total/);
  } finally { await copia.close(); }
}, 30000);
