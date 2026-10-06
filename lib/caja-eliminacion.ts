type CajaEstadoEliminacion = {
  periodo_cerrado: boolean;
  modulo_origen: string | null;
  referencia_id: string | null;
};

/** La misma regla se usa en el historial y antes de cualquier eliminación. */
export function cajaEliminacionBloqueo(row: CajaEstadoEliminacion): string | null {
  if (row.periodo_cerrado) {
    return "Este movimiento pertenece a un período cerrado y no se puede eliminar.";
  }
  if (row.referencia_id !== null || (row.modulo_origen !== null && row.modulo_origen !== "caja")) {
    return "Este movimiento viene de otra operación. Revísala desde su origen para corregirlo sin separar su registro de Caja.";
  }
  return null;
}
