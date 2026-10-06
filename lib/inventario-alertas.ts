import { fechaHoyPeru } from "@/lib/utils";

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
