import type { CondicionesPagoCotizacion, CotizacionDetalleV1 } from "@/lib/cotizacion-unificada-payload";
import { formatPen, roundMoney } from "@/lib/utils";

export type MedioCobroCotizacion = "efectivo" | "banco" | "yape" | "otro";

export const mediosCobroCotizacion: Record<MedioCobroCotizacion, string> = {
  efectivo: "Efectivo", banco: "Transferencia / banco", yape: "Yape", otro: "Otro",
};
const metodos = {
  efectivo: "Efectivo", transferencia: "Transferencia bancaria", yape: "Yape",
  billetera_digital: "Billetera digital", otro: "Otro",
};
const modalidades = {
  contado: "Contado", adelanto: "Adelanto", adelanto_saldo: "Adelanto + saldo", credito: "Crédito",
};

export function medioSugeridoCotizacion(pago?: CondicionesPagoCotizacion): MedioCobroCotizacion {
  if (pago?.metodo === "transferencia") return "banco";
  if (pago?.metodo === "billetera_digital" || pago?.metodo === "otro") return "otro";
  return pago?.metodo ?? "efectivo";
}

export function validarCondicionesPagoCotizacion(pago: CondicionesPagoCotizacion | undefined, total: number): string | null {
  if (!pago) return null; // Los históricos pueden no incluir condiciones estructuradas.
  const tieneAdelanto = pago.modalidad === "adelanto" || pago.modalidad === "adelanto_saldo";
  if (tieneAdelanto && (!Number.isFinite(pago.adelanto) || !(pago.adelanto! > 0))) {
    return "Indica un adelanto acordado mayor que cero.";
  }
  if (tieneAdelanto && roundMoney(pago.adelanto!) > roundMoney(total)) {
    return "El adelanto acordado no puede superar el total de la cotización.";
  }
  if ((tieneAdelanto || pago.modalidad === "credito") &&
      (!Number.isInteger(pago.plazo) || !(pago.plazo! > 0) || !pago.plazoUnidad)) {
    return "Indica un plazo de pago en días o meses enteros, mayor que cero.";
  }
  return null;
}

export function lineasCondicionesPagoCotizacion(pago: CondicionesPagoCotizacion | undefined, total: number): string[] {
  if (!pago) return [];
  const lineas = [`Medio de pago acordado: ${metodos[pago.metodo]}`];
  if (pago.modalidad) lineas.push(`Modalidad: ${modalidades[pago.modalidad]}`);
  if ((pago.modalidad === "adelanto" || pago.modalidad === "adelanto_saldo") && (pago.adelanto ?? 0) > 0) {
    lineas.push(`Adelanto acordado: ${formatPen(pago.adelanto)}`);
    lineas.push(`Saldo previsto: ${formatPen(Math.max(0, roundMoney(total - pago.adelanto!)))}`);
  }
  if (pago.modalidad !== "contado" && pago.modalidad && (pago.plazo ?? 0) > 0) {
    lineas.push(`Plazo de pago: ${pago.plazo} ${pago.plazoUnidad === "meses" ? "meses" : "días"}`);
  }
  return lineas;
}

export function notasDocumentoCotizacion(detalle: CotizacionDetalleV1, total: number): string {
  return [detalle.notas_generales.trim(), ...lineasCondicionesPagoCotizacion(detalle.condiciones_pago, total)]
    .filter(Boolean).join("\n");
}
