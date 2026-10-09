import { listadoTamano } from "@/lib/listado-paginacion";

export type InventarioEstadoFiltro = "todos" | "activos" | "inactivos" | "stock_bajo";
export type InventarioKardexTipoFiltro = "todos" | "entrada_compra" | "salida_venta" | "ajuste";

const FILTROS_DEFAULT = {
  buscar: "",
  categoria: "todas",
  estado: "todos",
  stock_min: "",
  stock_max: "",
  perspectiva: "texto",
  kardex_tipo: "todos",
  kardex_producto: "todos",
  kardex_filas: "200",
  kardex_pagina: "1",
  productos_filas: "20",
} as const;

export type InventarioFiltroParam = keyof typeof FILTROS_DEFAULT;

function stockParam(value: string | null): string {
  if (!value?.trim() || !Number.isFinite(Number(value))) return "";
  return value.trim();
}

/** La URL es el contexto de consulta; los valores desconocidos no crean filtros invisibles. */
export function getInventarioFiltros(params: Pick<URLSearchParams, "get">) {
  const estado = params.get("estado");
  const tipo = params.get("kardex_tipo");
  return {
    buscar: params.get("buscar") ?? "",
    categoria: params.get("categoria") || "todas",
    estado: (["activos", "inactivos", "stock_bajo"].includes(estado ?? "")
      ? estado : "todos") as InventarioEstadoFiltro,
    stockMin: stockParam(params.get("stock_min")),
    stockMax: stockParam(params.get("stock_max")),
    perspectiva: params.get("perspectiva") === "galeria" ? "galeria" : "texto",
    kardexTipo: (["entrada_compra", "salida_venta", "ajuste"].includes(tipo ?? "")
      ? tipo : "todos") as InventarioKardexTipoFiltro,
    kardexProducto: params.get("kardex_producto") || "todos",
    kardexFilas: listadoTamano(params.get("kardex_filas"), 200),
    kardexPagina: params.get("kardex_pagina") ?? "1",
    productosFilas: listadoTamano(params.get("productos_filas"), 20),
  };
}

/** Cambia solo un filtro, conservando la pestaña, las operaciones rápidas y el resto de la consulta. */
export function setInventarioFiltro(
  params: Pick<URLSearchParams, "toString">,
  key: InventarioFiltroParam,
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  if (["kardex_tipo", "kardex_producto", "kardex_filas"].includes(key)) next.delete("kardex_pagina");
  if (value === "" || value === FILTROS_DEFAULT[key]) next.delete(key);
  else next.set(key, value);
  return next;
}

/** Cerrar un formulario vuelve a la misma consulta, sin reabrir la operación rápida. */
export function getInventarioConsultaHref(params: Pick<URLSearchParams, "toString">): string {
  const next = new URLSearchParams(params.toString());
  next.delete("quick");
  next.delete("producto_id");
  const query = next.toString();
  return query ? `/inventario?${query}` : "/inventario";
}
