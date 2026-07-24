import { roundMoney } from "@/lib/utils";

export type AserraderoDocumentType = "boleta" | "factura";

export type AserraderoPrintSource = {
  id: string;
  fecha: string;
  correlativo?: string | null;
  lineas_json: unknown;
  pies_cubicos?: number | null;
  costo_cubicaje: number;
  precio_cobrado: number;
  metodo_pago?: string | null;
  modalidad_pago?: string | null;
  fecha_pago_credito?: string | null;
  adelanto?: number | null;
};

export type AserraderoCustomerSource = {
  nombre?: string | null;
  documento?: string | null;
  ruc?: string | null;
};

export type AserraderoPrintBlock = {
  indice: number;
  cantidad: number;
  espesor: number;
  ancho: number;
  largo: number;
  ptUnitarioComercial: number;
  ptTotalComercial: number;
  fuentePT: "guardado_total" | "guardado_unitario" | "calculado_por_dimensiones";
};

export type AserraderoPrintAdditionalService = {
  nombre: string;
  cantidad: number;
  tarifa: number;
  subtotal: number;
};

export type AserraderoPrintModel = {
  identity: {
    numero: string;
    fecha: string;
    tipoComprobante: AserraderoDocumentType;
  };
  customer: {
    nombre: string;
    documento: string | null;
    tipoDocumento: "DNI" | "RUC" | "Documento" | null;
  };
  blocks: AserraderoPrintBlock[];
  additionalServices: AserraderoPrintAdditionalService[];
  totals: {
    totalBloques: number;
    totalPTComercial: number | null;
    tarifaPorPT: number | null;
    fuenteDeTarifa: "metadata_guardada" | "no_registrada";
    subtotalCorte: number;
    subtotalAdicionales: number;
    ajusteAlTotal: number;
    totalCobrado: number;
  };
  payment: {
    modalidad: string;
    metodo: string;
    adelanto: number;
    saldo: number;
    fechaCredito: string | null;
  };
  historical: {
    modoFallback: boolean;
    piesCubicosRegistrados: number | null;
    notas: string[];
    advertencias: string[];
  };
};

type ParsedLines = {
  lines: Record<string, unknown>[];
  invalid: boolean;
};

export function calculateAserraderoCutSubtotal(totalPTComercial: number, tarifaPorPT: number) {
  return roundMoney(totalPTComercial * tarifaPorPT);
}

export function calculateAserraderoTotal(
  subtotalCorte: number,
  subtotalAdicionales: number,
  manoDeObraAdicional: number,
) {
  return roundMoney(subtotalCorte + subtotalAdicionales + manoDeObraAdicional);
}

export function calculateAserraderoAdjustment(precioCobrado: number, totalCalculado: number) {
  return roundMoney(precioCobrado - totalCalculado);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveNumber(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function nonNegativeNumber(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function parseLines(value: unknown): ParsedLines {
  if (Array.isArray(value)) {
    return { lines: value.filter(isRecord), invalid: false };
  }

  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return { lines: parsed.filter(isRecord), invalid: false };
      }
      return { lines: [], invalid: true };
    } catch {
      return { lines: [], invalid: true };
    }
  }

  if (value === null || value === undefined) {
    return { lines: [], invalid: false };
  }

  return { lines: [], invalid: true };
}

function isSummaryLine(line: Record<string, unknown>) {
  return (
    line.tipo === "resumen_aserradero" &&
    line.schemaVersion === 1
  );
}

function isBlockLine(line: Record<string, unknown>) {
  if (line.tipo === "bloque_cubicaje") return true;
  return (
    positiveNumber(line.espesor) !== null &&
    positiveNumber(line.ancho) !== null &&
    positiveNumber(line.largo) !== null
  );
}

function buildBlock(line: Record<string, unknown>, indice: number): AserraderoPrintBlock | null {
  const espesor = positiveNumber(line.espesor);
  const ancho = positiveNumber(line.ancho);
  const largo = positiveNumber(line.largo);
  if (espesor === null || ancho === null || largo === null) return null;

  const cantidad = positiveNumber(line.cantidad) ?? 1;
  const storedTotal = nonNegativeNumber(line.ptTotalComercial);
  const storedUnit = nonNegativeNumber(line.ptUnitarioComercial);
  const calculatedUnit = Math.floor((espesor * ancho * largo) / 12);

  if (storedTotal !== null) {
    return {
      indice,
      cantidad,
      espesor,
      ancho,
      largo,
      ptUnitarioComercial: storedUnit ?? calculatedUnit,
      ptTotalComercial: storedTotal,
      fuentePT: "guardado_total",
    };
  }

  if (storedUnit !== null) {
    return {
      indice,
      cantidad,
      espesor,
      ancho,
      largo,
      ptUnitarioComercial: storedUnit,
      ptTotalComercial: storedUnit * cantidad,
      fuentePT: "guardado_unitario",
    };
  }

  return {
    indice,
    cantidad,
    espesor,
    ancho,
    largo,
    ptUnitarioComercial: calculatedUnit,
    ptTotalComercial: calculatedUnit * cantidad,
    fuentePT: "calculado_por_dimensiones",
  };
}

function isAdditionalServiceLine(line: Record<string, unknown>) {
  return line.tipo === "servicio_especial" || line.tipo === "mano_de_obra";
}

function buildAdditionalService(
  line: Record<string, unknown>,
): AserraderoPrintAdditionalService | null {
  const nombre = nonEmptyString(line.nombre);
  if (!nombre) return null;

  const cantidad = positiveNumber(line.cantidad) ?? 1;
  const tarifa = nonNegativeNumber(line.tarifa) ?? 0;
  const storedSubtotal = nonNegativeNumber(line.subtotal);
  const subtotal = roundMoney(storedSubtotal ?? cantidad * tarifa);
  if (subtotal <= 0) return null;

  return { nombre, cantidad, tarifa, subtotal };
}

function getHistoricalNote(line: Record<string, unknown>): string | null {
  if (line.tipo !== "extra_madera_cliente") return null;
  const raw = nonEmptyString(line.nombre) ?? nonEmptyString(line.observaciones);
  if (!raw) return null;
  return raw.replace(/^Madera cliente:\s*/i, "").trim() || null;
}

function resolveDocumentType(
  summary: Record<string, unknown> | undefined,
  fallback: AserraderoDocumentType,
) {
  const stored = summary?.tipoComprobante;
  return stored === "factura" || stored === "boleta" ? stored : fallback;
}

function resolveCustomer(customer: AserraderoCustomerSource | null | undefined) {
  const ruc = nonEmptyString(customer?.ruc);
  const documento = nonEmptyString(customer?.documento);
  const selectedDocument = ruc ?? documento;
  const tipoDocumento =
    ruc !== null
      ? "RUC"
      : documento?.length === 8
        ? "DNI"
        : documento
          ? "Documento"
          : null;

  return {
    nombre: nonEmptyString(customer?.nombre) ?? "Cliente no registrado",
    documento: selectedDocument,
    tipoDocumento,
  } satisfies AserraderoPrintModel["customer"];
}

export function buildAserraderoPrintModel({
  service,
  customer,
  tipoComprobante,
}: {
  service: AserraderoPrintSource;
  customer?: AserraderoCustomerSource | null;
  tipoComprobante: AserraderoDocumentType;
}): AserraderoPrintModel {
  const parsed = parseLines(service.lineas_json);
  const summary = parsed.lines.find(isSummaryLine);
  const warnings: string[] = [];

  if (parsed.invalid) {
    warnings.push("lineas_json no contiene un arreglo JSON válido.");
  }

  const blocks = parsed.lines
    .filter(isBlockLine)
    .map((line, index) => buildBlock(line, index + 1))
    .filter((block): block is AserraderoPrintBlock => block !== null);

  const additionalServices = parsed.lines
    .filter(isAdditionalServiceLine)
    .map(buildAdditionalService)
    .filter((serviceLine): serviceLine is AserraderoPrintAdditionalService => serviceLine !== null);

  const historicalNotes = parsed.lines
    .map(getHistoricalNote)
    .filter((note): note is string => note !== null);

  const storedTotalPT = summary ? nonNegativeNumber(summary.totalPTComercial) : null;
  const blockTotalPT =
    blocks.length > 0
      ? blocks.reduce((total, block) => total + block.ptTotalComercial, 0)
      : null;
  const totalPTComercial = storedTotalPT ?? blockTotalPT;
  const tarifaPorPT = summary ? positiveNumber(summary.precioPorPT) : null;
  const subtotalCorte = roundMoney(nonNegativeNumber(service.costo_cubicaje) ?? 0);
  const subtotalAdicionales = roundMoney(
    additionalServices.reduce((total, item) => total + item.subtotal, 0),
  );
  const totalCobrado = roundMoney(nonNegativeNumber(service.precio_cobrado) ?? 0);
  const totalCalculado = roundMoney(subtotalCorte + subtotalAdicionales);
  const ajusteAlTotal = roundMoney(totalCobrado - totalCalculado);
  const adelanto = roundMoney(nonNegativeNumber(service.adelanto) ?? 0);
  const modalidad = nonEmptyString(service.modalidad_pago) ?? "contado";

  if (!summary) {
    warnings.push("La operación no tiene metadatos versionados de tarifa.");
  }
  if (blocks.length === 0) {
    warnings.push("La operación no tiene bloques dimensionales normalizables.");
  }

  return {
    identity: {
      numero: nonEmptyString(service.correlativo) ?? service.id.slice(0, 8).toUpperCase(),
      fecha: service.fecha,
      tipoComprobante: resolveDocumentType(summary, tipoComprobante),
    },
    customer: resolveCustomer(customer),
    blocks,
    additionalServices,
    totals: {
      totalBloques: blocks.reduce((total, block) => total + block.cantidad, 0),
      totalPTComercial,
      tarifaPorPT,
      fuenteDeTarifa: tarifaPorPT === null ? "no_registrada" : "metadata_guardada",
      subtotalCorte,
      subtotalAdicionales,
      ajusteAlTotal,
      totalCobrado,
    },
    payment: {
      modalidad,
      metodo: nonEmptyString(service.metodo_pago) ?? "efectivo",
      adelanto,
      saldo: roundMoney(Math.max(0, totalCobrado - adelanto)),
      fechaCredito:
        modalidad === "credito" ? nonEmptyString(service.fecha_pago_credito) : null,
    },
    historical: {
      modoFallback: parsed.invalid || blocks.length === 0,
      piesCubicosRegistrados: nonNegativeNumber(service.pies_cubicos),
      notas: historicalNotes,
      advertencias: warnings,
    },
  };
}
