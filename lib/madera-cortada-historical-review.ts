import { calculateMaderaCortadaRealPtPricing } from "@/lib/madera-cortada-pricing";
import {
  parseStoredMaderaCortadaVoucherLines,
  type MaderaCortadaVoucherLine,
} from "@/lib/madera-cortada-print-model";
import { roundMoney } from "@/lib/utils";

export type MaderaCortadaHistoricalReviewStatus =
  | "correcta"
  | "falta_informacion"
  | "importe_no_coincide"
  | "ajuste_interno";

export type MaderaCortadaHistoricalReviewIssue = {
  code:
    | "sin_detalle"
    | "descripcion_faltante"
    | "cantidad_faltante"
    | "medidas_faltantes"
    | "precio_linea_incorrecto"
    | "subtotal_linea_incorrecto"
    | "pt_no_coincide"
    | "total_con_ajuste";
  message: string;
  lineIndex?: number;
};

export type MaderaCortadaHistoricalReviewSource = {
  total_pt?: number | string | null;
  precio_por_pt?: number | string | null;
  cantidad_piezas?: number | string | null;
  total?: number | string | null;
  lineas_comprobante?: unknown;
};

export type MaderaCortadaHistoricalReview = {
  status: MaderaCortadaHistoricalReviewStatus;
  issues: MaderaCortadaHistoricalReviewIssue[];
  storedLines: MaderaCortadaVoucherLine[];
  calculatedTotalPt: number;
  calculatedQuantity: number;
  calculatedSubtotal: number;
  storedTotalPt: number;
  storedTotal: number;
  difference: number;
};

const moneyTolerance = 0.009;
const ptTolerance = 0.01;

function nonNegativeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function isCompleteLine(line: MaderaCortadaVoucherLine) {
  return Boolean(line.descripcion.trim())
    && line.cantidad > 0
    && line.espesor > 0
    && line.ancho > 0
    && line.largo > 0;
}

export function reviewMaderaCortadaHistoricalSale(
  source: MaderaCortadaHistoricalReviewSource,
): MaderaCortadaHistoricalReview {
  const storedLines = parseStoredMaderaCortadaVoucherLines(source.lineas_comprobante, {
    preserveIncomplete: true,
  });
  const precioPorPt = nonNegativeNumber(source.precio_por_pt);
  const storedTotalPt = nonNegativeNumber(source.total_pt);
  const storedTotal = roundMoney(nonNegativeNumber(source.total));
  const issues: MaderaCortadaHistoricalReviewIssue[] = [];

  if (storedLines.length === 0) {
    issues.push({
      code: "sin_detalle",
      message: "La venta no conserva descripción, cantidad ni medidas para la boleta.",
    });
  }

  let calculatedTotalPt = 0;
  let calculatedQuantity = 0;
  let calculatedSubtotal = 0;

  storedLines.forEach((line, lineIndex) => {
    if (!line.descripcion.trim()) {
      issues.push({
        code: "descripcion_faltante",
        lineIndex,
        message: `La pieza ${lineIndex + 1} no tiene descripción.`,
      });
    }
    if (line.cantidad <= 0) {
      issues.push({
        code: "cantidad_faltante",
        lineIndex,
        message: `La pieza ${lineIndex + 1} no tiene una cantidad válida.`,
      });
    }
    if (line.espesor <= 0 || line.ancho <= 0 || line.largo <= 0) {
      issues.push({
        code: "medidas_faltantes",
        lineIndex,
        message: `La pieza ${lineIndex + 1} necesita espesor, ancho y largo.`,
      });
    }
    if (!isCompleteLine(line)) return;

    const pricing = calculateMaderaCortadaRealPtPricing({
      cantidad: line.cantidad,
      espesor: line.espesor,
      ancho: line.ancho,
      largo: line.largo,
      precioPorPt,
    });
    calculatedTotalPt += pricing.ptTotalReal;
    calculatedQuantity += line.cantidad;
    calculatedSubtotal = roundMoney(calculatedSubtotal + pricing.subtotalComercial);

    if (Math.abs(roundMoney(line.precio_unitario) - roundMoney(pricing.precioUnitarioComercial)) > moneyTolerance) {
      issues.push({
        code: "precio_linea_incorrecto",
        lineIndex,
        message: `El precio por pieza de la línea ${lineIndex + 1} no coincide con el PT real.`,
      });
    }
    if (Math.abs(roundMoney(line.subtotal) - pricing.subtotalComercial) > moneyTolerance) {
      issues.push({
        code: "subtotal_linea_incorrecto",
        lineIndex,
        message: `El subtotal de la línea ${lineIndex + 1} no coincide con sus medidas.`,
      });
    }
  });

  if (storedLines.length > 0 && issues.every((issue) => ![
    "descripcion_faltante",
    "cantidad_faltante",
    "medidas_faltantes",
  ].includes(issue.code))) {
    if (Math.abs(calculatedTotalPt - storedTotalPt) > ptTolerance) {
      issues.push({
        code: "pt_no_coincide",
        message: "Las medidas guardadas no coinciden con el PT total de la venta.",
      });
    }
    if (Math.abs(calculatedSubtotal - storedTotal) > moneyTolerance) {
      issues.push({
        code: "total_con_ajuste",
        message: "El total cobrado contiene un ajuste o no coincide con el cálculo por PT real.",
      });
    }
  }

  const missingInformation = issues.some((issue) => [
    "sin_detalle",
    "descripcion_faltante",
    "cantidad_faltante",
    "medidas_faltantes",
  ].includes(issue.code));
  const incorrectAmount = issues.some((issue) => [
    "precio_linea_incorrecto",
    "subtotal_linea_incorrecto",
    "pt_no_coincide",
  ].includes(issue.code));
  const hasAdjustment = issues.some((issue) => issue.code === "total_con_ajuste");
  const status: MaderaCortadaHistoricalReviewStatus = missingInformation
    ? "falta_informacion"
    : incorrectAmount
      ? "importe_no_coincide"
      : hasAdjustment
        ? "ajuste_interno"
        : "correcta";

  return {
    status,
    issues,
    storedLines,
    calculatedTotalPt,
    calculatedQuantity,
    calculatedSubtotal,
    storedTotalPt,
    storedTotal,
    difference: roundMoney(calculatedSubtotal - storedTotal),
  };
}

export const maderaCortadaHistoricalStatusLabels: Record<
  MaderaCortadaHistoricalReviewStatus,
  string
> = {
  correcta: "Correcta",
  falta_informacion: "Falta información",
  importe_no_coincide: "Importe no coincide",
  ajuste_interno: "Ajuste interno",
};
