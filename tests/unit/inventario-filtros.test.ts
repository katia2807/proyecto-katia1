import { describe, expect, test } from "vitest";
import { getInventarioConsultaHref, getInventarioFiltros, setInventarioFiltro } from "@/lib/inventario-filtros";

describe("Contexto de consulta de Inventario", () => {
  test("recupera juntos los filtros de Productos y Kardex al abrir de nuevo el enlace", () => {
    const params = new URLSearchParams({
      buscar: "Tornillo & cedro #2 / 50%",
      categoria: "Barnices y Químicos",
      estado: "stock_bajo",
      stock_min: "0",
      stock_max: "12.5",
      perspectiva: "galeria",
      kardex_tipo: "salida_venta",
      kardex_producto: "producto-1",
    });
    expect(getInventarioFiltros(new URLSearchParams(params.toString()))).toEqual({
      buscar: "Tornillo & cedro #2 / 50%", categoria: "Barnices y Químicos", estado: "stock_bajo",
      stockMin: "0", stockMax: "12.5", perspectiva: "galeria",
      kardexTipo: "salida_venta", kardexProducto: "producto-1",
      kardexFilas: 200, kardexPagina: "1", productosFilas: 20,
    });
  });

  test("cambiar o limpiar un filtro conserva los demás y la operación rápida abierta", () => {
    const initial = new URLSearchParams("tab=productos&quick=compra&producto_id=p1&buscar=Tornillo&categoria=Madera&estado=activos&stock_min=0&kardex_tipo=ajuste");
    const changed = setInventarioFiltro(initial, "stock_max", "50");
    const cleared = setInventarioFiltro(changed, "buscar", "");
    expect(cleared.get("buscar")).toBeNull();
    expect(cleared.get("stock_max")).toBe("50");
    for (const key of ["tab", "quick", "producto_id", "categoria", "estado", "stock_min", "kardex_tipo"]) {
      expect(cleared.get(key)).toBe(initial.get(key));
    }
    expect(initial.get("stock_max")).toBeNull();
    expect(initial.get("buscar")).toBe("Tornillo");
  });

  test("volver a los valores iniciales elimina solo sus parámetros, incluidas referencias repetidas", () => {
    let params = new URLSearchParams("tab=kardex&categoria=Madera&estado=activos&perspectiva=galeria&kardex_tipo=ajuste&kardex_producto=p1&buscar=a&buscar=b");
    params = setInventarioFiltro(params, "categoria", "todas");
    params = setInventarioFiltro(params, "estado", "todos");
    params = setInventarioFiltro(params, "perspectiva", "texto");
    params = setInventarioFiltro(params, "kardex_tipo", "todos");
    params = setInventarioFiltro(params, "kardex_producto", "todos");
    params = setInventarioFiltro(params, "buscar", "");
    expect(params.toString()).toBe("tab=kardex");
  });

  test("un enlace sin filtros mantiene la consulta inicial", () => {
    expect(getInventarioFiltros(new URLSearchParams())).toEqual({
      buscar: "", categoria: "todas", estado: "todos", stockMin: "", stockMax: "",
      perspectiva: "texto", kardexTipo: "todos", kardexProducto: "todos",
      kardexFilas: 200, kardexPagina: "1", productosFilas: 20,
    });
  });

  test("un estado, perspectiva o tipo desconocido no aplica un filtro oculto", () => {
    const filters = getInventarioFiltros(new URLSearchParams("estado=otro&perspectiva=otra&kardex_tipo=borrado"));
    expect(filters.estado).toBe("todos");
    expect(filters.perspectiva).toBe("texto");
    expect(filters.kardexTipo).toBe("todos");
  });

  test.each(["NaN", "Infinity", "abc", " "])("descarta un límite de stock inválido: %s", value => {
    const filters = getInventarioFiltros(new URLSearchParams({ stock_min: value, stock_max: value }));
    expect(filters.stockMin).toBe("");
    expect(filters.stockMax).toBe("");
  });

  test("cero y límites decimales o negativos siguen siendo filtros válidos", () => {
    const filters = getInventarioFiltros(new URLSearchParams("stock_min=-2.5&stock_max=0"));
    expect(filters.stockMin).toBe("-2.5");
    expect(filters.stockMax).toBe("0");
  });

  test("cerrar compra conserva la pestaña y la consulta, pero no reabre la operación", () => {
    const params = new URLSearchParams("tab=productos&buscar=Tornillo&categoria=Madera&perspectiva=galeria&quick=compra&producto_id=p1");
    const href = getInventarioConsultaHref(params);
    expect(href).toBe("/inventario?tab=productos&buscar=Tornillo&categoria=Madera&perspectiva=galeria");
    expect(params.get("quick")).toBe("compra");
    expect(getInventarioConsultaHref(new URLSearchParams("quick=producto&producto_id=p1"))).toBe("/inventario");
  });
});
