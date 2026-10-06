import { describe, expect, test } from "vitest";
import { buildCajaHref, cajaComprobante, cajaFiltrosError, cajaTieneFiltros, crearFiltroCaja, normalizeCajaFiltros } from "@/lib/caja-filtros";
import type { CajaMovimientoBuscable } from "@/lib/caja-filtros";

const row: CajaMovimientoBuscable = {
  fecha: "2026-04-30", tipo: "ingreso", medio: "yape", categoria: "venta_madera",
  descripcion: "Venta a José Pérez — anticipo de mesa", modulo_origen: "ventas_madera_cortada",
  referencia_id: "referencia-123", tipo_comprobante: "factura", url_comprobante: null,
};

describe("Caja: búsqueda y filtros", () => {
  test("normaliza parámetros duplicados, espacios, valores desconocidos y páginas inválidas", () => {
    const filtros = normalizeCajaFiltros({ buscar: ["  José   Pérez  ", "otro"], tipo: "desconocido", medio: "tarjeta", comprobante: "xxx", pagina: "-5" });
    expect(filtros).toEqual({ buscar: "José Pérez", desde: "", hasta: "", tipo: "todos", medio: "todos", comprobante: "todos", pagina: 1 });
    expect(normalizeCajaFiltros({ buscar: "x".repeat(200), pagina: "1e100" }).buscar).toHaveLength(160);
    expect(normalizeCajaFiltros({ pagina: "1e100" }).pagina).toBe(1);
    expect(normalizeCajaFiltros({ pagina: "2" }).pagina).toBe(2);
  });

  test("busca palabras sin distinguir acentos, mayúsculas ni separadores del concepto", () => {
    expect(crearFiltroCaja(normalizeCajaFiltros({ buscar: "PEREZ JOSE mesa" }))(row)).toBe(true);
    expect(crearFiltroCaja(normalizeCajaFiltros({ buscar: "venta madera" }))(row)).toBe(true);
    expect(crearFiltroCaja(normalizeCajaFiltros({ buscar: "referencia-123" }))(row)).toBe(true);
    expect(crearFiltroCaja(normalizeCajaFiltros({ buscar: "José inexistente" }))(row)).toBe(false);
    expect(crearFiltroCaja(normalizeCajaFiltros({ buscar: "%.*" }))(row)).toBe(false);
  });

  test("combina búsqueda, fechas inclusivas, tipo, medio y comprobante", () => {
    const filtros = normalizeCajaFiltros({ buscar: "José", desde: "2026-04-30", hasta: "2026-04-30", tipo: "ingreso", medio: "yape", comprobante: "factura" });
    const coincide = crearFiltroCaja(filtros);
    expect(coincide(row)).toBe(true);
    for (const cambio of [{ fecha: "2026-04-29" }, { fecha: "2026-05-01" }, { tipo: "egreso" }, { medio: "banco" }, { tipo_comprobante: "boleta" }]) expect(coincide({ ...row, ...cambio })).toBe(false);
    expect(crearFiltroCaja(normalizeCajaFiltros({ desde: "2026-04-30" }))(row)).toBe(true);
    expect(crearFiltroCaja(normalizeCajaFiltros({ hasta: "2026-04-30" }))(row)).toBe(true);
  });

  test("encuentra los nombres visibles sin perder la búsqueda por códigos anteriores", () => {
    const sinDescripcion = { ...row, descripcion: null };
    for (const buscar of ["Venta de madera", "Ventas de madera cortada", "venta_madera", "ventas_madera_cortada"]) {
      expect(crearFiltroCaja(normalizeCajaFiltros({ buscar }))(sinDescripcion)).toBe(true);
    }
    expect(crearFiltroCaja(normalizeCajaFiltros({ buscar: "Venta de mueble terminado" }))(sinDescripcion)).toBe(false);
    expect(crearFiltroCaja(normalizeCajaFiltros({ buscar: "Registro manual de Caja" }))({ ...sinDescripcion, modulo_origen: null })).toBe(true);
    expect(crearFiltroCaja(normalizeCajaFiltros({ buscar: "Reparación puerta José" }))({ ...sinDescripcion, categoria: "Reparación_puerta_José", modulo_origen: "caja" })).toBe(true);
  });

  test.each(["2026-02-30", "2026-13-01", "04/10/2026", "invalida"])("rechaza la fecha inválida %s sin buscar todo el historial por accidente", desde => {
    const filtros = normalizeCajaFiltros({ desde });
    expect(cajaFiltrosError(filtros)).toContain("fecha válida");
    expect(crearFiltroCaja(filtros)(row)).toBe(false);
  });

  test("avisa de fechas invertidas y acepta días de calendario válidos", () => {
    const invertido = normalizeCajaFiltros({ desde: "2026-05-01", hasta: "2026-04-30" });
    expect(cajaFiltrosError(invertido)).toContain("anterior o igual");
    expect(crearFiltroCaja(invertido)(row)).toBe(false);
    expect(cajaFiltrosError(normalizeCajaFiltros({ desde: "2024-02-29" }))).toBeNull();
    expect(cajaFiltrosError(normalizeCajaFiltros())).toBeNull();
  });

  test("la clasificación del comprobante coincide con lo mostrado, incluidos registros antiguos", () => {
    expect(cajaComprobante(row)).toBe("factura");
    expect(cajaComprobante({ ...row, tipo_comprobante: null, descripcion: "Boleta B001-123" })).toBe("boleta");
    expect(cajaComprobante({ ...row, tipo_comprobante: null, descripcion: "Recibo R001-123" })).toBe("recibo");
    expect(cajaComprobante({ ...row, tipo_comprobante: null, url_comprobante: "/comprobante.pdf" })).toBe("adjunto");
    expect(cajaComprobante({ ...row, tipo_comprobante: null, descripcion: null })).toBe("ninguno");
    expect(crearFiltroCaja(normalizeCajaFiltros({ comprobante: "ninguno" }))({ ...row, tipo_comprobante: null, url_comprobante: "/comprobante.pdf" })).toBe(false);
  });

  test("conserva todos los filtros en enlaces de vistas y páginas, codificando caracteres especiales", () => {
    const filtros = normalizeCajaFiltros({ buscar: "José & Pérez #1", desde: "2026-04-01", hasta: "2026-04-30", tipo: "egreso", medio: "otro", comprobante: "recibo", pagina: "9" });
    const url = new URL(buildCajaHref("personal", filtros, 2), "https://katia.local");
    expect(url.pathname).toBe("/caja");
    expect(url.hash).toBe("#movimientos-caja");
    expect(Object.fromEntries(url.searchParams)).toEqual({ vista: "personal", buscar: "José & Pérez #1", desde: "2026-04-01", hasta: "2026-04-30", tipo: "egreso", medio: "otro", comprobante: "recibo", pagina: "2" });
    expect(new URL(buildCajaHref("empresa", filtros), "https://katia.local").searchParams.has("pagina")).toBe(false);
    expect(buildCajaHref("empresa", normalizeCajaFiltros())).toBe("/caja?vista=empresa#movimientos-caja");
    expect(buildCajaHref("todos", normalizeCajaFiltros())).toBe("/caja#movimientos-caja");
  });

  test("una página distinta no se confunde con un filtro activo", () => {
    expect(cajaTieneFiltros(normalizeCajaFiltros({ pagina: "2" }))).toBe(false);
    expect(cajaTieneFiltros(normalizeCajaFiltros({ buscar: "José" }))).toBe(true);
    expect(cajaTieneFiltros(normalizeCajaFiltros({ comprobante: "boleta" }))).toBe(true);
  });
});
