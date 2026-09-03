import { formatPen, roundMoney } from "@/lib/utils";
import { calculateMaderaCortadaRealPtPricing } from "@/lib/madera-cortada-pricing";

export type TipoComprobanteVenta = "boleta" | "factura" | "ninguno";

export type MaderaCortadaCubicajeLine = {
  descripcion: string;
  cantidad: number;
  espesor: number;
  ancho: number;
  largo: number;
  precioUnitarioComercial: number;
  subtotalComercial: number;
  subtotalPT: number;
  inventario_producto_id: string | null;
};

export type MaderaCortadaVoucherLine = {
  orden: number;
  descripcion: string;
  cantidad: number;
  unidad: "pzs";
  espesor: number;
  ancho: number;
  largo: number;
  precio_unitario: number;
  subtotal: number;
};

export type MaderaCortadaPrintSource = {
  tipo_corte?: string | null;
  total_pt?: number | string | null;
  precio_por_pt?: number | string | null;
  cantidad_piezas?: number | string | null;
  precio_unitario_comercial?: number | string | null;
  total?: number | string | null;
  lineas_comprobante?: unknown;
  tipo_comprobante?: string | null;
};

export type MaderaCortadaPrintItem = {
  desc: string;
  qty: string;
  unitario: string;
  total: string;
  kind: "producto" | "ajuste";
  quantityValue: number;
  unitPriceValue: number;
  subtotalValue: number;
};

export type MaderaCortadaPrintModel = {
  items: MaderaCortadaPrintItem[];
  totalSoles: number;
  tipoComprobante: Exclude<TipoComprobanteVenta, "ninguno">;
  hasDetailedLines: boolean;
};

/**
 * Mantiene ajustes y descuentos disponibles para control interno. En la copia
 * del cliente los integra proporcionalmente en los productos para que el
 * detalle visible siga sumando exactamente el total cobrado.
 */
export function getMaderaCortadaCustomerItems(
  items: readonly MaderaCortadaPrintItem[],
  totalSoles?: number,
) {
  const products = items.filter((item) => item.kind === "producto");
  if (totalSoles === undefined || products.length === 0) return products;

  const targetTotal = roundMoney(Math.max(0, totalSoles));
  const productsTotal = roundMoney(products.reduce((sum, item) => sum + item.subtotalValue, 0));
  if (Math.abs(targetTotal - productsTotal) < 0.01) return products;

  const allocationBase = productsTotal > 0
    ? products.map((item) => item.subtotalValue)
    : products.map((item) => item.quantityValue);
  const allocationTotal = allocationBase.reduce((sum, value) => sum + value, 0);
  let allocated = 0;

  return products.map((item, index) => {
    const isLast = index === products.length - 1;
    const remaining = roundMoney(Math.max(0, targetTotal - allocated));
    const subtotalValue = isLast
      ? remaining
      : Math.min(
          remaining,
          roundMoney(targetTotal * (allocationTotal > 0 ? allocationBase[index] / allocationTotal : 0)),
        );
    allocated = roundMoney(allocated + subtotalValue);
    const unitPriceValue = item.quantityValue > 0
      ? subtotalValue / item.quantityValue
      : subtotalValue;

    return {
      ...item,
      unitario: formatPen(unitPriceValue),
      total: formatPen(subtotalValue),
      unitPriceValue,
      subtotalValue,
    };
  });
}

const TIPO_CORTE_LABELS: Record<string, string> = {
  tabla: "Tabla",
  liston: "Listón",
  cuarton: "Cuartón",
  poste: "Poste",
};

function finiteNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeNumber(value: unknown, fallback = 0) {
  const number = finiteNumber(value, fallback);
  return number >= 0 ? number : fallback;
}

function compactText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Lee el contrato que ya genera CubicajeInput. No altera ninguna fórmula:
 * únicamente normaliza sus resultados para que puedan guardarse e imprimirse.
 */
export function parseMaderaCortadaCubicajeLines(raw: unknown): MaderaCortadaCubicajeLine[] {
  return parseJsonArray(raw)
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
    .map((linea) => ({
      descripcion: compactText(linea.descripcion),
      cantidad: nonNegativeNumber(linea.cantidad),
      espesor: nonNegativeNumber(linea.espesor),
      ancho: nonNegativeNumber(linea.ancho),
      largo: nonNegativeNumber(linea.largo),
      precioUnitarioComercial: nonNegativeNumber(linea.precioUnitarioComercial),
      subtotalComercial: nonNegativeNumber(linea.subtotalComercial),
      subtotalPT: nonNegativeNumber(linea.subtotalPT),
      inventario_producto_id:
        typeof linea.inventario_producto_id === "string" && linea.inventario_producto_id !== "manual"
          ? linea.inventario_producto_id
          : null,
    }));
}

/** Crea la copia comercial que se conservará para futuras impresiones. */
export function buildMaderaCortadaVoucherLines(
  raw: unknown,
  precioPorPt?: number,
): MaderaCortadaVoucherLine[] {
  const lineas = Array.isArray(raw) && raw.every((linea) =>
    Boolean(linea) && typeof linea === "object" && "precioUnitarioComercial" in linea
  )
    ? (raw as MaderaCortadaCubicajeLine[])
    : parseMaderaCortadaCubicajeLines(raw);

  return lineas
    .filter((linea) =>
      linea.cantidad > 0
      && linea.espesor > 0
      && linea.ancho > 0
      && linea.largo > 0
    )
    .map((linea, index) => {
      const shouldCalculateRealPtPrice = precioPorPt !== undefined && Number.isFinite(precioPorPt);
      const pricing = shouldCalculateRealPtPrice
        ? calculateMaderaCortadaRealPtPricing({
            cantidad: linea.cantidad,
            espesor: linea.espesor,
            ancho: linea.ancho,
            largo: linea.largo,
            precioPorPt,
          })
        : null;

      return {
        orden: index,
        descripcion: compactText(linea.descripcion),
        cantidad: linea.cantidad,
        unidad: "pzs" as const,
        espesor: nonNegativeNumber(linea.espesor),
        ancho: nonNegativeNumber(linea.ancho),
        largo: nonNegativeNumber(linea.largo),
        precio_unitario: pricing?.precioUnitarioComercial
          ?? nonNegativeNumber(linea.precioUnitarioComercial),
        subtotal: pricing?.subtotalComercial
          ?? nonNegativeNumber(
            linea.subtotalComercial,
            roundMoney(linea.cantidad * linea.precioUnitarioComercial),
          ),
      };
    });
}

function parseStoredVoucherLines(raw: unknown): MaderaCortadaVoucherLine[] {
  return parseJsonArray(raw)
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
    .map((linea, index) => ({
      orden: Math.max(0, Math.trunc(nonNegativeNumber(linea.orden, index))),
      descripcion: compactText(linea.descripcion),
      cantidad: nonNegativeNumber(linea.cantidad),
      unidad: "pzs" as const,
      espesor: nonNegativeNumber(linea.espesor),
      ancho: nonNegativeNumber(linea.ancho),
      largo: nonNegativeNumber(linea.largo),
      precio_unitario: nonNegativeNumber(linea.precio_unitario),
      subtotal: nonNegativeNumber(linea.subtotal),
    }))
    .filter((linea) => linea.cantidad > 0)
    .sort((a, b) => a.orden - b.orden);
}

function normalizedComparisonText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE");
}

function groupVoucherLines(lineas: MaderaCortadaVoucherLine[]) {
  const groups = new Map<string, MaderaCortadaVoucherLine>();

  for (const linea of lineas) {
    const key = [
      normalizedComparisonText(linea.descripcion),
      linea.unidad,
      linea.espesor.toFixed(6),
      linea.ancho.toFixed(6),
      linea.largo.toFixed(6),
      linea.precio_unitario.toFixed(6),
    ].join("|");
    const existing = groups.get(key);
    if (existing) {
      existing.cantidad += linea.cantidad;
      existing.subtotal = roundMoney(existing.subtotal + linea.subtotal);
      continue;
    }
    groups.set(key, { ...linea });
  }

  return [...groups.values()].sort((a, b) => a.orden - b.orden);
}

function formatCompactNumber(value: number, maximumFractionDigits = 4) {
  return new Intl.NumberFormat("es-PE", {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function tipoCorteLabel(tipoCorte: string | null | undefined) {
  const normalized = compactText(tipoCorte).toLocaleLowerCase("es-PE");
  return TIPO_CORTE_LABELS[normalized] ?? "Madera cortada";
}

function detailedDescription(linea: MaderaCortadaVoucherLine, tipoCorte: string | null | undefined) {
  const corte = tipoCorteLabel(tipoCorte);
  const descripcion = compactText(linea.descripcion);
  const descContainsCut = descripcion
    ? normalizedComparisonText(descripcion).includes(normalizedComparisonText(corte))
    : false;
  const base = descripcion
    ? (descContainsCut ? descripcion : `${corte} — ${descripcion}`)
    : `${corte} de madera cortada`;
  const hasDimensions = linea.espesor > 0 && linea.ancho > 0 && linea.largo > 0;

  if (!hasDimensions) return base;
  return `${base} · ${formatCompactNumber(linea.espesor, 2)}\" × ${formatCompactNumber(linea.ancho, 2)}\" × ${formatCompactNumber(linea.largo, 2)}'`;
}

function validStoredDocumentType(value: unknown): Exclude<TipoComprobanteVenta, "ninguno"> | null {
  return value === "factura" || value === "boleta" ? value : null;
}

function adjustmentItem(value: number): MaderaCortadaPrintItem | null {
  const adjustment = roundMoney(value);
  if (Math.abs(adjustment) < 0.01) return null;
  return {
    desc: adjustment < 0 ? "Descuento comercial" : "Ajuste comercial",
    qty: "—",
    unitario: formatPen(adjustment),
    total: formatPen(adjustment),
    kind: "ajuste",
    quantityValue: 0,
    unitPriceValue: adjustment,
    subtotalValue: adjustment,
  };
}

/**
 * Modelo único consumido por la vista normal, A4 y ticket. El total persistido
 * es autoritativo; ninguna vista vuelve a aplicar fórmulas de cubicaje.
 */
export function buildMaderaCortadaPrintModel(
  source: MaderaCortadaPrintSource,
  requestedDocType?: string,
): MaderaCortadaPrintModel {
  const totalSoles = nonNegativeNumber(source.total);
  const storedLines = groupVoucherLines(parseStoredVoucherLines(source.lineas_comprobante));
  const storedDocumentType = validStoredDocumentType(source.tipo_comprobante);
  const tipoComprobante = storedDocumentType ?? validStoredDocumentType(requestedDocType) ?? "boleta";

  if (storedLines.length > 0) {
    const subtotalLineas = roundMoney(storedLines.reduce((sum, linea) => sum + linea.subtotal, 0));
    const items: MaderaCortadaPrintItem[] = storedLines.map((linea) => ({
      desc: detailedDescription(linea, source.tipo_corte),
      qty: `${formatCompactNumber(linea.cantidad)} ${linea.unidad}`,
      unitario: formatPen(linea.precio_unitario),
      total: formatPen(linea.subtotal),
      kind: "producto",
      quantityValue: linea.cantidad,
      unitPriceValue: linea.precio_unitario,
      subtotalValue: linea.subtotal,
    }));
    const adjustment = adjustmentItem(totalSoles - subtotalLineas);
    if (adjustment) items.push(adjustment);

    return { items, totalSoles, tipoComprobante, hasDetailedLines: true };
  }

  // Compatibilidad con ventas históricas: se usan exclusivamente sus campos
  // guardados, sin inventar especie, medidas ni una descripción personalizada.
  const cantidadPiezas = nonNegativeNumber(source.cantidad_piezas);
  const precioUnitarioComercial = nonNegativeNumber(source.precio_unitario_comercial);
  const totalPt = nonNegativeNumber(source.total_pt);
  const precioPorPt = nonNegativeNumber(source.precio_por_pt);
  const usePieces = cantidadPiezas > 0 && precioUnitarioComercial > 0;
  const quantity = usePieces ? cantidadPiezas : totalPt;
  const unit = usePieces ? "pzs" : "PT";
  const unitPrice = usePieces ? precioUnitarioComercial : precioPorPt;
  const calculatedSubtotal = roundMoney(quantity * unitPrice);
  const items: MaderaCortadaPrintItem[] = [
    {
      desc: `${tipoCorteLabel(source.tipo_corte)} de madera cortada`,
      qty: `${formatCompactNumber(quantity)} ${unit}`,
      unitario: formatPen(unitPrice),
      total: formatPen(calculatedSubtotal),
      kind: "producto",
      quantityValue: quantity,
      unitPriceValue: unitPrice,
      subtotalValue: calculatedSubtotal,
    },
  ];
  const adjustment = adjustmentItem(totalSoles - calculatedSubtotal);
  if (adjustment) items.push(adjustment);

  return { items, totalSoles, tipoComprobante, hasDetailedLines: false };
}
