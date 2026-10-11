type Movimiento = {
  organization_id: string; referencia_id: string | null; modulo_origen: string | null;
  categoria: string; tipo: string; monto: number; es_personal?: boolean;
  voided_at?: string | null; deleted_at?: string | null;
};
type Orden = { id: string; organization_id: string; cotizacion_id: string | null; cotizacion_unificada_id: string | null };

/** Solo cuenta dinero vinculado, nunca el adelanto previsto en las condiciones. */
export function resumenCobroLocal(total: number, id: string, org: string, caja: readonly Movimiento[], ordenes: readonly Orden[], unificada = true) {
  const referencias = new Set([id, ...ordenes.filter(o => o.organization_id === org &&
    (unificada ? o.cotizacion_unificada_id : o.cotizacion_id) === id).map(o => o.id)]);
  let centavos = 0;
  for (const m of caja) {
    if (m.organization_id !== org || m.voided_at || m.deleted_at || m.es_personal) continue;
    const directo = m.referencia_id === id && m.modulo_origen === (unificada ? "cotizacion_unificada" : "muebles_corte");
    const adelanto = m.modulo_origen === "ventas" && m.categoria === "adelanto_mueble_personalizado" &&
      m.referencia_id !== null && referencias.has(m.referencia_id);
    if (!directo && !adelanto) continue;
    if (!Number.isFinite(m.monto) || m.monto < 0) throw new Error("Revisa los importes vinculados a la cotización.");
    const monto = Math.round(m.monto * 100);
    centavos += m.tipo === "ingreso" ? monto : m.tipo === "egreso" ? -monto : 0;
  }
  const totalCentavos = Math.round(total * 100);
  if (!Number.isSafeInteger(totalCentavos) || totalCentavos <= 0 || !Number.isSafeInteger(centavos) || centavos < 0 || centavos > totalCentavos) {
    throw new Error("Revisa los cobros vinculados a esta cotización antes de continuar.");
  }
  return { total, cobrado: centavos / 100, saldo: (totalCentavos - centavos) / 100 };
}
