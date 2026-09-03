import { roundMoney } from "@/lib/utils";

export type MaderaCortadaRealPtPricingInput = {
  cantidad: number;
  espesor: number;
  ancho: number;
  largo: number;
  precioPorPt: number;
};

function nonNegativeFinite(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Calcula el precio comercial con el PT real, sin redondear el cubicaje antes
 * de multiplicarlo por la tarifa. El dinero se redondea recién en el subtotal.
 */
export function calculateMaderaCortadaRealPtPricing(
  input: MaderaCortadaRealPtPricingInput,
) {
  const cantidad = nonNegativeFinite(input.cantidad);
  const espesor = nonNegativeFinite(input.espesor);
  const ancho = nonNegativeFinite(input.ancho);
  const largo = nonNegativeFinite(input.largo);
  const precioPorPt = nonNegativeFinite(input.precioPorPt);

  const ptUnitarioReal = (espesor * ancho * largo) / 12;
  const ptTotalReal = ptUnitarioReal * cantidad;
  const precioUnitarioComercial = ptUnitarioReal * precioPorPt;
  const subtotalComercial = roundMoney(ptTotalReal * precioPorPt);

  return {
    ptUnitarioReal,
    ptTotalReal,
    precioUnitarioComercial,
    subtotalComercial,
  };
}
