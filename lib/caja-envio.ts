import type { MutationFormState } from "@/lib/mutation-form-state";

type GuardarCaja = (prev: MutationFormState, datos: FormData) => Promise<MutationFormState>;

/** Cada formulario conserva su identidad hasta que se cierra o se guarda. */
export function crearEnvioCaja(guardar: GuardarCaja): GuardarCaja {
  let movimientoId: string | null = null;
  return async (prev, datos) => {
    try {
      movimientoId ??= crypto.randomUUID();
      datos.set("movimiento_id", movimientoId);
      return await guardar(prev, datos);
    } catch {
      return {
        success: false, message: null,
        error: "No pudimos confirmar el guardado. Vuelve a intentarlo aquí sin cerrar el formulario; este envío no se registrará dos veces.",
      };
    }
  };
}
