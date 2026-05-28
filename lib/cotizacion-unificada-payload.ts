import { z } from "zod";

/** Datos serializados en `cotizaciones_unificadas.detalle` (versión 1). */
export type RubrosState = {
  muebles: boolean;
  aserradero: boolean;
  alquiler: boolean;
};

export type MuebleLineaPieza = {
  id: string;
  cantidad: number;
  espesor: number;
  ancho: number;
  largo: number;
  descripcion: string;
};

export type MuebleLineaMadera = {
  id: string;
  inventario_producto_id: string | null;
  especie_label: string;
  piezas: MuebleLineaPieza[];
  precioPorPt: number;
  /** Costo estimado por PT de la madera (uso interno; no va al PDF). */
  costoPorPt?: number;
};

export type CotizacionDetalleV1 = {
  version: 1;
  rubros: RubrosState;
  desperdicioPctMuebles: number;
  /** Costo fijo de acabado (S/) que se suma al total del rubro muebles. */
  costoAcabadoSoles: number;
  /** Costo fijo de mano de obra (S/) que se suma al total del rubro muebles. */
  costoManoObra: number;
  muebles_lineas: MuebleLineaMadera[];
  /** Texto libre para el bloque NOTA al pie (condiciones, exclusiones, etc.). */
  notas_generales: string;
  /**
   * Descripción visible al cliente en la cotización formal.
   * Si se deja vacío, se genera automáticamente a partir del tipo de mueble/material.
   * NO incluye datos técnicos internos (PT, dimensiones en pulgadas, etc.).
   */
  descripcion_cliente?: string;
  aserradero: {
    modo: "hora" | "total";
    precioHora: number;
    horas: number;
    montoTotalFijo: number;
    descripcion: string;
  } | null;
  alquiler: {
    inventario_producto_id: string | null;
    nombre_maquinaria: string;
    tarifaUnidad: "hora" | "dia";
    tarifa: number;
    unidades_tiempo: number;
    incluye_garantia_danios: boolean;
    monto_garantia: number;
    notas: string;
  } | null;
};

const rubrosSchema = z.object({
  muebles: z.boolean(),
  aserradero: z.boolean(),
  alquiler: z.boolean(),
});

const piezaSchema = z.object({
  id: z.string(),
  cantidad: z.number().nonnegative(),
  espesor: z.number().nonnegative(),
  ancho: z.number().nonnegative(),
  largo: z.number().nonnegative(),
  descripcion: z.string(),
});

const uuidOrNull = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.union([z.string().uuid(), z.null()]),
);

const lineaMaderaSchema = z.object({
  id: z.string(),
  inventario_producto_id: uuidOrNull,
  especie_label: z.string(),
  piezas: z.array(piezaSchema),
  precioPorPt: z.number().nonnegative(),
  costoPorPt: z.number().nonnegative().optional(),
});

const aserraderoSchema = z
  .object({
    modo: z.enum(["hora", "total"]),
    precioHora: z.number().nonnegative(),
    horas: z.number().nonnegative(),
    montoTotalFijo: z.number().nonnegative(),
    descripcion: z.string(),
  })
  .nullable();

const alquilerSchema = z
  .object({
    inventario_producto_id: uuidOrNull,
    nombre_maquinaria: z.string(),
    tarifaUnidad: z.enum(["hora", "dia"]),
    tarifa: z.number().nonnegative(),
    unidades_tiempo: z.number().nonnegative(),
    incluye_garantia_danios: z.boolean(),
    monto_garantia: z.number().nonnegative(),
    notas: z.string(),
  })
  .nullable();

export const cotizacionDetalleV1Schema = z.object({
  version: z.literal(1),
  rubros: rubrosSchema,
  desperdicioPctMuebles: z.number().nonnegative(),
  costoAcabadoSoles: z.number().nonnegative().optional().default(0),
  costoManoObra: z.number().nonnegative().optional().default(0),
  muebles_lineas: z.array(lineaMaderaSchema),
  notas_generales: z.string().optional().default(""),
  descripcion_cliente: z.string().optional(),
  aserradero: aserraderoSchema,
  alquiler: alquilerSchema,
});

export function defaultCotizacionDetalleV1(): CotizacionDetalleV1 {
  return {
    version: 1,
    rubros: { muebles: false, aserradero: false, alquiler: false },
    desperdicioPctMuebles: 30,
    costoAcabadoSoles: 0,
    costoManoObra: 0,
    muebles_lineas: [],
    notas_generales: "",
    descripcion_cliente: undefined,
    aserradero: {
      modo: "hora",
      precioHora: 0,
      horas: 0,
      montoTotalFijo: 0,
      descripcion: "",
    },
    alquiler: {
      inventario_producto_id: null,
      nombre_maquinaria: "",
      tarifaUnidad: "hora",
      tarifa: 0,
      unidades_tiempo: 0,
      incluye_garantia_danios: false,
      monto_garantia: 0,
      notas: "",
    },
  };
}

export function parseCotizacionDetalle(raw: unknown): CotizacionDetalleV1 {
  const parsed = cotizacionDetalleV1Schema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  const base = defaultCotizacionDetalleV1();
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (typeof r.notas_generales === "string") {
      base.notas_generales = r.notas_generales;
    }
    if (typeof r.descripcion_cliente === "string") {
      base.descripcion_cliente = r.descripcion_cliente;
    }
  }
  return base;
}

/** Lista corta de especies de las líneas de mueble (Kanban, filtros). */
export function resumenEspeciesDesdeDetalle(raw: unknown): string | null {
  const d = parseCotizacionDetalle(raw);
  const labels = d.muebles_lineas.map((l) => l.especie_label.trim()).filter(Boolean);
  if (!labels.length) return null;
  return [...new Set(labels)].join(", ");
}

/**
 * Texto para `ordenes_produccion.notas` al crear orden desde cotización unificada:
 * cliente, total, especies/piezas y rubros opcionales desde el detalle JSON.
 */
export function textoNotasOrdenProduccionDesdeUnificada(opts: {
  clienteNombre: string;
  correlativo: string | null;
  cotIdShort: string;
  total: number;
  detalle: unknown;
}): string {
  const d = parseCotizacionDetalle(opts.detalle);
  const parts: string[] = [];
  parts.push(`Cliente: ${opts.clienteNombre}`);
  parts.push(
    `Cot. ${opts.correlativo ?? opts.cotIdShort} · Total S/ ${opts.total.toFixed(2)}`,
  );

  const lineasMueble: string[] = [];
  for (const ml of d.muebles_lineas) {
    const piezas = ml.piezas.map((p) => p.descripcion.trim()).filter(Boolean).join("; ");
    lineasMueble.push(`${ml.especie_label}${piezas ? ` — ${piezas}` : ""}`);
  }
  if (lineasMueble.length) {
    parts.push("Muebles:");
    parts.push(...lineasMueble.map((l) => `· ${l}`));
  }

  if (d.rubros.aserradero && d.aserradero) {
    const a = d.aserradero;
    const txt =
      a.modo === "hora"
        ? `${a.horas} h × S/${a.precioHora.toFixed(2)}`
        : `Total S/${a.montoTotalFijo.toFixed(2)}`;
    parts.push(`Aserradero: ${txt} — ${a.descripcion}`);
  }
  if (d.rubros.alquiler && d.alquiler) {
    parts.push(`Alquiler: ${d.alquiler.nombre_maquinaria}`);
  }
  if (d.notas_generales?.trim()) {
    parts.push(`Notas: ${d.notas_generales.trim()}`);
  }
  return parts.join("\n");
}
