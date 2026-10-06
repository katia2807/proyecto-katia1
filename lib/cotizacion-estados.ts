export const COTIZACION_ESTADOS = {
  pendiente: "Pendiente",
  lista_produccion: "Cotización aceptada",
  en_produccion: "En producción",
  terminado: "Terminado",
  entregado: "Entregado",
  cobrada: "Cobrada",
  inactivo: "Inactivo",
  deudor: "Deudor (Mora)",
} as const;

export type CotizacionEstado = keyof typeof COTIZACION_ESTADOS;

export function etiquetaEstadoCotizacion(estado: string): string {
  return COTIZACION_ESTADOS[estado as CotizacionEstado] ?? estado;
}

export function coincideEstadoCotizacion(estado: string, filtro: string): boolean {
  return filtro === "todos" || estado === filtro;
}
