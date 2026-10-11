import { roundMoney } from "@/lib/utils";

/** Importe recibido hoy; no modifica el precio ni las fórmulas de la venta. */
export function montoCobradoVenta(total: number, modalidad: string, adelanto = 0): number {
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(adelanto) || adelanto < 0) {
    throw new Error("El total y el adelanto deben ser importes válidos.");
  }
  if (modalidad === "credito") return 0;
  if (modalidad === "contado") return total;
  if (modalidad !== "adelanto" && modalidad !== "adelanto_saldo") {
    throw new Error("Elige una modalidad de pago válida.");
  }
  if (adelanto > total) throw new Error("El adelanto no puede superar el total de la operación.");
  return roundMoney(adelanto);
}

export function mensajeOperacionFinanciera(error: { code?: string; message: string }): string {
  return error.code === "PGRST202"
    ? "Falta instalar la actualización de cobros en la base de datos. La operación no se guardó."
    : error.message;
}
