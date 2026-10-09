export const LISTADO_TAMANOS = [20, 50, 100, 200] as const;

export function listadoTamano(value: unknown, fallback = 50): number {
  const size = Number(value);
  return LISTADO_TAMANOS.some(n => n === size) ? size : fallback;
}

export function listadoPagina(value: unknown, total: number, size: number): number {
  const page = Number(value);
  const valid = Number.isSafeInteger(page) && page > 0 ? page : 1;
  return Math.min(valid, Math.max(1, Math.ceil(total / size)));
}
