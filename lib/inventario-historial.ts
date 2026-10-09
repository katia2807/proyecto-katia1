import type { InventarioKardexTipoFiltro } from "@/lib/inventario-filtros";
import { formatDate } from "@/lib/utils";

export function inventarioRegistroFechaHora(value: string | null | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) return "Sin hora registrada";
  return formatDate(value, {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
}

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
