import type { InventarioKardexTipoFiltro } from "@/lib/inventario-filtros";

export const INVENTARIO_KARDEX_VISIBLE_LIMIT = 200;

/** Un conteo ausente o distinto no permite presentar los registros cargados como un historial completo. */
export function getInventarioHistorialAviso(cargados: number, total: number | null): string | null {
  if (total === cargados) return null;
  if (total === null || total < cargados) {
    return `No se pudo comprobar si el historial está completo. Los indicadores y las exportaciones usan los ${cargados} movimientos cargados.`;
  }
  return `Historial parcial: se cargaron ${cargados} de ${total} movimientos. Los indicadores y las exportaciones usan esos registros.`;
}

export function filtrarInventarioKardex<T extends { tipo: string; producto_id: string }>(
  rows: T[], tipo: InventarioKardexTipoFiltro, productoId: string,
): T[] {
  return rows.filter(row => (tipo === "todos" || row.tipo === tipo) &&
    (productoId === "todos" || row.producto_id === productoId));
}

export function getInventarioKardexExportHref(tipo: InventarioKardexTipoFiltro, productoId: string): string {
  const params = new URLSearchParams({ type: "kardex" });
  if (tipo !== "todos") params.set("kardex_tipo", tipo);
  if (productoId !== "todos") params.set("kardex_producto", productoId);
  return `/inventario/export?${params}`;
}
