import { afterEach, describe, expect, test, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getInventarioResumenValores, type InventarioProductoResumen, type InventarioMovimientoResumen } from "@/lib/inventario-resumen";
import { InventarioResumenValores } from "@/components/inventario/inventario-resumen-valores";

const ahora = new Date("2026-10-06T15:00:00Z");
const producto = (patch: Partial<InventarioProductoResumen> = {}): InventarioProductoResumen => ({
  activo: true, unidad: "unidad", stock_actual: 2, costo_unitario_promedio: 50, valor_stock: 100, ...patch,
});
const salida = (patch: Partial<InventarioMovimientoResumen> = {}): InventarioMovimientoResumen => ({
  fecha: "2026-10-06", tipo: "salida_venta", cantidad: 2, costo_unitario: 50, ...patch,
});

afterEach(() => vi.useRealTimers());

describe("Inventario: resumen con unidades y valores registrados", () => {
  test("separa cajas, latas y unidades, y excluye productos inactivos", () => {
    const result = getInventarioResumenValores([
      producto({ stock_actual: 42 }), producto({ stock_actual: 10, unidad: " Unidad " }),
      producto({ stock_actual: 8, unidad: "caja" }), producto({ stock_actual: 3, unidad: "lata" }),
      producto({ stock_actual: 999, activo: false }),
    ], [], ahora);
    expect(result.stockPorUnidad).toEqual([
      { unidad: "caja", cantidad: 8 }, { unidad: "lata", cantidad: 3 }, { unidad: "unidad", cantidad: 52 },
    ]);
  });

  test("conserva cantidades fraccionadas y no convierte PT a m3 ni supone una unidad ausente", () => {
    const result = getInventarioResumenValores([
      producto({ unidad: "PT", stock_actual: 1.25 }), producto({ unidad: "PT", stock_actual: 0.5 }),
      producto({ unidad: "m3", stock_actual: 0.12 }), producto({ unidad: null, stock_actual: 2 }),
    ], [], ahora);
    expect(result.stockPorUnidad).toEqual([
      { unidad: "m3", cantidad: 0.12 }, { unidad: "pt", cantidad: 1.75 }, { unidad: "Sin unidad", cantidad: 2 },
    ]);
  });

  test("un stock sin compras con costo tiene valor desconocido, aunque el producto guarde un costo aislado", () => {
    const conCostoAislado = { ...producto({ costo_unitario_promedio: 0, valor_stock: 0 }), costo_unitario: 250 };
    const result = getInventarioResumenValores([conCostoAislado], [], ahora);
    expect(result.valorRegistrado).toBeNull();
    expect(result.productosSinCosto).toBe(1);
  });

  test("un valor parcial incluye sólo productos activos con costo, y no penaliza productos sin stock", () => {
    const result = getInventarioResumenValores([
      producto(), producto({ stock_actual: 3, costo_unitario_promedio: 0, valor_stock: 0 }),
      producto({ stock_actual: 0, costo_unitario_promedio: 0, valor_stock: 0 }),
      producto({ activo: false, valor_stock: 999 }),
    ], [], ahora);
    expect(result.valorRegistrado).toBe(100);
    expect(result.productosSinCosto).toBe(1);
  });

  test("un inventario vacío o sin stock vale cero, distinto de un valor desconocido", () => {
    expect(getInventarioResumenValores([], [], ahora)).toMatchObject({ stockPorUnidad: [], valorRegistrado: 0, productosSinCosto: 0 });
    expect(getInventarioResumenValores([producto({ stock_actual: 0, costo_unitario_promedio: 0, valor_stock: 0 })], [], ahora))
      .toMatchObject({ valorRegistrado: 0, productosSinCosto: 0 });
  });

  test("el costo mensual suma sólo salidas de venta del mes, separando el costo omitido del cero explícito", () => {
    const result = getInventarioResumenValores([], [
      salida(), salida({ costo_unitario: null }), salida({ costo_unitario: 0 }),
      salida({ fecha: "2026-09-30" }), salida({ tipo: "entrada_compra" }), salida({ tipo: "ajuste" }),
    ], ahora);
    expect(result).toMatchObject({ costoSalidas: 100, salidasSinCosto: 1, totalSalidas: 3 });
    expect(getInventarioResumenValores([], [salida({ costo_unitario: null })], ahora).costoSalidas).toBeNull();
    expect(getInventarioResumenValores([], [salida({ costo_unitario: 0 })], ahora).costoSalidas).toBe(0);
  });

  test("el mes sigue el calendario de Perú al cambiar el día en UTC", () => {
    const result = getInventarioResumenValores([], [salida({ fecha: "2026-09-30", cantidad: 3 }), salida({ fecha: "2026-10-01" })],
      new Date("2026-10-01T02:00:00Z"));
    expect(result).toMatchObject({ costoSalidas: 150, totalSalidas: 1 });
  });

  test("el resumen no modifica productos ni movimientos", () => {
    const productos = [producto({ unidad: " CAJA " })];
    const movimientos = [salida()];
    const before = structuredClone({ productos, movimientos });
    getInventarioResumenValores(productos, movimientos, ahora);
    expect({ productos, movimientos }).toEqual(before);
  });

  test("las tarjetas señalan importes parciales y no presentan costos como ganancias", () => {
    vi.useFakeTimers(); vi.setSystemTime(ahora);
    const html = renderToStaticMarkup(createElement(InventarioResumenValores, {
      productos: [producto(), producto({ costo_unitario_promedio: 0, valor_stock: 0 })],
      movimientos: [salida(), salida({ costo_unitario: null })],
    }));
    expect(html).toContain("Stock por unidad");
    expect(html).toContain("Valor parcial:");
    expect(html).toContain("Costo parcial:");
    expect(html).toContain("No es ganancia.");
    expect(html).not.toContain("Ganancias del mes");
    expect(html).not.toContain("Unidades acumuladas");
  });

  test("las tarjetas muestran ausencia de costos sin presentarla como S/ 0.00", () => {
    vi.useFakeTimers(); vi.setSystemTime(ahora);
    const html = renderToStaticMarkup(createElement(InventarioResumenValores, {
      productos: [producto({ costo_unitario_promedio: 0, valor_stock: 0 })], movimientos: [salida({ costo_unitario: null })],
    }));
    expect(html).toContain("Sin costo en compras");
    expect(html).toContain("Sin costo registrado");
    expect(html).not.toContain("0.00");
  });
});
