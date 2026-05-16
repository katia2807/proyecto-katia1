/**
 * Sugerencia inteligente de precios basada en historial de ventas.
 * Regla del plan:
 * - Solo mostrar si hay >= 3 ventas anteriores del mismo producto.
 * - Si no hay historial suficiente, NO mostrar nada.
 * - El input siempre vacío o con precio base, nunca prellenar con sugerencia.
 * - El cliente tiene control total; la sugerencia es un HINT, no un valor.
 */

export type HistorialVenta = {
  producto_id: string;
  precio_cobrado: number;
  fecha: string;
};

export type SugerenciaPrecio = {
  promedio: number;
  ultimoPrecio: number;
  cantidadVentas: number;
  mostrar: boolean;
};

const MIN_VENTAS_PARA_SUGERIR = 3;

/**
 * Calcula la sugerencia de precio para un producto basado en su historial.
 * Retorna `{ mostrar: false }` si no hay suficiente historial.
 */
export function calcularSugerenciaPrecio(
  productoId: string,
  historial: HistorialVenta[],
): SugerenciaPrecio {
  const ventasProducto = historial
    .filter((v) => v.producto_id === productoId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  if (ventasProducto.length < MIN_VENTAS_PARA_SUGERIR) {
    return { promedio: 0, ultimoPrecio: 0, cantidadVentas: ventasProducto.length, mostrar: false };
  }

  const ultimas5 = ventasProducto.slice(0, 5);
  const promedio = ultimas5.reduce((acc, v) => acc + v.precio_cobrado, 0) / ultimas5.length;
  const ultimoPrecio = ventasProducto[0]!.precio_cobrado;

  return {
    promedio: Math.round(promedio * 100) / 100,
    ultimoPrecio,
    cantidadVentas: ventasProducto.length,
    mostrar: true,
  };
}

/**
 * Formatea la sugerencia como texto corto para mostrar en UI.
 * Ejemplo: "Sugerencia: S/120.00 (prom. 5 ventas) · Último: S/125.00"
 */
export function formatearSugerencia(sugerencia: SugerenciaPrecio, currency = "S/"): string {
  if (!sugerencia.mostrar) return "";
  return `Sugerencia: ${currency}${sugerencia.promedio.toFixed(2)} (prom. ${Math.min(sugerencia.cantidadVentas, 5)} ventas) · Último: ${currency}${sugerencia.ultimoPrecio.toFixed(2)}`;
}
