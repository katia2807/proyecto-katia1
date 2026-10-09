import { fechaHoyPeru } from "@/lib/utils";

export function getInventarioEstadoStock(actual: number, minimo: number) {
  if (actual <= 0) return { nivel: "agotado", label: "Sin existencias", className: "border-red-300 bg-red-50 text-red-900 dark:border-red-400/40 dark:bg-red-950/40 dark:text-red-200" };
  if (actual <= minimo) return { nivel: "bajo", label: "Stock bajo", className: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-200" };
  return { nivel: "normal", label: "Stock disponible", className: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-950/40 dark:text-emerald-200" };
}

/** Compara días de calendario de Perú; un historial ausente no tiene una antigüedad inventada. */
export function getInventarioDiasSinMovimiento(fecha: string | null, ahora = new Date()): number | null {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const fechaMs = Date.parse(fecha);
  if (!Number.isFinite(fechaMs) || new Date(fechaMs).toISOString().slice(0, 10) !== fecha) return null;
  const hoyMs = Date.parse(fechaHoyPeru(ahora));
  return Math.max(0, Math.floor((hoyMs - fechaMs) / 86_400_000));
}

export function getInventarioAlertasMovimiento<T extends {
  activo: boolean; dias_sin_movimiento: number | null; ultimo_movimiento: string | null;
}>(productos: T[]) {
  return {
    sinMovimiento: productos.filter(p => p.activo !== false && p.dias_sin_movimiento !== null && p.dias_sin_movimiento >= 30),
    sinMovimientosRegistrados: productos.filter(p => p.activo !== false && p.ultimo_movimiento === null),
  };
}
