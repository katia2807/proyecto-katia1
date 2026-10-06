import { describe, expect, test } from "vitest";
import { filtrarInventarioKardex, getInventarioHistorialAviso, getInventarioKardexExportHref } from "@/lib/inventario-historial";
import { getInventarioFiltros } from "@/lib/inventario-filtros";
import { getInventarioAlertasMovimiento, getInventarioDiasSinMovimiento } from "@/lib/inventario-alertas";

describe("Alcance y exportación de Kardex", () => {
  test("solo un conteo coincidente confirma el historial, incluso vacío", () => {
    expect(getInventarioHistorialAviso(0, 0)).toBeNull();
    expect(getInventarioHistorialAviso(215, 215)).toBeNull();
    expect(getInventarioHistorialAviso(1000, 5200)).toContain("1000 de 5200");
    expect(getInventarioHistorialAviso(1000, 5200)).toContain("Historial parcial");
    expect(getInventarioHistorialAviso(0, null)).toContain("No se pudo comprobar");
    expect(getInventarioHistorialAviso(10, 8)).toContain("No se pudo comprobar");
  });

  test("el enlace de exportación transmite los mismos filtros sin perder caracteres", () => {
    const url = new URL(getInventarioKardexExportHref("salida_venta", "id & #1"), "https://katia.local");
    const filters = getInventarioFiltros(url.searchParams);
    const rows = [
      { id: "1", tipo: "salida_venta", producto_id: "id & #1" },
      { id: "2", tipo: "entrada_compra", producto_id: "id & #1" },
      { id: "3", tipo: "salida_venta", producto_id: "otro" },
    ];
    expect(url.searchParams.get("type")).toBe("kardex");
    expect(filtrarInventarioKardex(rows, filters.kardexTipo, filters.kardexProducto)).toEqual([rows[0]]);
    expect(rows).toHaveLength(3);
    expect(getInventarioKardexExportHref("todos", "todos")).toBe("/inventario/export?type=kardex");
    expect(filtrarInventarioKardex(rows, "todos", "todos")).toEqual(rows);
    expect(filtrarInventarioKardex(rows, "ajuste", "todos")).toEqual([]);
  });
});

describe("Inactividad comprobada y ausencia de movimientos", () => {
  test("un producto sin movimientos no cuenta como inactivo por 30 días", () => {
    const rows = [
      { id: "nuevo", activo: true, dias_sin_movimiento: null, ultimo_movimiento: null },
      { id: "30", activo: true, dias_sin_movimiento: 30, ultimo_movimiento: "2026-09-06" },
      { id: "29", activo: true, dias_sin_movimiento: 29, ultimo_movimiento: "2026-09-07" },
      { id: "baja", activo: false, dias_sin_movimiento: 100, ultimo_movimiento: "2026-06-28" },
      { id: "baja-sin-historial", activo: false, dias_sin_movimiento: null, ultimo_movimiento: null },
    ];
    const result = getInventarioAlertasMovimiento(rows);
    expect(result.sinMovimiento.map(p => p.id)).toEqual(["30"]);
    expect(result.sinMovimientosRegistrados.map(p => p.id)).toEqual(["nuevo"]);
    expect(rows).toHaveLength(5);
  });

  test("el umbral de 30 días sigue el calendario de Perú por la noche", () => {
    expect(getInventarioDiasSinMovimiento("2026-09-06", new Date("2026-10-06T02:00:00Z"))).toBe(29);
    expect(getInventarioDiasSinMovimiento("2026-09-06", new Date("2026-10-06T05:00:00Z"))).toBe(30);
    expect(getInventarioDiasSinMovimiento("2026-09-06", new Date("2026-10-06T23:00:00Z"))).toBe(30);
  });

  test.each([null, "", "fecha", "2026-02-30"])("no inventa días para una fecha ausente o inválida: %s", fecha => {
    expect(getInventarioDiasSinMovimiento(fecha, new Date("2026-10-06T15:00:00Z"))).toBeNull();
  });

  test("una fecha futura no produce una antigüedad negativa", () => {
    expect(getInventarioDiasSinMovimiento("2026-10-07", new Date("2026-10-06T15:00:00Z"))).toBe(0);
  });
});
