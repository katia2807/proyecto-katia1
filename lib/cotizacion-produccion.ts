const fases: Record<string, string> = { en_produccion: 'producción', terminado: 'terminado', entregado: 'entregado' };

/** La orden gobierna la fase de taller; su entrega nunca acredita un pago. */
export function presentacionCotizacionProduccion(estado: string, fase?: string | null) {
  const etiquetas: Record<string, string> = { pendiente: 'pendiente', lista_produccion: 'lista prod.', en_produccion: 'producción' };
  const faseValida = fase ? fases[fase] : undefined;
  const usaFase = Boolean(faseValida && ['lista_produccion', 'en_produccion', 'terminado', 'entregado'].includes(estado));
  return { estado: usaFase ? faseValida! : etiquetas[estado] ?? estado, produccion: !usaFase && faseValida ? `Orden: ${faseValida}` : null };
}

export function cotizacionUnificadaAprobable(estado: string, tieneOrden: boolean) {
  return !tieneOrden && ['lista_produccion', 'en_produccion', 'cobrada'].includes(estado);
}
