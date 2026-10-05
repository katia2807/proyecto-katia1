import { describe, expect, test } from "vitest";
import { buildHistorialHref, normalizeHistorialPaginas, safeHistorialHref, withHistorialReturn } from "@/lib/ventas-historial-navigation";

describe("Regreso al historial de ventas", () => {
  test("conserva búsquedas con acentos y caracteres de una URL sin romper el enlace", () => {
    const busqueda = "José & Hijos #2 / 50%";
    const historial = buildHistorialHref("madera", busqueda);
    const detalle = new URL(withHistorialReturn("/ventas/detalle/venta-madera/123", historial), "https://katia.local");
    const regreso = safeHistorialHref(detalle.searchParams.get("volver") ?? undefined);
    const url = new URL(regreso, "https://katia.local");
    expect(url.searchParams.get("buscar")).toBe(busqueda);
    expect(url.searchParams.get("categoria")).toBe("madera");
    expect(url.hash).toBe("#historial-ventas");
  });

  test.each(["https://otro.test/ventas", "//otro.test/ventas", "/ventas/clientes", "/ventas/../admin/usuarios", "javascript:alert(1)"])(
    "descarta destinos externos o fuera del historial: %s", (destino) => {
      expect(safeHistorialHref(destino)).toBe("/ventas#historial-ventas");
    },
  );

  test("normaliza categorías desconocidas y referencias duplicadas", () => {
    expect(safeHistorialHref("/ventas?categoria=invalida&buscar=Carlos&extra=1#historial-ventas#historial-ventas"))
      .toBe("/ventas?buscar=Carlos#historial-ventas");
  });

  test("completar datos conserva su modo y reemplaza el contexto de regreso anterior", () => {
    const url = new URL(withHistorialReturn("/ventas/alquiler-mixer/123/editar?desde=detalle&volver=antiguo", buildHistorialHref("alquileres", "Mixer")), "https://katia.local");
    expect(url.searchParams.get("desde")).toBe("detalle");
    expect(url.searchParams.getAll("volver")).toHaveLength(1);
    expect(url.searchParams.get("volver")).toBe("/ventas?categoria=alquileres&buscar=Mixer#historial-ventas");
  });

  test("volver desde un detalle conserva la cantidad de historial consultada y sus filtros", () => {
    const href = buildHistorialHref("alquileres", "Mixer", 4);
    expect(safeHistorialHref(href)).toBe("/ventas?categoria=alquileres&buscar=Mixer&historial=4#historial-ventas");
    const detalle = new URL(withHistorialReturn("/ventas/detalle/alquiler/123", href), "https://katia.local");
    expect(detalle.searchParams.get("volver")).toBe(href);
  });

  test.each([undefined, null, "", "0", "-1", "1.5", "NaN", "Infinity", "9007199254740991"])("descarta cantidades de historial inválidas: %s", value => {
    expect(normalizeHistorialPaginas(value)).toBe(1);
  });
});
