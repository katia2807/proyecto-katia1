import { describe, expect, test } from "vitest";
import { buildGerencialModel, gerencialPeriods, gerencialChange, calendarDate, gerencialAmount } from "@/lib/gerencial-model";
import type { GerencialSources } from "@/lib/gerencial-data";

const now = new Date("2026-10-06T16:00:00Z");
const base = (id: string, extra: Record<string, unknown> = {}) => ({ id, cliente_id: "cliente", nombre: "Cliente", fecha: "2026-10-05", total: 100, ...extra });
function sources(extra: Record<string, unknown[]> = {}) {
  return { movimientos_caja: [], clientes: [base("cliente")], ventas_madera: [], ventas_madera_cortada: [], ventas_mueble_terminado: [], cotizaciones_unificadas: [], alquileres: [], servicios_aserradero: [], ordenes_produccion: [], inventario_productos: [], inventario_movimientos: [], ...extra } as unknown as GerencialSources;
}
const movement = (id: string, extra: Record<string, unknown> = {}) => base(id, { tipo: "ingreso", monto: 100, es_personal: false, modulo_origen: null, referencia_id: null, ...extra });
describe("Centro de Mando: calendario y significado de las cifras", () => {
  test("en la noche de Perú usa octubre aunque UTC ya esté en noviembre", () => {
    expect(gerencialPeriods(new Date("2026-11-01T02:00:00Z"))).toMatchObject({ today: "2026-10-31", start: "2026-10-01", previousStart: "2026-09-01", previousEnd: "2026-09-30" });
  });
  test("el 31 de marzo compara febrero, sin saltar de vuelta a marzo", () => {
    expect(gerencialPeriods(new Date("2026-03-31T18:00:00Z"))).toMatchObject({ previousStart: "2026-02-01", previousEnd: "2026-02-28" });
    expect(gerencialPeriods(new Date("2024-03-31T18:00:00Z")).previousEnd).toBe("2024-02-29");
  });
  test("enero conserva el año anterior y períodos equivalentes hasta el día actual", () => {
    expect(gerencialPeriods(new Date("2026-01-06T18:00:00Z"))).toMatchObject({ start: "2026-01-01", previousStart: "2025-12-01", previousEnd: "2025-12-06" });
  });
  test("rechaza fechas imposibles e importes desconocidos; cero sí es válido", () => {
    expect(calendarDate("2026-02-31")).toBe(false); expect(calendarDate("2024-02-29")).toBe(true);
    expect(gerencialAmount(null)).toBeNull(); expect(gerencialAmount(Infinity)).toBeNull(); expect(gerencialAmount(-1)).toBeNull(); expect(gerencialAmount(0)).toBe(0);
  });
  test("no inventa un porcentaje cuando la base es cero", () => {
    expect(gerencialChange(1000, 0)).toBe("Sin base en el período anterior");
    expect(gerencialChange(null, 0)).toBe("Comparación no disponible");
    expect(gerencialChange(150, 100)).toContain("+50.0%");
  });
  test("Caja excluye personal y futuro, separa el período y mantiene el saldo antiguo", () => {
    const m = buildGerencialModel(sources({ movimientos_caja: [movement("antiguo", { fecha: "2020-01-01", monto: 30 }), movement("actual"), movement("personal", { es_personal: true, monto: 900 }), movement("futuro", { fecha: "2026-10-07", monto: 600 }), movement("gasto", { tipo: "egreso", monto: 40, categoria: "personal" }), movement("anterior", { fecha: "2026-09-05", monto: 50 }), movement("anterior_fuera", { fecha: "2026-09-20", monto: 700 })] }), now);
    expect(m.cash).toMatchObject({ income: 100, expense: 40, result: 60, previousIncome: 50, balance: 840 });
    expect(m.cashPoints).toHaveLength(30); expect(m.cashPoints.at(-1)?.saldo).toBe(840);
  });
  test("un movimiento inválido comunica fuente no disponible en vez de cero", () => {
    const m = buildGerencialModel(sources({ movimientos_caja: [movement("bien"), movement("mal", { monto: null })] }), now);
    expect(m.sources.movimientos_caja).toBeNull(); expect(m.cash.income).toBeNull(); expect(m.cashPoints).toEqual([]);
  });
  test("las operaciones no suman propuestas, inactivas, borradores ni tarifas; ranking solo del período", () => {
    const m = buildGerencialModel(sources({ ventas_madera: [base("confirmada", { estado: "confirmada", total: 50 }), base("borrador", { estado: "borrador", total: 900 }), base("antigua", { estado: "confirmada", fecha: "2026-04-01", total: 800 })], cotizaciones_unificadas: [base("pagada", { estado_flujo: "cobrada", total: 70 }), base("propuesta", { estado_flujo: "pendiente", total: 600 }), base("inactiva", { estado_flujo: "inactivo", total: 1000 })], alquileres: [base("abierto", { fecha_inicio: "2026-10-05", estado: "abierto", tarifa: 500, monto_total: null }), base("cerrado", { fecha_inicio: "2026-10-05", estado: "cerrado", tarifa: 500, monto_total: null })] }), now);
    expect(m.operationsAmount).toBe(120); expect(m.unknownOperations).toBe(1); expect(m.topClients[0].amount).toBe(120);
    expect(m.opportunities.map(c => c.id)).toEqual(["propuesta"]);
    expect(m.actions.some(a => a.id.includes("borrador"))).toBe(true);
  });
  test("la falta de una fuente impide declarar un total de operaciones completo", () => {
    const data = sources({ ventas_madera: [base("confirmada", { estado: "confirmada" })] }); data.alquileres = null;
    const m = buildGerencialModel(data, now); expect(m.operationsAmount).toBeNull(); expect(m.topClients).toEqual([]);
  });
  test("crédito entregado sigue revisándose, pago vinculado completo lo retira, pagos ajenos no lo cancelan", () => {
    const credit = base("credito", { modalidad_pago: "credito", fecha_pago_credito: "2026-10-01", estado_entrega: "entregado", total: 200 });
    const m = buildGerencialModel(sources({ ventas_mueble_terminado: [credit], movimientos_caja: [movement("pago", { modulo_origen: "ventas_muebles_terminados", referencia_id: "credito", monto: 50 }), movement("otro", { modulo_origen: "ventas_muebles_terminados", referencia_id: "otro", monto: 150 })] }), now);
    expect(m.actions.find(a => a.id.includes("credito:mueble"))?.amount).toBe(150);
    const paid = buildGerencialModel(sources({ ventas_mueble_terminado: [credit], movimientos_caja: [movement("pago", { modulo_origen: "ventas_muebles_terminados", referencia_id: "credito", monto: 200 })] }), now);
    expect(paid.actions).toEqual([]);
  });
  test("un contrato cerrado no significa crédito pagado; tarifa desconocida no sustituye su total", () => {
    const m = buildGerencialModel(sources({ alquileres: [base("cerrado", { estado: "cerrado", modalidad_pago: "credito", fecha_pago_credito: "2026-10-01", monto_total: null, tarifa: 500 })] }), now);
    expect(m.actions[0].amount).toBeNull(); expect(m.actions[0].amountLabel).toContain("Caja vinculada");
  });
  test("compromisos usan la fecha pactada, no la devolución; no inventan entrega de órdenes", () => {
    const m = buildGerencialModel(sources({ alquileres: [base("proximo", { activo: "Mixer", estado: "abierto", fecha_termino: "2026-10-10", fecha_fin: "2026-10-30", monto_total: null }), base("sinfecha", { activo: "Mixer", estado: "abierto", fecha_termino: "2026-02-31" })], ordenes_produccion: [base("orden", { estado: "en_produccion", fecha_aprobacion: "2026-10-03", cotizacion_unificada_id: "cotizacion" })] }), now);
    expect(m.upcoming[0].date).toBe("2026-10-10"); expect(m.upcoming[0].amount).toBeNull();
    expect(m.undated).toHaveLength(2); expect(m.actions.find(a => a.id === "orden:orden")?.date).toBeNull();
  });
  test("stock con movimiento reciente por unidad y costos faltantes explícitos", () => {
    const product = (id: string, unidad: string) => base(id, { activo: true, unidad, stock_actual: 2, stock_minimo: 3 });
    const m = buildGerencialModel(sources({ inventario_productos: [product("p1", "caja"), product("p2", "unidad")], inventario_movimientos: [base("s1", { producto_id: "p1", tipo: "salida_venta", cantidad: 4, costo_unitario: null }), base("s2", { producto_id: "p2", tipo: "salida_venta", cantidad: 8, costo_unitario: null }), base("antigua", { producto_id: "p1", tipo: "salida_venta", cantidad: 1000, fecha: "2026-04-01", costo_unitario: null })] }), now);
    expect(m.productGroups.map(g => g.unit)).toEqual(["caja", "unidad"]); expect(m.stockLow?.find(p => p.id === "p1")?.recent).toBe(4); expect(m.stockLow?.find(p => p.id === "p2")?.recent).toBe(8);
    expect(m.stockValues).toMatchObject({ valorRegistrado: null, productosSinCosto: 2 });
  });
  test("falta de Kardex no borra el stock conocido ni inventa consumo cero", () => {
    const data = sources({ inventario_productos: [base("p", { activo: true, unidad: "unidad", stock_actual: 0, stock_minimo: 2 })] }); data.inventario_movimientos = null;
    const m = buildGerencialModel(data, now); expect(m.stockLow?.[0].recent).toBeNull(); expect(m.stockLow).toHaveLength(1); expect(m.stockValues).toBeNull();
  });
});
