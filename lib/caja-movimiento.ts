export const CAJA_MONTO_MAXIMO = 9999999999.99; // Límite de numeric(12,2) en Caja.

/** Importe escrito sin símbolos ni separadores de miles, con hasta dos decimales. */
export function parseCajaMonto(value: unknown): number | null {
  if (typeof value !== "string" || !/^(?:\d+(?:[.,]\d{1,2})?|[.,]\d{1,2})$/.test(value.trim())) return null;
  const monto = Number(value.trim().replace(",", "."));
  return Number.isFinite(monto) && monto >= 0.01 && monto <= CAJA_MONTO_MAXIMO ? monto : null;
}

export function cajaFechaValida(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const fecha = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === value;
}

export function cajaFechaHoy(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
}
