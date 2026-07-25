import { roundMoney } from "@/lib/utils";
import type { CotizacionDetalleV1, MuebleLineaMadera } from "@/lib/cotizacion-unificada-payload";

export const DEFAULT_MARGEN_GANANCIA_PCT = 30;

export function round2(n: number) {
  return roundMoney(n);
}

export function parseMargenGananciaInput(value: unknown, fallback = DEFAULT_MARGEN_GANANCIA_PCT): number {
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (normalized === "") return fallback;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  return fallback;
}

export function calcularGananciaPorMargen(costoProduccion: number, margenPct: number): number {
  const costo = Math.max(0, Number.isFinite(costoProduccion) ? costoProduccion : 0);
  const margen = Math.max(0, Number.isFinite(margenPct) ? margenPct : 0);
  return round2((costo * margen) / 100);
}

export function calcularPrecioConMargen(costoProduccion: number, margenPct: number): number {
  const costo = round2(Math.max(0, Number.isFinite(costoProduccion) ? costoProduccion : 0));
  return round2(costo + calcularGananciaPorMargen(costo, margenPct));
}

/** PT (pies-tablar): mismas reglas que el cotizador de muebles (espesor×ancho×largo en pulgadas, largo en pies). */
export function calcularPieTablar(cantidad: number, espesor: number, ancho: number, largo: number) {
  return (cantidad * espesor * ancho * largo) / 12;
}

export type TotalesRubros = {
  muebles: number;
  aserradero: number;
  alquiler: number;
  alquiler_base: number;
  garantia: number;
};

export type ResumenMargen = {
  costoProduccion: number;
  margenPct: number;
  ganancia: number;
  precioSugerido: number;
};

export type ContratoCalculoCotizacion = {
  subtotalBase: number;
  margenPctAplicado: number;
  margenMonto: number;
  precioSugerido: number;
  totalFinal: number;
};

export type CalculoDocumentoCotizacion = {
  subtotalBase: number;
  margenPctAplicado: number | null;
  margenMonto: number | null;
  precioSugerido: number;
  totalFinal: number;
  usaInstantanea: boolean;
};

export function totalPtLinea(
  piezas: { cantidad: number; espesor: number; ancho: number; largo: number }[],
): number {
  return piezas.reduce((acc, p) => acc + calcularPieTablar(p.cantidad, p.espesor, p.ancho, p.largo), 0);
}

export function computeTotalesDetalle(detalle: CotizacionDetalleV1): TotalesRubros {
  let muebles = 0;
  if (detalle.rubros.muebles && detalle.muebles_lineas.length > 0) {
    for (const linea of detalle.muebles_lineas) {
      const ptNeto = totalPtLinea(linea.piezas);
      muebles += ptNeto * Math.max(0, linea.precioPorPt);
    }
  }
  // Costo fijo de acabado (S/) y mano de obra (S/) para el rubro muebles.
  if (detalle.rubros.muebles) {
    muebles += Math.max(0, detalle.costoAcabadoSoles ?? 0);
    muebles += Math.max(0, detalle.costoManoObra ?? 0);
  }

  let aserradero = 0;
  if (detalle.rubros.aserradero && detalle.aserradero) {
    const a = detalle.aserradero;
    if (a.modo === "hora") {
      aserradero = Math.max(0, a.precioHora) * Math.max(0, a.horas);
    } else {
      aserradero = Math.max(0, a.montoTotalFijo);
    }
  }

  let alquilerBase = 0;
  let garantia = 0;
  if (detalle.rubros.alquiler && detalle.alquiler) {
    const al = detalle.alquiler;
    alquilerBase = Math.max(0, al.tarifa) * Math.max(0, al.unidades_tiempo);
    if (al.incluye_garantia_danios) {
      garantia = Math.max(0, al.monto_garantia);
    }
  }

  return {
    muebles: round2(muebles),
    aserradero: round2(aserradero),
    alquiler: round2(alquilerBase + garantia),
    alquiler_base: round2(alquilerBase),
    garantia: round2(garantia),
  };
}

export function totalGeneralDetalle(detalle: CotizacionDetalleV1): number {
  const t = computeTotalesDetalle(detalle);
  return round2(t.muebles + t.aserradero + t.alquiler);
}

export function calcularContratoCotizacion(
  detalle: CotizacionDetalleV1,
  margenPctAplicado: number,
): ContratoCalculoCotizacion {
  if (!Number.isFinite(margenPctAplicado) || margenPctAplicado < 0) {
    throw new RangeError('El margen aplicado debe ser un número finito mayor o igual a cero.');
  }
  const subtotalBase = totalGeneralDetalle(detalle);
  if (!Number.isFinite(subtotalBase) || subtotalBase < 0) {
    throw new RangeError('El subtotal de la cotización debe ser un importe finito.');
  }
  const margenNormalizado = roundMoney(margenPctAplicado);
  const margenMonto = roundMoney((subtotalBase * margenNormalizado) / 100);
  const precioSugerido = roundMoney(subtotalBase + margenMonto);
  return {
    subtotalBase,
    margenPctAplicado: margenNormalizado,
    margenMonto,
    precioSugerido,
    totalFinal: precioSugerido,
  };
}

export function crearInstantaneaCalculoCotizacion(
  calculo: ContratoCalculoCotizacion,
): Omit<ContratoCalculoCotizacion, 'precioSugerido'> {
  return {
    margenPctAplicado: calculo.margenPctAplicado,
    subtotalBase: calculo.subtotalBase,
    margenMonto: calculo.margenMonto,
    totalFinal: calculo.totalFinal,
  };
}

function importeEnCentavos(value: number): number {
  return Math.round(roundMoney(value) * 100);
}

export function totalClienteCoincideConServidor(
  totalCliente: unknown,
  totalServidor: number,
): boolean {
  if (
    typeof totalCliente !== 'number' ||
    !Number.isFinite(totalCliente) ||
    totalCliente < 0 ||
    !Number.isFinite(totalServidor) ||
    totalServidor < 0
  ) {
    return false;
  }
  return importeEnCentavos(totalCliente) === importeEnCentavos(totalServidor);
}

export function resolverCalculoDocumentoCotizacion(
  detalle: CotizacionDetalleV1,
  totalPersistido: number,
): CalculoDocumentoCotizacion {
  if (!Number.isFinite(totalPersistido) || totalPersistido < 0) {
    throw new RangeError('El total persistido debe ser un importe finito.');
  }
  const totalFinal = roundMoney(totalPersistido);
  const subtotalBase = totalGeneralDetalle(detalle);
  const instantanea = detalle.resumenCalculo;

  if (instantanea) {
    try {
      const recalculado = calcularContratoCotizacion(detalle, instantanea.margenPctAplicado);
      const instantaneaConsistente =
        totalClienteCoincideConServidor(instantanea.subtotalBase, recalculado.subtotalBase) &&
        totalClienteCoincideConServidor(instantanea.margenMonto, recalculado.margenMonto) &&
        totalClienteCoincideConServidor(instantanea.totalFinal, recalculado.totalFinal) &&
        totalClienteCoincideConServidor(totalFinal, recalculado.totalFinal);
      if (instantaneaConsistente) {
        return {
          ...recalculado,
          totalFinal,
          precioSugerido: totalFinal,
          usaInstantanea: true,
        };
      }
    } catch {
      // Una instantánea inválida no debe reemplazar el total histórico persistido.
    }
  }

  if (subtotalBase > 0 && totalFinal >= subtotalBase) {
    const margenMonto = roundMoney(totalFinal - subtotalBase);
    const margenPctAplicado = roundMoney((margenMonto / subtotalBase) * 100);
    return {
      subtotalBase,
      margenPctAplicado,
      margenMonto,
      precioSugerido: totalFinal,
      totalFinal,
      usaInstantanea: false,
    };
  }

  return {
    subtotalBase,
    margenPctAplicado: null,
    margenMonto: null,
    precioSugerido: totalFinal,
    totalFinal,
    usaInstantanea: false,
  };
}

export function computeResumenMargen(detalle: CotizacionDetalleV1, margenPct: number): ResumenMargen {
  const calculo = calcularContratoCotizacion(detalle, parseMargenGananciaInput(margenPct));
  return {
    costoProduccion: calculo.subtotalBase,
    margenPct: calculo.margenPctAplicado,
    ganancia: calculo.margenMonto,
    precioSugerido: calculo.precioSugerido,
  };
}

/** PT de compra por línea (con desperdicio), mismo criterio que el precio de venta del rubro muebles. */
export function ptCompraLinea(linea: Pick<MuebleLineaMadera, "piezas">, desperdicioPctMuebles: number): number {
  const ptNeto = totalPtLinea(linea.piezas);
  const des = Math.max(0, desperdicioPctMuebles);
  return round2(ptNeto * (1 + des / 100));
}

export type EconomiaLineaMueble = {
  ptCompra: number;
  precioVenta: number;
  costoEstimado: number | null;
  margenSoles: number | null;
  margenPct: number | null;
};

export function economiaLineaMueble(
  linea: MuebleLineaMadera,
  desperdicioPctMuebles: number,
): EconomiaLineaMueble {
  const ptCompra = ptCompraLinea(linea, desperdicioPctMuebles);
  const precioVenta = round2(ptCompra * Math.max(0, linea.precioPorPt));
  const tieneCosto =
    linea.costoPorPt != null && Number.isFinite(linea.costoPorPt) && linea.costoPorPt >= 0;
  const costoEstimado = tieneCosto ? round2(ptCompra * (linea.costoPorPt as number)) : null;
  const margenSoles =
    costoEstimado != null ? round2(precioVenta - costoEstimado) : null;
  const margenPct =
    margenSoles != null && precioVenta > 0 ? round2((margenSoles / precioVenta) * 100) : null;
  return { ptCompra, precioVenta, costoEstimado, margenSoles, margenPct };
}

export type EconomiaInternaTotales = {
  costoTotalEstimado: number;
  precioTotal: number;
  gananciaEstimada: number;
  margenPct: number | null;
};

/** Costos internos (madera por línea + acabado); precio total = cotización completa. */
export function computeEconomiaInterna(detalle: CotizacionDetalleV1): EconomiaInternaTotales {
  const precioTotal = totalGeneralDetalle(detalle);
  const des = Math.max(0, detalle.desperdicioPctMuebles);
  let costoMuebles = 0;
  if (detalle.rubros.muebles && detalle.muebles_lineas.length > 0) {
    for (const linea of detalle.muebles_lineas) {
      const tieneCosto =
        linea.costoPorPt != null && Number.isFinite(linea.costoPorPt) && linea.costoPorPt >= 0;
      if (tieneCosto) {
        const ptC = ptCompraLinea(linea, des);
        costoMuebles += round2(ptC * (linea.costoPorPt as number));
      }
    }
    costoMuebles += Math.max(0, detalle.costoAcabadoSoles ?? 0);
    costoMuebles += Math.max(0, detalle.costoManoObra ?? 0);
  }
  const costoTotalEstimado = round2(costoMuebles);
  const gananciaEstimada = round2(precioTotal - costoTotalEstimado);
  const margenPct =
    precioTotal > 0 ? round2((gananciaEstimada / precioTotal) * 100) : null;
  return { costoTotalEstimado, precioTotal, gananciaEstimada, margenPct };
}
