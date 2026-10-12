"use server";
import { documentoClienteError, telefonoClienteError } from "@/lib/cotizacion-cliente-validacion";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireAuthContext } from "@/lib/auth";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { FEATURES } from "@/lib/features";
import {
  demoCambiarEstadoOrden,
  demoCerrarContratoAlquiler,
  demoCerrarMes,
  demoClientesRows,
  demoCajaRows,
  demoCajaMovimientoById,
  demoCreateAdelanto,
  demoCreateAlquiler,
  demoCreateCaja,
  demoCreateChofer,
  demoUpdateChofer,
  demoCreateCliente,
  demoUpdateClienteDatos,
  demoCreateCorte,
  demoCreateEmpleado,
  demoDeleteInventarioMovimiento,
  demoDeleteInventarioProducto,
  demoCreateMuebleCatalogo,
  demoDeleteMuebleCatalogo,
  demoToggleMuebleCatalogoActivo,
  demoUpdateMuebleCatalogo,
  demoCreateOrdenProduccion,
  demoDeleteCotizacionMueblePersonalizada,
  demoDeleteCotizacionUnificada,
  demoDeleteCliente,
  demoUpdateClienteEstado,
  demoGetCotizacionUnificada,
  demoInventarioMovimientosRows,
  demoCreateProveedor,
  demoUpdateProveedor,
  demoCreateRegistroGeneral,
  demoDeleteByCategory,
  demoDeleteOneById,
  demoResetStore,
  demoCreateSueldo,
  demoCreateZonaEntrega,
  demoMarcarEntregaMueble,
  demoRegistrarConteoInventario,
  demoToggleInventarioProductoActivo,
  demoToggleSecurityControl,
  demoUpdateInventarioProducto,
  demoUpdateCotizacionUnificada,
  demoUpdateServicioEspecialTarifa,
  type CotizacionUnificadaRow,
} from "@/lib/demo-store";
import {
  cotizacionDetalleV1Schema,
  parseCotizacionDetalle,
  textoNotasOrdenProduccionDesdeUnificada,
} from "@/lib/cotizacion-unificada-payload";
import { nextCorrelativo } from "@/lib/numeracion";
import { hasSupabaseEnv } from "@/lib/runtime";
import { inventarioCostoUnitarioOpcionalSchema } from "@/lib/inventario-validation";
import { registrarAltaInventario } from '@/lib/inventario-altas';
import { cajaMovimientoSchema } from "@/lib/caja-movimiento-validation";
import { cajaEliminacionBloqueo } from "@/lib/caja-eliminacion";
import { cajaReintentoCoincide, CAJA_REINTENTO_CONFLICTO } from "@/lib/caja-reintento";
import type { MutationFormState } from "@/lib/mutation-form-state";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, Json } from "@/lib/supabase/types";
import { roundMoney, safeDivide, parseDecimal, fechaHoyPeru } from "@/lib/utils";
import { claveOperacion, registrarOperacionIntegral, anularOperacionIntegral, nombreClienteOperacion } from '@/lib/operaciones-integrales';
import { montoCobradoVenta, mensajeOperacionFinanciera } from "@/lib/ventas-pago";
import { registrarServicioIntegral } from '@/lib/servicios-integrales';
import { registrarCotizacionRapida } from '@/lib/cotizacion-rapida';
import { cotizacionUnificadaIdentidadSchema, registrarCotizacionUnificada } from '@/lib/cotizacion-unificada-guardado';
import { canCorrectHistoricalMadera } from '@/lib/permissions';
import { resumenCobroLocal } from "@/lib/cotizacion-cobros";
import {
  buildMaderaCortadaVoucherLines,
  parseMaderaCortadaCubicajeLines,
} from "@/lib/madera-cortada-print-model";
import { isDetailedMaderaCortadaDescription } from "@/lib/madera-cortada-historical-review";
import { validarCondicionesPagoCotizacion } from "@/lib/cotizacion-pago";

import { getEmpresaConfig } from "@/lib/company-config";
import {
  calcularContratoCotizacion,
  crearInstantaneaCalculoCotizacion,
  resolverCalculoDocumentoCotizacion,
  totalClienteCoincideConServidor,
} from "@/lib/cotizacion-calculos";

const preprocessDecimal = (v: unknown) => {
  if (v === null || v === undefined || v === "") {
    return undefined;
  }
  return parseDecimal(v as string | number | null | undefined);
};

const money = (value: number): number => roundMoney(value);
const moneySchema = (schema: z.ZodType<number>) => z.preprocess(preprocessDecimal, schema).transform(money);

const margenGananciaConfigSchema = z.object({
  margenGananciaDefaultPct: z.preprocess(preprocessDecimal, z.coerce.number().nonnegative()),
});

const ventaSchema = z.object({
  clienteId: z.string().uuid(),
  fecha: z.iso.date(),
  total: moneySchema(z.number().positive()),
  estado: z.enum(["borrador", "confirmada"]).default("borrador"),
  metodoPago: z.enum(["efectivo", "yape", "transferencia", "billetera_digital", "otro"]).default("efectivo"),
  modalidadPago: z.enum(["contado", "adelanto", "adelanto_saldo", "credito"]).default("contado"),
  adelanto: moneySchema(z.number().nonnegative()).default(0),
  fechaPagoCredito: z.iso.date().optional().or(z.literal("")),
  productoInventarioId: z.string().uuid().optional(),
  cantidadProducto: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().positive().optional(),
  ),
  tipoComprobante: z.enum(["factura", "boleta", "ninguno"]).optional().default("ninguno"),
  urlComprobante: z.string().optional().nullable(),
});

const alquilerSchema = z.object({
  clienteId: z.string().uuid(),
  activo: z.string().min(2),
  fechaInicio: z.iso.date(),
  tarifa: z.coerce.number().positive(),
  penalidad: z.coerce.number().nonnegative().default(0),
});

const cotizacionSchema = z.object({
  clienteId: z.string().uuid(),
  fecha: z.iso.date(),
  tipo: z.enum(["mueble_personalizado", "servicio_corte"]),
  especieMadera: z.string().min(2),
  unidadMedida: z.enum(["cm", "in", "otro"]),
  precioCalculado: moneySchema(z.number().nonnegative()),
  precioAcordado: moneySchema(z.number().positive()),
  motivoAjuste: z.string().optional(),
  estado: z.enum(["borrador", "confirmada"]).default("borrador"),
});

const corteSchema = z.object({
  cotizacionId: z.string().uuid(),
  tipoPieza: z.enum(["tabla", "liston"]),
  espesor: z.coerce.number().positive(),
  ancho: z.coerce.number().positive(),
  largo: z.coerce.number().positive(),
  cantidad: z.coerce.number().int().positive(),
  factor: z.coerce.number().positive().default(0.4),
});

const empleadoSchema = z.object({
  nombre: z.string().trim().min(3),
  rol: z.string().trim().min(2),
  fechaIngreso: z.iso.date(),
});

const adelantoSchema = z.object({
  empleadoId: z.string().uuid(),
  fecha: z.iso.date(),
  monto: moneySchema(z.number().positive()),
});

const sueldoSchema = z.object({
  empleadoId: z.string().uuid(),
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Usa un período válido con formato AAAA-MM."),
  montoBruto: moneySchema(z.number().positive()),
  descuentos: moneySchema(z.number().nonnegative()).default(0),
}).refine(data => data.descuentos <= data.montoBruto, { message: "Los descuentos no pueden superar el sueldo bruto.", path: ["descuentos"] });

const clienteSchema = z.object({
  nombre: z.string().trim().min(3),
  documento: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  ruc: z.string().trim().optional(),
  direccion: z.string().trim().optional(),
  tipoPersona: z.enum(["natural", "empresa", ""]).optional(),
});

const choferSchema = z.object({
  nombre: z.string().min(3),
  telefono: z.string().optional(),
  placa: z.string().optional(),
  tipo_vehiculo: z.string().optional(),
});

const zonaEntregaSchema = z.object({
  nombre: z.string().min(3),
  distanciaKm: z.coerce.number().nonnegative(),
  tarifa: moneySchema(z.number().nonnegative()),
});

const metodoPagoEnum = z.enum([
  "efectivo",
  "yape",
  "transferencia",
  "billetera_digital",
  "otro",
]);
const modalidadPagoEnum = z.enum(["contado", "adelanto", "adelanto_saldo", "credito"]);
const tipoEntregaEnum = z.enum(["puesto_en_obra", "entrega_local", "envio"]);
const estadoEntregaEnum = z.enum(["pendiente", "en_proceso", "entregado"]);

const muebleCatalogoSchema = z.object({
  codigo: z.string().min(2),
  nombre: z.string().min(3),
  descripcion: z.string().optional(),
  precioLista: moneySchema(z.number().nonnegative()),
  stockDisponible: z.coerce.number().int().nonnegative().default(0),
  fotoUrl: z.string().optional(),
});

const ventaMuebleTerminadoSchema = z.object({
  clienteId: z.string().uuid(),
  muebleCatalogoId: z.string().uuid(),
  cantidad: z.coerce.number().int().positive(),
  precioUnitario: moneySchema(z.number().positive()),
  fecha: z.iso.date(),
  choferId: z.string().uuid().optional().or(z.literal("")),
  tipoEntrega: tipoEntregaEnum.default("envio"),
  direccionEntrega: z.string().optional(),
  estadoEntrega: estadoEntregaEnum.default("pendiente"),
  metodoPago: metodoPagoEnum.default("efectivo"),
  modalidadPago: modalidadPagoEnum.default("contado"),
  fechaPagoCredito: z.iso.date().optional().or(z.literal("")),
  adelanto: moneySchema(z.number().nonnegative()).optional().default(0),
  montoCredito: moneySchema(z.number().nonnegative()).optional().default(0),
  tipoComprobante: z.enum(["factura", "boleta", "ninguno"]).optional().default("ninguno"),
  urlComprobante: z.string().optional().nullable(),
});

const aprobarCotizacionSchema = z.object({
  cotizacionId: z.string().uuid(),
  notas: z.string().optional(),
  /** Monto del adelanto cobrado al aceptar (si > 0 se asienta en caja). */
  adelanto: moneySchema(z.number().nonnegative()).optional(),
  metodoAdelanto: z.enum(["efectivo", "yape", "banco", "otro"]).optional(),
});

const cambiarEstadoOrdenSchema = z.object({
  ordenId: z.string().uuid(),
  nuevoEstado: z.enum(["en_produccion", "terminado", "entregado"]),
});

const ventaMaderaCortadaSchema = z.object({
  clienteId: z.string().uuid(),
  fecha: z.iso.date(),
  tipoCorte: z.enum(["tabla", "liston", "cuarton", "poste"]),
  totalPt: z.preprocess(preprocessDecimal, z.coerce.number().positive()),
  precioPorPt: moneySchema(z.number().nonnegative()),
  cantidadPiezas: z.preprocess(preprocessDecimal, z.coerce.number().nonnegative()).optional().default(0),
  precioUnitarioComercial: moneySchema(z.number().nonnegative()).optional().default(0),
  total: moneySchema(z.number().nonnegative()),
  metodoPago: metodoPagoEnum.default("efectivo"),
  modalidadPago: modalidadPagoEnum.default("contado"),
  fechaPagoCredito: z.iso.date().optional().or(z.literal("")),
  adelanto: moneySchema(z.number().nonnegative()).optional().default(0),
  montoCredito: moneySchema(z.number().nonnegative()).optional().default(0),
  choferId: z.string().uuid().optional().or(z.literal("")),
  tipoEntrega: tipoEntregaEnum.default("envio"),
  direccionEntrega: z.string().optional(),
  estadoEntrega: estadoEntregaEnum.default("pendiente"),
  inventarioProductoId: z.string().uuid().optional().or(z.literal("")),
  tipoComprobante: z.enum(["factura", "boleta", "ninguno"]).optional().default("ninguno"),
  urlComprobante: z.string().optional().nullable(),
});

const contratoAlquilerSchema = z.object({
  clienteId: z.string().uuid(),
  activo: z.string().min(2),
  codigo: z.string().optional(),
  representante: z.string().optional(),
  rucEmpresa: z.string().optional(),
  direccionEjecucion: z.string().optional(),
  fechaInicio: z.iso.date(),
  fechaTermino: z.iso.date().optional().or(z.literal("")),
  diasAlquiler: z.coerce.number().int().positive().optional(),
  tarifaUnidad: z.enum(["hora_maquina", "m3", "dia"]).default("hora_maquina"),
  tarifa: moneySchema(z.number().positive()),
  montoTotal: moneySchema(z.number().positive()),
  metodoPago: metodoPagoEnum.default("efectivo"),
  modalidadPago: modalidadPagoEnum.default("adelanto"),
  fechaPagoCredito: z.iso.date().optional().or(z.literal("")),
  adelanto: moneySchema(z.number().nonnegative()).optional().default(0),
  montoCredito: moneySchema(z.number().nonnegative()).optional().default(0),
  penalidadRetrasoPagoPct: z.coerce.number().nonnegative().optional().default(3),
  penalidadDevolucionTardiaPct: z.coerce.number().nonnegative().optional().default(3),
  penalidadDaniosPct: z.coerce.number().nonnegative().optional().default(3),
});

const cerrarContratoSchema = z.object({
  contratoId: z.string().uuid(),
  fechaCierre: z.iso.date(),
  observaciones: z.string().optional(),
  retrasoPago: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(false),
  devolucionTardia: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(false),
  danios: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(false),
});


const servicioAserraderoSchema = z.object({
  clienteId: z.string().uuid(),
  fecha: z.iso.date(),
  piesCubicos: z.preprocess(preprocessDecimal, z.coerce.number().positive()),
  costoCubicaje: moneySchema(z.number().nonnegative()),
  precioCobrado: moneySchema(z.number().positive()),
  lineas: z.string().optional(), // JSON con desglose si aplica
  metodoPago: metodoPagoEnum.default("efectivo"),
  modalidadPago: modalidadPagoEnum.default("contado"),
  fechaPagoCredito: z.iso.date().optional().or(z.literal("")),
  adelanto: moneySchema(z.number().nonnegative()).optional().default(0),
  tipoComprobante: z.enum(["factura", "boleta", "ninguno"]).optional().default("ninguno"),
  urlComprobante: z.string().optional().nullable(),
});

const proveedorSchema = z.object({
  nombre: z.string().min(3),
  documento: z.string().optional(),
  telefono: z.string().optional(),
  tipo_proveedor: z.string().optional(),
});

const inventarioProductoSchema = z.object({
  codigo: z.string().trim().min(2),
  nombre: z.string().trim().min(2),
  categoria: z.string().min(2),
  unidad: z.string().min(1),
  stockMinimo: z.coerce.number().nonnegative(),
  fotoUrl: z.string().optional().nullable(),
  stockInicial: z.coerce.number().nonnegative(),
  costoUnitario: z.preprocess(v => v === null || v === "" ? undefined : v, z.coerce.number().nonnegative().optional()),
});

const inventarioMovimientoSchema = z.object({
  productoId: z.string().uuid(),
  fecha: z.iso.date(),
  tipo: z.enum(["entrada_compra", "salida_venta", "ajuste"]),
  cantidad: z.coerce.number().positive(),
  costoUnitario: inventarioCostoUnitarioOpcionalSchema,
  referencia: z.string().optional(),
});

const inventarioCompraRapidaSchema = z.object({
  productoId: z.string().uuid(),
  cantidad: z.preprocess(preprocessDecimal, z.coerce.number().positive()),
  costoUnitario: z.preprocess(
    (value) => {
      const processed = preprocessDecimal(value);
      return (processed === null || processed === undefined) ? undefined : processed;
    },
    z.number().nonnegative().optional(),
  ).transform((value) => value === undefined ? undefined : money(value)),
  proveedor: z.string().optional(),
  fecha: z.iso.date(),
  nota: z.string().optional(),
  tipoComprobante: z.enum(["factura", "boleta", "ninguno"]).optional().default("ninguno"),
  urlComprobante: z.string().optional().nullable(),
});

const inventarioProductoUpdateSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string().min(2),
  nombre: z.string().min(2),
  categoria: z.string().min(2),
  unidad: z.string().min(1),
  stockMinimo: z.coerce.number().nonnegative(),
  stockActual: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().nonnegative().optional(),
  ),
  fotoUrl: z.string().optional().nullable(),
  costoUnitario: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : preprocessDecimal(v)),
    z.number().nonnegative().optional(),
  ).transform((value) => value === undefined ? undefined : money(value)),
});

const inventarioToggleActivoSchema = z.object({
  id: z.string().uuid(),
  activo: z.preprocess((v) => v === "true" || v === true || v === "on", z.boolean()),
});

const inventarioDeleteProductoSchema = z.object({
  id: z.string().uuid(),
  /** Si es true, elimina todos los movimientos del kardex del producto y luego el producto. */
  forzarConMovimientos: z.boolean().optional().default(false),
});

const muebleCatalogoUpdateSchema = z.object({
  id: z.string().uuid(),
  descripcion: z.string().optional(),
  precioLista: moneySchema(z.number().nonnegative()),
  fotoUrl: z.string().optional(),
});

const muebleCatalogoToggleSchema = z.object({
  id: z.string().uuid(),
  activo: z.preprocess((v) => v === "true" || v === true || v === "on", z.boolean()),
});

const inventarioDeleteMovimientoSchema = z.object({
  id: z.string().uuid(),
});

const inventarioConteoSchema = z.object({
  productoId: z.string().uuid(),
  fecha: z.iso.date(),
  stockContado: z.coerce.number().nonnegative(),
  referencia: z.string().min(3),
});

const registroGeneralSchema = z.object({
  categoriaId: z.string().uuid(),
  fecha: z.iso.date(),
  titulo: z.string().trim().min(3),
  detalle: z.string().trim().optional(),
  monto: z.preprocess(
    (value) => (value === "" || value === null ? undefined : preprocessDecimal(value)),
    z.number().nonnegative().optional(),
  ).transform((value) => value === undefined ? undefined : money(value)),
});

const writerRoles: readonly AppRole[] = ["owner_admin", "gerencia", "almacen", "ventas"];
const ventasRoles: readonly AppRole[] = ["owner_admin", "gerencia", "ventas"];
const cajaRoles: readonly AppRole[] = ["owner_admin", "gerencia", "caja", "operaciones_caja"];
const rrhhRoles: readonly AppRole[] = ["owner_admin", "gerencia", "rrhh"];
const liderazgoRoles: readonly AppRole[] = ["owner_admin", "gerencia"];

async function requireMutationAccess(allowedRoles: readonly AppRole[]) {
  const context = await requireAuthContext({
    allowedRoles,
    redirectTo: null,
  });
  if (context.uiRole === "readonly") {
    throw new Error("Acceso denegado: tu usuario tiene permiso de solo lectura.");
  }
  return context;
}

/** Alineado con `mapMetodoPagoToMedio` del demo-store → columnas `medio` en caja. */
function mapMetodoPagoVentaToMedioCaja(
  metodo: "efectivo" | "yape" | "transferencia" | "billetera_digital" | "otro",
): "efectivo" | "banco" | "yape" | "otro" {
  switch (metodo) {
    case "efectivo":
      return "efectivo";
    case "yape":
    case "billetera_digital":
      return "yape";
    case "transferencia":
      return "banco";
    default:
      return "otro";
  }
}

function maybeRedirectToQuickStep(formData: FormData) {
  const returnTo = String(formData.get("return_to") ?? "").trim();
  if (!returnTo) return;
  const nextQuick = String(formData.get("next_quick") ?? "").trim();
  if (!nextQuick) {
    redirect(returnTo);
  }
  redirect(`${returnTo}?quick=${encodeURIComponent(nextQuick)}`);
}

export async function createCajaMovimiento(formData: FormData) {
  const actor = await requireMutationAccess(cajaRoles);
  const parsed = cajaMovimientoSchema.safeParse({
    movimientoId: formData.get("movimiento_id"),
    fecha: formData.get("fecha"),
    tipo: formData.get("tipo"),
    medio: formData.get("medio"),
    monto: formData.get("monto"),
    descripcion: formData.get("descripcion"),
    urlComprobante: formData.get("url_comprobante"),
    categoria: formData.get("categoria"),
    esPersonal: formData.get("es_personal"),
    tipoComprobante: formData.get("tipo_comprobante") ?? "ninguno",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Revisa los datos del movimiento.");
  }

  const payload = {
    id: parsed.data.movimientoId ?? randomUUID(),
    organization_id: actor.organizationId,
    fecha: parsed.data.fecha,
    tipo: parsed.data.tipo,
    medio: parsed.data.medio,
    categoria: parsed.data.categoria,
    monto: parsed.data.monto,
    descripcion: parsed.data.descripcion,
    modulo_origen: "caja",
    es_personal: parsed.data.esPersonal,
    url_comprobante: parsed.data.urlComprobante,
    tipo_comprobante: parsed.data.tipoComprobante,
  };

  if (!hasSupabaseEnv()) {
    const previa = demoCajaMovimientoById(payload.id, actor.organizationId);
    if (previa) {
      if (!cajaReintentoCoincide(previa, payload)) throw new Error(CAJA_REINTENTO_CONFLICTO);
    } else demoCreateCaja(payload);
  } else {
    const supabase = getSupabaseServerClient();
    // La clave primaria existente garantiza un solo registro incluso con envíos simultáneos.
    const { error } = await supabase.from("movimientos_caja").insert(payload);
    if (error?.code === "23505") {
      const { data: previa, error: lecturaError } = await supabase.from("movimientos_caja")
        .select("*").eq("id", payload.id).eq("organization_id", actor.organizationId).maybeSingle();
      if (lecturaError) throw new Error("No se pudo confirmar el primer envío. Vuelve a intentarlo sin cerrar este formulario.");
      if (!previa || !cajaReintentoCoincide(previa, payload)) throw new Error(CAJA_REINTENTO_CONFLICTO);
    } else if (error) throw new Error("No se pudo confirmar el guardado. Vuelve a intentarlo sin cerrar este formulario.");
  }

  revalidatePath("/caja");
  revalidatePath("/");
}

/**
 * Genera copias de los egresos del mes anterior en el mes actual, con el mismo día.
 * Útil para gastos recurrentes (luz, planilla, alquiler, etc.).
 */
export async function repetirGastosMesAnterior(_formData: FormData) {
  void _formData;
  await requireMutationAccess(cajaRoles);
  throw new Error('La repetición antigua de gastos no está disponible. Registra cada gasto desde Caja.');
}

export async function importarArchivo(_formData: FormData) {
  void _formData;
  await requireMutationAccess(cajaRoles);
  throw new Error('El importador antiguo no está disponible. Registra los movimientos desde su apartado habitual.');
}

export async function restaurarRespaldoJSON(formData: FormData) {
  await requireMutationAccess(["owner_admin", "gerencia"] as const);
  const file = formData.get("archivo");
  const confirmacion = String(formData.get("confirmacion") ?? "");
  if (confirmacion !== "RESTAURAR") {
    throw new Error('Escribe "RESTAURAR" en el campo de confirmación.');
  }
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Adjunta el archivo JSON del respaldo.");
  }
  if (hasSupabaseEnv()) {
    throw new Error("El respaldo JSON solo aplica al store local.");
  }
  if (file.size > 25 * 1024 * 1024 || !file.name.toLowerCase().endsWith(".json")) throw new Error("Usa un respaldo .json de hasta 25 MB.");
  const text = await file.text();
  const { demoImportStore } = await import("@/lib/demo-store");
  const { creados } = demoImportStore(text);
  if (creados === 0) {
    throw new Error("El archivo no contiene datos válidos.");
  }
  revalidatePath("/", "layout");
}

export async function submitRestaurarRespaldo(formData: FormData): Promise<{error?: string; success?: string}> {
  try { await restaurarRespaldoJSON(formData); return {success:"Respaldo restaurado correctamente."}; }
  catch(error) { return {error:error instanceof SyntaxError ? "El archivo no contiene un JSON válido. No se restauraron datos." : error instanceof Error ? error.message : "No se pudo restaurar el archivo."}; }
}

/**
 * Elimina los datos operativos del store local y lo reinicia al estado base.
 * Requiere confirmación explícita para evitar borrados accidentales.
 */
export async function eliminarDatosSistema(formData: FormData) {
  await requireMutationAccess(["owner_admin", "gerencia"] as const);
  const confirmacion = String(formData.get("confirmacion") ?? "").trim();
  const confirmacionFinal = String(formData.get("confirmacion_final") ?? "").trim();
  if (confirmacion !== "ELIMINAR TODO" || confirmacionFinal !== "ELIMINAR TODO") {
    throw new Error('Escribe "ELIMINAR TODO" en ambos campos de confirmación.');
  }
  if (hasSupabaseEnv()) {
    throw new Error("La eliminación total solo está habilitada para el store local.");
  }
  demoResetStore();
  revalidatePath("/", "layout");
}

export async function eliminarDatosPorCategoria(formData: FormData) {
  await requireMutationAccess(["owner_admin", "gerencia"] as const);
  const categoria = String(formData.get("categoria") ?? "").trim();
  const confirmacion = String(formData.get("confirmacion_categoria") ?? "").trim();
  if (confirmacion !== "ELIMINAR CATEGORIA") {
    throw new Error('Escribe "ELIMINAR CATEGORIA" para confirmar.');
  }
  if (hasSupabaseEnv()) {
    throw new Error("La eliminación por categoría solo está habilitada para el store local.");
  }
  demoDeleteByCategory(categoria);
  revalidatePath("/", "layout");
}

export async function eliminarDatoIndividual(formData: FormData) {
  await requireMutationAccess(["owner_admin", "gerencia"] as const);
  const categoria = String(formData.get("categoria") ?? "").trim();
  const id = String(formData.get("id_registro") ?? "").trim();
  const confirmacion = String(formData.get("confirmacion_item") ?? "").trim();
  if (!id) {
    throw new Error("Ingresa el ID del registro a eliminar.");
  }
  if (confirmacion !== "ELIMINAR REGISTRO") {
    throw new Error('Escribe "ELIMINAR REGISTRO" para confirmar.');
  }
  if (hasSupabaseEnv()) {
    throw new Error("La eliminación individual solo está habilitada para el store local.");
  }
  const { eliminados } = demoDeleteOneById(categoria, id);
  if (eliminados === 0) {
    throw new Error("No se encontró un registro con ese ID en la categoría seleccionada.");
  }
  revalidatePath("/", "layout");
}

export async function createVentaMadera(formData: FormData) {
    const actor = await requireMutationAccess(ventasRoles);
    const parsed = ventaSchema.safeParse({
        clienteId: formData.get("cliente_id"),
        fecha: formData.get("fecha"),
        total: formData.get("total"),
        estado: formData.get("estado"),
        metodoPago: formData.get("metodo_pago") ?? undefined,
        modalidadPago: formData.get("modalidad_pago") ?? undefined,
        adelanto: formData.get("adelanto") ?? undefined,
        fechaPagoCredito: formData.get("fecha_pago_credito") ?? undefined,
        productoInventarioId: formData.get("inventario_producto_id"),
        cantidadProducto: formData.get("cantidad_producto"),
        tipoComprobante: formData.get("tipo_comprobante") || "ninguno",
        urlComprobante: formData.get("url_comprobante"),
    });
    if (!parsed.success) {
        throw new Error("Datos de venta inválidos.");
    }
    const modalidadPago = parsed.data.modalidadPago === "adelanto_saldo" ? "adelanto" : parsed.data.modalidadPago;
    const adelanto = modalidadPago === "adelanto" ? parsed.data.adelanto : 0;
    const montoCaja = montoCobradoVenta(parsed.data.total, modalidadPago, adelanto);
    const clienteNombre = await nombreClienteOperacion(parsed.data.clienteId, actor.organizationId);
    const descripcionCaja = 'Venta de madera - ' + clienteNombre;
    const correlativo = await nextCorrelativo('venta_madera', Number(parsed.data.fecha.slice(0, 4)) || new Date().getFullYear());
    const stock = parsed.data.estado === 'confirmada' && parsed.data.productoInventarioId && parsed.data.cantidadProducto
        ? [{ producto_id: parsed.data.productoInventarioId, cantidad: parsed.data.cantidadProducto,
            costo_unitario: safeDivide(parsed.data.total, parsed.data.cantidadProducto) }] : [];
    const caja = montoCaja > 0 ? { fecha: parsed.data.fecha, tipo: 'ingreso', medio: mapMetodoPagoVentaToMedioCaja(parsed.data.metodoPago),
        categoria: 'venta_madera', monto: montoCaja, descripcion: descripcionCaja, tipo_comprobante: parsed.data.tipoComprobante,
        url_comprobante: parsed.data.urlComprobante ?? null } : null;
    await registrarOperacionIntegral(actor, { tipo: 'venta_madera', clave: claveOperacion(formData),
        documento: { cliente_id: parsed.data.clienteId, fecha: parsed.data.fecha, total: parsed.data.total, estado: parsed.data.estado, correlativo,
            metodo_pago: parsed.data.metodoPago, modalidad_pago: modalidadPago, adelanto, fecha_pago_credito: parsed.data.fechaPagoCredito || null },
        lineas: parsed.data.cantidadProducto ? [{ item_id: null, cantidad: parsed.data.cantidadProducto, precio_unitario: safeDivide(parsed.data.total, parsed.data.cantidadProducto) }] : [],
        stock, caja: parsed.data.estado === 'confirmada' ? caja : null });
    revalidatePath('/ventas');
    revalidatePath('/caja');
    revalidatePath('/');
    maybeRedirectToQuickStep(formData);
}

/** Wrapper con MutationFormState para useActionState (cierre automático del modal). */
export async function submitCreateVentaMaderaForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await createVentaMadera(formData);
    return { success: true, error: null, message: "Venta registrada correctamente." };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo registrar la venta.",
      message: null,
    };
  }
}

export async function createCliente(formData: FormData) {
  await requireMutationAccess(writerRoles);
  const parsed = clienteSchema.safeParse({
    nombre: formData.get("nombre"),
    documento: formData.get("documento") ?? "",
    telefono: formData.get("telefono") ?? "",
    ruc: formData.get("ruc") ?? "",
    direccion: formData.get("direccion") ?? "",
    tipoPersona: formData.get("tipo_persona") ?? "",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.some(issue => issue.path[0] === "nombre")
      ? "El nombre debe tener al menos 3 caracteres, sin contar espacios."
      : "Datos de cliente inválidos.");
  }
  const tipoPersona =
    parsed.data.tipoPersona === "natural" || parsed.data.tipoPersona === "empresa"
      ? parsed.data.tipoPersona
      : null;
  if (!hasSupabaseEnv()) {
    const newId = demoCreateCliente({
      organization_id: DEFAULT_ORG_ID,
      nombre: parsed.data.nombre,
      documento: parsed.data.documento || parsed.data.ruc || null,
      telefono: parsed.data.telefono || null,
      ruc: parsed.data.ruc || null,
      direccion: parsed.data.direccion || null,
      tipo_persona: tipoPersona,
      estado: "activo",
    });
    revalidatePath("/ventas");
    revalidatePath("/ventas/clientes");
    revalidatePath("/alquiler");
    const skipRedirect = formData.get("skip_redirect") === "true";
    if (skipRedirect) return { id: newId, nombre: parsed.data.nombre };
    maybeRedirectToQuickStep(formData);
    return { id: newId, nombre: parsed.data.nombre };
  } else {
    const supabase = getSupabaseServerClient();
    const { data: newCliente, error } = await supabase
      .from("clientes")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        nombre: parsed.data.nombre,
        documento: parsed.data.documento || parsed.data.ruc || null,
        telefono: parsed.data.telefono || null,
        ruc: parsed.data.ruc || null,
        direccion: parsed.data.direccion || null,
        tipo_persona: tipoPersona,
      })
      .select("id")
      .single();
    if (error) {
      throw new Error(error.message);
    }
    revalidatePath("/ventas");
    revalidatePath("/ventas/clientes");
    revalidatePath("/alquiler");
    const skipRedirect = formData.get("skip_redirect") === "true";
    if (skipRedirect) return { id: newCliente.id, nombre: parsed.data.nombre };
    maybeRedirectToQuickStep(formData);
    return { id: newCliente.id, nombre: parsed.data.nombre };
  }
}

const FACTURA_RUC_ERROR = "Para emitir factura, selecciona un cliente con RUC válido de 11 dígitos.";

function isRucValidoFactura(value: string | null | undefined) {
  return /^\d{11}$/.test(String(value ?? "").trim());
}

async function assertClientePuedeEmitirFactura(clienteId: string, tipoComprobante: string) {
  if (tipoComprobante !== "factura") return;

  if (!hasSupabaseEnv()) {
    const cliente = demoClientesRows().find((row) => row.id === clienteId);
    if (!cliente || !isRucValidoFactura(cliente.ruc)) {
      throw new Error(FACTURA_RUC_ERROR);
    }
    return;
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("ruc")
    .eq("id", clienteId)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data || !isRucValidoFactura(data.ruc)) {
    throw new Error(FACTURA_RUC_ERROR);
  }
}
export async function createClienteCotizacionRapida(input: {
  nombre: string;
  documento: string;
  telefono: string;
  direccion: string;
  tipoPersona: "natural" | "empresa";
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireMutationAccess(ventasRoles);
    if (input.nombre.trim().length < 2) {
      return { ok: false, error: "Ingresa el nombre o razón social." };
    }
    if (!["natural", "empresa"].includes(input.tipoPersona)) return { ok: false, error: "Selecciona persona natural o empresa." };
    const errorCliente = documentoClienteError(input.tipoPersona, input.documento, false) || telefonoClienteError(input.telefono);
    if (errorCliente) return { ok: false, error: errorCliente };
    if (!hasSupabaseEnv()) {
      const id = demoCreateCliente({
        organization_id: DEFAULT_ORG_ID,
        nombre: input.nombre.trim(),
        documento: input.documento.trim() || null,
        telefono: input.telefono.trim() || null,
        ruc: input.tipoPersona === "empresa" ? (input.documento.trim() || null) : null,
        direccion: input.direccion.trim() || null,
        tipo_persona: input.tipoPersona,
      });
      revalidatePath("/cotizacion");
      revalidatePath("/ventas");
      return { ok: true, id };
    }
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        nombre: input.nombre.trim(),
        documento: input.documento.trim() || null,
        telefono: input.telefono.trim() || null,
        direccion: input.direccion.trim() || null,
        tipo_persona: input.tipoPersona,
        ruc: input.tipoPersona === "empresa" ? (input.documento.trim() || null) : null,
      })
      .select("id")
      .single();
    if (error) {
      return { ok: false, error: error.message };
    }
    revalidatePath("/cotizacion");
    revalidatePath("/ventas");
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ocurrio un problema, intenta de nuevo." };
  }
}

export async function updateClienteCotizacionRapida(
  clienteId: string,
  input: Parameters<typeof createClienteCotizacionRapida>[0],
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireMutationAccess(ventasRoles);
    const parsed = z.object({
      id: z.string().uuid("El cliente registrado no es válido."),
      nombre: z.string().trim().min(2, "Ingresa el nombre o razón social."),
      documento: z.string().trim(),
      telefono: z.string().trim(),
      direccion: z.string().trim(),
      tipoPersona: z.enum(["natural", "empresa"]),
    }).safeParse({ ...input, id: clienteId });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const errorCliente = documentoClienteError(parsed.data.tipoPersona, parsed.data.documento, false) || telefonoClienteError(parsed.data.telefono);
    if (errorCliente) return { ok: false, error: errorCliente };
    const datos = {
      nombre: parsed.data.nombre,
      documento: parsed.data.documento || null,
      telefono: parsed.data.telefono || null,
      direccion: parsed.data.direccion || null,
      tipo_persona: parsed.data.tipoPersona,
      ruc: parsed.data.tipoPersona === "empresa" ? parsed.data.documento || null : null,
    };
    if (!hasSupabaseEnv()) {
      if (!demoUpdateClienteDatos(clienteId, DEFAULT_ORG_ID, datos)) {
        return { ok: false, error: "No se encontró el cliente registrado. Vuelve a seleccionarlo." };
      }
    } else {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase.from("clientes")
        .update(datos)
        .eq("id", clienteId)
        .eq("organization_id", DEFAULT_ORG_ID)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      if (!data) return { ok: false, error: "No se encontró el cliente registrado. Vuelve a seleccionarlo." };
    }
    revalidatePath("/cotizacion");
    revalidatePath("/ventas");
    return { ok: true, id: clienteId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ocurrió un problema, intenta de nuevo." };
  }
}

export async function ensureClientesGenericosCotizacion(): Promise<
  { ok: true; created: number; reused: number } | { ok: false; error: string }
> {
  try {
    await requireMutationAccess(ventasRoles);

    const baseClientes = [
      {
        nombre: "Cliente Genérico Natural",
        documento: "12345678",
        telefono: "900111222",
        direccion: "Av. Prueba 123, Tarapoto",
        tipoPersona: "natural" as const,
      },
      {
        nombre: "Cliente Genérico Empresa SAC",
        documento: "20123456789",
        telefono: "900333444",
        direccion: "Jr. Comercio 456, Tarapoto",
        tipoPersona: "empresa" as const,
      },
    ];

    let created = 0;
    let reused = 0;

    if (!hasSupabaseEnv()) {
      const { demoClientesRows } = await import("@/lib/demo-store");
      const current = demoClientesRows();
      for (const c of baseClientes) {
        const exists = current.some((row) => (row.documento ?? "") === c.documento);
        if (exists) {
          reused += 1;
          continue;
        }
        demoCreateCliente({
          organization_id: DEFAULT_ORG_ID,
          nombre: c.nombre,
          documento: c.documento,
          telefono: c.telefono,
          ruc: c.tipoPersona === "empresa" ? c.documento : null,
          direccion: c.direccion,
          tipo_persona: c.tipoPersona,
        });
        created += 1;
      }
    } else {
      const supabase = getSupabaseServerClient();
      for (const c of baseClientes) {
        const { data: existing } = await supabase
          .from("clientes")
          .select("id")
          .eq("organization_id", DEFAULT_ORG_ID)
          .eq("documento", c.documento)
          .maybeSingle();
        if (existing) {
          reused += 1;
          continue;
        }
        const { error } = await supabase.from("clientes").insert({
          organization_id: DEFAULT_ORG_ID,
          nombre: c.nombre,
          documento: c.documento,
          telefono: c.telefono,
        });
        if (error) {
          return { ok: false, error: error.message };
        }
        created += 1;
      }
    }

    revalidatePath("/cotizacion");
    revalidatePath("/ventas");
    return { ok: true, created, reused };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ocurrio un problema, intenta de nuevo." };
  }
}

export async function saveCotizacionUnificada(input: {
  id?: string;
  submissionId?: string;
  clienteId: string;
  tipoCliente: "natural" | "empresa";
  fecha: string;
  detalle: unknown;
  total: unknown;
  estadoFlujo: "pendiente" | "lista_produccion";
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const actor = await requireMutationAccess(ventasRoles);
    const identidad = cotizacionUnificadaIdentidadSchema.safeParse(input);
    if (!identidad.success) return { ok: false, error: 'Datos de cotización inválidos. Revisa cliente, fecha y estado; si la página es antigua, actualízala antes de guardar.' };
    const detParsed = cotizacionDetalleV1Schema.safeParse(input.detalle);
    if (!detParsed.success) {
      return { ok: false, error: "Detalle de cotización inválido." };
    }
    const det = detParsed.data;
    const supabase = hasSupabaseEnv() ? getSupabaseServerClient() : null;
    let cotizacionAnterior: {
      estado_flujo: CotizacionUnificadaRow["estado_flujo"];
      total: number;
      detalle: unknown;
    } | null = null;

    if (input.id) {
      if (!supabase) {
        const previaDemo = demoGetCotizacionUnificada(input.id);
        if (!previaDemo || previaDemo.deleted_at) {
          return { ok: false, error: "La cotización ya no existe." };
        }
        cotizacionAnterior = previaDemo;
      } else {
        const { data: previaSupabase } = await supabase
          .from("cotizaciones_unificadas")
          .select("estado_flujo,total,detalle")
          .eq("id", input.id)
          .eq("organization_id", DEFAULT_ORG_ID)
          .is("deleted_at", null)
          .maybeSingle();
        if (!previaSupabase) {
          return { ok: false, error: "La cotización ya no existe." };
        }
        cotizacionAnterior = previaSupabase;
      }
      if (cotizacionAnterior.estado_flujo === "cobrada") {
        return { ok: false, error: "No se puede editar una cotización ya cobrada." };
      }
    }

    const empresa = await getEmpresaConfig();
    let margenPctAutorizado = empresa.margen_ganancia_default_pct;
    if (cotizacionAnterior) {
      const detalleAnterior = parseCotizacionDetalle(cotizacionAnterior.detalle);
      const calculoAnterior = resolverCalculoDocumentoCotizacion(
        detalleAnterior,
        cotizacionAnterior.total,
      );
      if (calculoAnterior.margenPctAplicado == null) {
        return {
          ok: false,
          error: "No se puede recalcular esta cotización histórica sin un margen verificable.",
        };
      }
      margenPctAutorizado = calculoAnterior.margenPctAplicado;
    }
    const calculo = calcularContratoCotizacion(det, margenPctAutorizado);
    if (!totalClienteCoincideConServidor(input.total, calculo.totalFinal)) {
      return { ok: false, error: "El total no coincide con el detalle. Revisa los importes." };
    }
    const errorPago = validarCondicionesPagoCotizacion(det.condiciones_pago, calculo.totalFinal);
    if (errorPago) return { ok: false, error: errorPago };
    const detalleConResumen = {
      ...det,
      resumenCalculo: crearInstantaneaCalculoCotizacion(calculo),
    };
    const detalleRecord = JSON.parse(JSON.stringify(detalleConResumen)) as Record<string, unknown>;
    // Guardar cambios no devuelve a pendiente una propuesta ya aceptada o en producción.
    const estadoFlujo = cotizacionAnterior && (
      input.estadoFlujo === "pendiente" ||
      !["pendiente", "lista_produccion"].includes(cotizacionAnterior.estado_flujo)
    ) ? cotizacionAnterior.estado_flujo : input.estadoFlujo;

    if (!supabase) {
      if (input.id) {
        demoUpdateCotizacionUnificada(input.id, {
          cliente_id: input.clienteId,
          tipo_cliente: input.tipoCliente,
          fecha: input.fecha,
          total: calculo.totalFinal,
          estado_flujo: estadoFlujo,
          detalle: detalleRecord,
        });
        revalidatePath("/cotizacion");
        return { ok: true, id: input.id };
      }
    }

    if (input.id && supabase) {
      const { error } = await supabase.rpc('editar_cotizacion_unificada_segura', {
        p_org: actor.organizationId, p_actor: actor.userId, p_id: input.id,
        p_datos: { cliente_id: input.clienteId, tipo_cliente: input.tipoCliente, fecha: input.fecha,
          total: calculo.totalFinal, estado_flujo: estadoFlujo, detalle: detalleConResumen },
        p_total_esperado: cotizacionAnterior!.total, p_estado_esperado: cotizacionAnterior!.estado_flujo,
      });
      if (error) return { ok: false, error: error.message };
      revalidatePath("/cotizacion");
      return { ok: true, id: input.id };
    }
    const correlativo = await nextCorrelativo("cotizacion");
    const id = await registrarCotizacionUnificada(actor, identidad.data.submissionId!, {
        organization_id: actor.organizationId,
        cliente_id: input.clienteId,
        fecha: input.fecha,
        correlativo,
        tipo_cliente: input.tipoCliente,
        total: calculo.totalFinal,
        estado_flujo: input.estadoFlujo,
        detalle: detalleRecord,
      });
    revalidatePath("/cotizacion");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ocurrio un problema, intenta de nuevo." };
  }
}

export async function deleteCotizacionUnificada(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireMutationAccess(ventasRoles);
    if (!hasSupabaseEnv()) {
      const ok = demoDeleteCotizacionUnificada(id);
      if (!ok) {
        return { ok: false, error: "No se pueden eliminar cotizaciones ya cobradas." };
      }
      revalidatePath("/cotizacion");
      return { ok: true };
    }
    const supabase = getSupabaseServerClient();
    const { data: row } = await supabase
      .from("cotizaciones_unificadas")
      .select("estado_flujo")
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .is("deleted_at", null)
      .maybeSingle();
    if (!row || row.estado_flujo === "cobrada") {
      return { ok: false, error: "No se pueden eliminar cotizaciones ya cobradas." };
    }
    const { data: deleted, error } = await supabase
      .from("cotizaciones_unificadas")
      .delete()
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .neq("estado_flujo", "cobrada")
      .is("deleted_at", null)
      .select("id");
    if (error) {
      return { ok: false, error: error.message };
    }
    if (!deleted?.length) return { ok: false, error: "La cotización cambió o ya está cobrada. Actualiza antes de eliminar." };
    revalidatePath("/cotizacion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ocurrio un problema, intenta de nuevo." };
  }
}

export async function cambiarEstadoCotizacionUnificada(
  id: string,
  nuevoEstado: "pendiente" | "lista_produccion" | "en_produccion" | "terminado" | "entregado" | "cobrada" | "inactivo" | "deudor",
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireMutationAccess(ventasRoles);
    if (!["pendiente", "lista_produccion", "en_produccion", "terminado", "entregado", "inactivo", "deudor"].includes(nuevoEstado)) {
      return { ok: false, error: "Para marcarla como cobrada, registra el cobro total en Caja." };
    }
    if (!hasSupabaseEnv()) {
      const row = demoGetCotizacionUnificada(id);
      if (!row || row.deleted_at) {
        return { ok: false, error: "Cotización no encontrada." };
      }
      if (row.estado_flujo === "cobrada") return { ok: false, error: "No se puede cambiar el estado de una cotización ya cobrada." };
      demoUpdateCotizacionUnificada(id, { estado_flujo: nuevoEstado });
      revalidatePath("/cotizacion");
      return { ok: true };
    }
    const supabase = getSupabaseServerClient();
    const { data: updated, error } = await supabase
      .from("cotizaciones_unificadas")
      .update({ estado_flujo: nuevoEstado as string })
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .is("deleted_at", null)
      .neq("estado_flujo", "cobrada")
      .select("id");
    if (error) {
      return { ok: false, error: error.message };
    }
    if (!updated?.length) return { ok: false, error: "La cotización no existe o ya está cobrada." };
    revalidatePath("/cotizacion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ocurrió un problema, intenta de nuevo." };
  }
}

export async function marcarListaProduccionCotizacion(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireMutationAccess(ventasRoles);
    if (!hasSupabaseEnv()) {
      const row = demoGetCotizacionUnificada(id);
      if (!row || row.deleted_at) {
        return { ok: false, error: "Cotización no encontrada." };
      }
      if (row.estado_flujo === "cobrada") {
        return { ok: false, error: "No se puede cambiar el estado de una cotización ya cobrada." };
      }
      demoUpdateCotizacionUnificada(id, { estado_flujo: "lista_produccion" });
      revalidatePath("/cotizacion");
      return { ok: true };
    }
    const supabase = getSupabaseServerClient();
    const { data: prevLista } = await supabase
      .from("cotizaciones_unificadas")
      .select("estado_flujo")
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .is("deleted_at", null)
      .maybeSingle();
    if (!prevLista) {
      return { ok: false, error: "Cotización no encontrada." };
    }
    if (prevLista.estado_flujo === "cobrada") {
      return { ok: false, error: "No se puede cambiar el estado de una cotización ya cobrada." };
    }
    const { data: updated, error } = await supabase
      .from("cotizaciones_unificadas")
      .update({ estado_flujo: "lista_produccion" })
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .is("deleted_at", null)
      .neq("estado_flujo", "cobrada")
      .select("id");
    if (error) {
      return { ok: false, error: error.message };
    }
    if (!updated?.length) return { ok: false, error: "La cotización cambió o ya está cobrada. Actualiza antes de continuar." };
    revalidatePath("/cotizacion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ocurrio un problema, intenta de nuevo." };
  }
}

/** Acción antigua sustituida por la aprobación conjunta de orden y adelanto. */
export async function pasarCotizacionAProduccion(
  _id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    void _id;
    await requireMutationAccess(ventasRoles);
    return { ok: false, error: 'Usa «Aprobar → Orden + Adelanto» en Muebles personalizados para crear la orden de forma segura.' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo comprobar el acceso.' };
  }
}

export async function consultarCobroCotizacionUnificada(id: string): Promise<
  { ok: true; total: number; cobrado: number; saldo: number } | { ok: false; error: string }
> {
  try {
    const actor = await requireMutationAccess(ventasRoles);
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Cotización inválida." };
    if (!hasSupabaseEnv()) {
      const { demoCajaRows, demoOrdenesProduccionRows } = await import("@/lib/demo-store");
      const row = demoGetCotizacionUnificada(id);
      if (!row || row.deleted_at) return { ok: false, error: "Cotización no encontrada." };
      return { ok: true, ...resumenCobroLocal(Number(row.total), id, DEFAULT_ORG_ID, demoCajaRows(), demoOrdenesProduccionRows()) };
    }
    const { data, error } = await getSupabaseServerClient().rpc("consultar_cobro_cotizacion", {
      p_org: DEFAULT_ORG_ID, p_actor: actor.userId, p_cot: id,
    });
    if (error) return { ok: false, error: mensajeOperacionFinanciera(error) };
    const parsed = z.object({ total: z.number().finite().positive(), cobrado: z.number().finite().nonnegative(), saldo: z.number().finite().nonnegative() }).safeParse(data);
    if (!parsed.success) return { ok: false, error: "No se pudo comprobar el saldo de la cotización." };
    return { ok: true, ...parsed.data };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo comprobar el saldo." }; }
}

export async function registrarCobroCotizacionUnificada(
  id: string,
  cobro: { medio: "efectivo" | "banco" | "yape" | "otro"; totalEsperado: number; saldoEsperado?: number },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireMutationAccess(ventasRoles);
    const datos = z.object({ medio: z.enum(["efectivo", "banco", "yape", "otro"]), totalEsperado: z.number().finite().positive(), saldoEsperado: z.number().finite().positive().optional() }).safeParse(cobro);
    if (!datos.success || !z.uuid().safeParse(id).success) return { ok: false, error: "Confirma el importe y un medio de cobro válido." };
    const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const saldoEsperado = datos.data.saldoEsperado ?? datos.data.totalEsperado;
    if (!hasSupabaseEnv()) {
      const { demoCajaRows, demoOrdenesProduccionRows, demoOperacionAtomica } = await import("@/lib/demo-store");
      demoOperacionAtomica(() => {
        const row = demoGetCotizacionUnificada(id);
        if (!row || row.deleted_at) throw new Error("Cotización no encontrada.");
        if (row.estado_flujo !== "lista_produccion" && row.estado_flujo !== "en_produccion") throw new Error("La cotización cambió o ya está cobrada. Actualiza antes de cobrar.");
        const resumen = resumenCobroLocal(Number(row.total), id, DEFAULT_ORG_ID, demoCajaRows(), demoOrdenesProduccionRows());
        if (!totalClienteCoincideConServidor(datos.data.totalEsperado, resumen.total)) throw new Error("El total cambió. Actualiza antes de cobrar.");
        if (resumen.saldo <= 0) throw new Error("Esta cotización ya tiene un cobro completo registrado en Caja.");
        if (!totalClienteCoincideConServidor(saldoEsperado, resumen.saldo)) throw new Error("El saldo cambió. Actualiza los cobros antes de confirmar.");
        const anterior = row.estado_flujo;
        try {
          demoCreateCaja({ organization_id: DEFAULT_ORG_ID, fecha, tipo: "ingreso", medio: datos.data.medio,
            categoria: "cotizaciones", monto: resumen.saldo, descripcion: "Cobro cotización " + (row.correlativo ?? id.slice(0, 8)),
            modulo_origen: "cotizacion_unificada", referencia_id: id, es_personal: false });
          demoUpdateCotizacionUnificada(id, { estado_flujo: "cobrada" });
        } catch (e) { demoUpdateCotizacionUnificada(id, { estado_flujo: anterior }); throw e; }
      });
    } else {
      const { error } = await getSupabaseServerClient().rpc("registrar_cobro_cotizacion_seguro", {
        p_org: DEFAULT_ORG_ID, p_actor: actor.userId, p_cot: id, p_total_esperado: datos.data.totalEsperado,
        p_saldo_esperado: saldoEsperado, p_medio: datos.data.medio, p_fecha: fecha,
      });
      if (error) return { ok: false, error: mensajeOperacionFinanciera(error) };
    }
    revalidatePath("/cotizacion"); revalidatePath("/caja"); revalidatePath("/ventas");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo confirmar el cobro." }; }
}

export async function cambiarEstadoCotizacion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nuevoEstado = String(formData.get("nuevo_estado") ?? "");
  const estadosValidos = ["pendiente", "lista_produccion", "en_produccion", "terminado", "entregado", "inactivo", "deudor"];
  if (!id) throw new Error("Cotización inválida.");
  if (!estadosValidos.includes(nuevoEstado)) throw new Error("Estado inválido.");
  const resultado = await cambiarEstadoCotizacionUnificada(id, nuevoEstado as "pendiente" | "lista_produccion" | "en_produccion" | "terminado" | "entregado" | "inactivo" | "deudor");
  if (!resultado.ok) throw new Error(resultado.error);
}

export async function createChofer(formData: FormData) {
  await requireMutationAccess(writerRoles);
  const parsed = choferSchema.safeParse({
    nombre: formData.get("nombre"),
    telefono: formData.get("telefono"),
    placa: formData.get("placa"),
    tipo_vehiculo: formData.get("tipo_vehiculo"),
  });
  if (!parsed.success) {
    throw new Error("Datos de chofer inválidos.");
  }
  if (!hasSupabaseEnv()) {
    demoCreateChofer({
      organization_id: DEFAULT_ORG_ID,
      nombre: parsed.data.nombre,
      telefono: parsed.data.telefono || null,
      placa: parsed.data.placa || null,
      tipo_vehiculo: parsed.data.tipo_vehiculo || null,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("choferes").insert({
      organization_id: DEFAULT_ORG_ID,
      nombre: parsed.data.nombre.trim(),
      telefono: parsed.data.telefono?.trim() || null,
      placa: parsed.data.placa?.trim() || null,
      tipo_vehiculo: parsed.data.tipo_vehiculo?.trim() || null,
      activo: true,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/ventas");
  revalidatePath("/personal");
  maybeRedirectToQuickStep(formData);
}

export async function updateChofer(id: string, formData: FormData) {
  await requireMutationAccess(writerRoles);

  const activoVal = formData.get("activo");
  const activo = activoVal === "true" || activoVal === "on" || activoVal === "1";

  const parsed = choferSchema.safeParse({
    nombre: formData.get("nombre"),
    telefono: formData.get("telefono"),
    placa: formData.get("placa"),
    tipo_vehiculo: formData.get("tipo_vehiculo"),
  });
  if (!parsed.success) {
    throw new Error("Datos de chofer inválidos.");
  }

  if (!hasSupabaseEnv()) {
    demoUpdateChofer(id, {
      nombre: parsed.data.nombre,
      telefono: parsed.data.telefono || null,
      placa: parsed.data.placa || null,
      tipo_vehiculo: parsed.data.tipo_vehiculo || null,
      activo,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("choferes")
      .update({
        nombre: parsed.data.nombre.trim(),
        telefono: parsed.data.telefono?.trim() || null,
        placa: parsed.data.placa?.trim() || null,
        tipo_vehiculo: parsed.data.tipo_vehiculo?.trim() || null,
        activo,
      })
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID);
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/ventas");
  revalidatePath("/personal");
}

export async function createZonaEntrega(formData: FormData) {
  if (!FEATURES.zonasEntrega) throw new Error("Este apartado no está habilitado.");
  await requireMutationAccess(writerRoles);
  const parsed = zonaEntregaSchema.safeParse({
    nombre: formData.get("nombre"),
    distanciaKm: formData.get("distancia_km"),
    tarifa: formData.get("tarifa"),
  });
  if (!parsed.success) {
    throw new Error("Datos de zona inválidos.");
  }
  if (!hasSupabaseEnv()) {
    demoCreateZonaEntrega({
      organization_id: DEFAULT_ORG_ID,
      nombre: parsed.data.nombre,
      distancia_km: parsed.data.distanciaKm,
      tarifa: parsed.data.tarifa,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("zonas_entrega").insert({
      organization_id: DEFAULT_ORG_ID,
      nombre: parsed.data.nombre.trim(),
      distancia_km: parsed.data.distanciaKm,
      tarifa: parsed.data.tarifa,
      activo: true,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/ventas");
  revalidatePath("/ventas/zonas-entrega");
  maybeRedirectToQuickStep(formData);
}

export async function createProveedor(formData: FormData) {
  await requireMutationAccess(ventasRoles);
  const parsed = proveedorSchema.safeParse({
    nombre: formData.get("nombre"),
    documento: formData.get("documento"),
    telefono: formData.get("telefono"),
    tipo_proveedor: formData.get("tipo_proveedor"),
  });
  if (!parsed.success) {
    throw new Error("Datos de proveedor inválidos.");
  }
  if (!hasSupabaseEnv()) {
    demoCreateProveedor({
      organization_id: DEFAULT_ORG_ID,
      nombre: parsed.data.nombre,
      documento: parsed.data.documento || null,
      telefono: parsed.data.telefono || null,
      tipo_proveedor: parsed.data.tipo_proveedor || null,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("proveedores").insert({
      organization_id: DEFAULT_ORG_ID,
      nombre: parsed.data.nombre,
      documento: parsed.data.documento || null,
      telefono: parsed.data.telefono || null,
      tipo_proveedor: parsed.data.tipo_proveedor || null,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/ventas");
  maybeRedirectToQuickStep(formData);
}

export async function updateProveedor(id: string, formData: FormData) {
  await requireMutationAccess(ventasRoles);
  const parsed = proveedorSchema.safeParse({
    nombre: formData.get("nombre"),
    documento: formData.get("documento"),
    telefono: formData.get("telefono"),
    tipo_proveedor: formData.get("tipo_proveedor"),
  });
  if (!parsed.success) {
    throw new Error("Datos de proveedor inválidos.");
  }

  if (!hasSupabaseEnv()) {
    demoUpdateProveedor(id, {
      nombre: parsed.data.nombre,
      documento: parsed.data.documento || null,
      telefono: parsed.data.telefono || null,
      tipo_proveedor: parsed.data.tipo_proveedor || null,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("proveedores")
      .update({
        nombre: parsed.data.nombre,
        documento: parsed.data.documento || null,
        telefono: parsed.data.telefono || null,
        tipo_proveedor: parsed.data.tipo_proveedor || null,
      })
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID);
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/ventas");
}

export async function createCompraMadera(_formData: FormData) {
  void _formData;
  await requireMutationAccess(ventasRoles);
  throw new Error('La compra antigua de madera no está disponible. Usa la compra de inventario del apartado Inventario.');
}

export async function createCotizacion(formData: FormData) {
  const actor = await requireMutationAccess(ventasRoles);
  const clave = claveOperacion(formData, true);
  const parsed = cotizacionSchema.safeParse({
    clienteId: formData.get("cliente_id"),
    fecha: formData.get("fecha"),
    tipo: formData.get("tipo"),
    especieMadera: formData.get("especie_madera"),
    unidadMedida: formData.get("unidad_medida"),
    precioCalculado: formData.get("precio_calculado"),
    precioAcordado: formData.get("precio_acordado"),
    motivoAjuste: formData.get("motivo_ajuste"),
    estado: formData.get("estado"),
  });

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Datos de cotización inválidos. Errores: ${errorDetails}`);
  }

  await registrarCotizacionRapida(actor, clave, {
    cliente_id: parsed.data.clienteId,
    fecha: parsed.data.fecha,
    tipo: parsed.data.tipo,
    especie_madera: parsed.data.especieMadera,
    unidad_medida: parsed.data.unidadMedida,
    origen_material: "cliente",
    precio_calculado: parsed.data.precioCalculado,
    precio_acordado: parsed.data.precioAcordado,
    motivo_ajuste: parsed.data.motivoAjuste ?? null,
    estado: parsed.data.estado,
    ...(!hasSupabaseEnv() ? { correlativo: await nextCorrelativo("cotizacion") } : {}),
  });

  revalidatePath("/ventas/muebles-corte");
  revalidatePath("/ventas/muebles-personalizados");
  revalidatePath("/");
}

export async function deleteCotizacionMueblePersonalizada(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireMutationAccess(ventasRoles);
    const parsedId = z.string().uuid().safeParse(id);
    if (!parsedId.success) {
      return { ok: false, error: "Identificador inválido." };
    }
    if (!hasSupabaseEnv()) {
      const res = demoDeleteCotizacionMueblePersonalizada(id, actor.organizationId);
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      revalidatePath("/ventas/muebles-personalizados");
      revalidatePath("/ventas");
      return { ok: true };
    }
    const { error } = await getSupabaseServerClient().rpc('eliminar_cotizacion_mueble_segura', {
      p_org: actor.organizationId, p_actor: actor.userId, p_id: id,
    });
    if (error) {
      return { ok: false, error: mensajeOperacionFinanciera(error) };
    }
    revalidatePath("/ventas/muebles-personalizados");
    revalidatePath("/ventas");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ocurrió un problema, intenta de nuevo." };
  }
}

export async function createCorteItem(formData: FormData) {
  await requireMutationAccess(ventasRoles);
  const parsed = corteSchema.safeParse({
    cotizacionId: formData.get("cotizacion_id"),
    tipoPieza: formData.get("tipo_pieza"),
    espesor: formData.get("espesor"),
    ancho: formData.get("ancho"),
    largo: formData.get("largo"),
    cantidad: formData.get("cantidad"),
    factor: formData.get("factor"),
  });

  if (!parsed.success) {
    throw new Error("Datos de corte inválidos.");
  }

  const base = parsed.data.espesor * parsed.data.ancho * parsed.data.largo * parsed.data.cantidad;
  const valor = roundMoney(base * parsed.data.factor);

  if (!hasSupabaseEnv()) {
    demoCreateCorte({
      cotizacion_id: parsed.data.cotizacionId,
      tipo_pieza: parsed.data.tipoPieza,
      espesor: parsed.data.espesor,
      ancho: parsed.data.ancho,
      largo: parsed.data.largo,
      cantidad: parsed.data.cantidad,
      valor_calculado: valor,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("cotizacion_cortes").insert({
      cotizacion_id: parsed.data.cotizacionId,
      tipo_pieza: parsed.data.tipoPieza,
      espesor: parsed.data.espesor,
      ancho: parsed.data.ancho,
      largo: parsed.data.largo,
      cantidad: parsed.data.cantidad,
      valor_calculado: valor,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/ventas/muebles-corte");
}

export async function createAlquiler(formData: FormData) {
  await requireMutationAccess(writerRoles);
  const parsed = alquilerSchema.safeParse({
    clienteId: formData.get("cliente_id"),
    activo: formData.get("activo"),
    fechaInicio: formData.get("fecha_inicio"),
    tarifa: formData.get("tarifa"),
    penalidad: formData.get("penalidad"),
  });

  if (!parsed.success) {
    throw new Error("Datos de alquiler inválidos.");
  }

  if (!hasSupabaseEnv()) {
    demoCreateAlquiler({
      organization_id: DEFAULT_ORG_ID,
      cliente_id: parsed.data.clienteId,
      activo: parsed.data.activo,
      fecha_inicio: parsed.data.fechaInicio,
      tarifa: parsed.data.tarifa,
      penalidad: parsed.data.penalidad,
      estado: "abierto",
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("alquileres").insert({
      organization_id: DEFAULT_ORG_ID,
      cliente_id: parsed.data.clienteId,
      activo: parsed.data.activo,
      fecha_inicio: parsed.data.fechaInicio,
      tarifa: parsed.data.tarifa,
      penalidad: parsed.data.penalidad,
      estado: "abierto",
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/alquiler");
  revalidatePath("/");
}

async function requireOwnedReference(table: "empleados" | "registro_categorias", id: string, organizationId: string) {
  if (!hasSupabaseEnv()) {
    const { demoExportStore } = await import("@/lib/demo-store");
    const snapshot = demoExportStore();
    const rows = table === "empleados" ? snapshot.empleados : snapshot.registroCategorias;
    if (!rows.some(row => row.id === id && row.organization_id === organizationId && (table !== "registro_categorias" || row.activo))) throw new Error("El registro seleccionado no está disponible en esta empresa.");
    return;
  }
  let query = getSupabaseServerClient().from(table).select("id").eq("id", id).eq("organization_id", organizationId);
  if (table === "registro_categorias") query = query.eq("activo", true);
  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new Error("No se pudo comprobar el registro seleccionado. No se guardaron cambios.");
}

export async function createEmpleado(formData: FormData) {
  const actor = await requireMutationAccess(rrhhRoles);
  const parsed = empleadoSchema.safeParse({
    nombre: formData.get("nombre"),
    rol: formData.get("rol"),
    fechaIngreso: formData.get("fecha_ingreso"),
  });
  if (!parsed.success) {
    throw new Error("Datos de empleado inválidos.");
  }
  if (!hasSupabaseEnv()) {
    demoCreateEmpleado({
      organization_id: actor.organizationId,
      nombre: parsed.data.nombre,
      rol: parsed.data.rol,
      fecha_ingreso: parsed.data.fechaIngreso,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("empleados").insert({
      organization_id: actor.organizationId,
      nombre: parsed.data.nombre,
      rol: parsed.data.rol,
      fecha_ingreso: parsed.data.fechaIngreso,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/personal");
}

export async function createAdelanto(formData: FormData) {
  const actor = await requireMutationAccess(rrhhRoles);
  const submissionId = claveOperacion(formData, true);
  const parsed = adelantoSchema.safeParse({
    empleadoId: formData.get("empleado_id"),
    fecha: formData.get("fecha"),
    monto: formData.get("monto"),
  });
  if (!parsed.success) {
    throw new Error("Datos de adelanto inválidos.");
  }
  await requireOwnedReference("empleados", parsed.data.empleadoId, actor.organizationId);
  if (!hasSupabaseEnv()) {
    demoCreateAdelanto({
      organization_id: actor.organizationId,
      empleado_id: parsed.data.empleadoId,
      fecha: parsed.data.fecha,
      monto: parsed.data.monto,
    }, submissionId);
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("adelantos").insert({
      id: submissionId,
      organization_id: actor.organizationId,
      empleado_id: parsed.data.empleadoId,
      fecha: parsed.data.fecha,
      monto: parsed.data.monto,
      estado: "pendiente",
    });
    if (error?.code === '23505') {
      const { data: previo, error: lectura } = await supabase.from('adelantos').select('empleado_id,fecha,monto')
        .eq('id', submissionId).eq('organization_id', actor.organizationId).maybeSingle();
      if (lectura || !previo || previo.empleado_id !== parsed.data.empleadoId || previo.fecha !== parsed.data.fecha || Number(previo.monto) !== parsed.data.monto) {
        throw new Error('Este envío no coincide con el adelanto guardado. Revisa el historial antes de volver a registrarlo.');
      }
    } else if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/personal");
}

export async function createSueldo(formData: FormData) {
  const actor = await requireMutationAccess(rrhhRoles);
  const submission = z.uuid().safeParse(formData.get("submission_id"));
  if (!submission.success) throw new Error("Vuelve a abrir el formulario para registrar el sueldo.");
  const parsed = sueldoSchema.safeParse({
    empleadoId: formData.get("empleado_id"),
    periodo: formData.get("periodo"),
    montoBruto: formData.get("monto_bruto"),
    descuentos: formData.get("descuentos"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos de sueldo inválidos.");
  }
  const montoNeto = roundMoney(parsed.data.montoBruto - parsed.data.descuentos);
  await requireOwnedReference("empleados", parsed.data.empleadoId, actor.organizationId);
  if (!hasSupabaseEnv()) {
    demoCreateSueldo({
      organization_id: actor.organizationId,
      empleado_id: parsed.data.empleadoId,
      periodo: parsed.data.periodo,
      monto_bruto: parsed.data.montoBruto,
      descuentos: parsed.data.descuentos,
      monto_neto: montoNeto,
    }, submission.data);
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("sueldos").insert({
      id: submission.data,
      organization_id: actor.organizationId,
      empleado_id: parsed.data.empleadoId,
      periodo: parsed.data.periodo,
      monto_bruto: parsed.data.montoBruto,
      descuentos: parsed.data.descuentos,
      monto_neto: montoNeto,
    });
    if (error?.code === "23505") {
      const { data: existing, error: readError } = await supabase.from("sueldos").select("*").eq("id", submission.data).eq("organization_id", actor.organizationId).maybeSingle();
      if (readError || !existing || existing.empleado_id !== parsed.data.empleadoId || existing.periodo !== parsed.data.periodo || Number(existing.monto_bruto) !== parsed.data.montoBruto || Number(existing.descuentos) !== parsed.data.descuentos) throw new Error("No se pudo confirmar este envío. Revisa el historial antes de intentarlo nuevamente.");
    } else if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/personal");
}

export async function submitPersonalForm(kind: "empleado" | "adelanto" | "sueldo", formData: FormData): Promise<{ error?: string; success?: string }> {
  try {
    if (kind === "empleado") await createEmpleado(formData);
    else if (kind === "adelanto") await createAdelanto(formData);
    else if (kind === "sueldo") await createSueldo(formData);
    else return { error: "Operación inválida." };
    return { success: "Registro guardado correctamente." };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo guardar el registro." }; }
}

export async function cerrarMes(formData: FormData) {
  await requireMutationAccess(liderazgoRoles);
  const anio = Number(formData.get("anio"));
  const mes = Number(formData.get("mes"));
  const confirmacion = String(formData.get("confirmacion") ?? "");
  const esperado = `CERRAR MES ${anio}-${String(mes).padStart(2, "0")}`;

  if (confirmacion !== esperado) {
    throw new Error("Confirmación inválida. No se cerró el mes.");
  }

  if (!hasSupabaseEnv()) {
    demoCerrarMes(DEFAULT_ORG_ID, anio, mes);
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.rpc("cerrar_mes", {
      p_org_id: DEFAULT_ORG_ID,
      p_anio: anio,
      p_mes: mes,
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/reportes");
  revalidatePath("/");
}

export async function toggleSecurityControl(formData: FormData) {
  if (!FEATURES.seguridad) throw new Error("Este apartado no está habilitado.");
  await requireMutationAccess(liderazgoRoles);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Control inválido.");
  if (!hasSupabaseEnv()) {
    demoToggleSecurityControl(id);
    revalidatePath("/seguridad");
    return;
  }
  const supabase = getSupabaseServerClient();
  const { data: row, error: readErr } = await supabase
    .from("security_control_items")
    .select("id,completed")
    .eq("id", id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();
  if (readErr || !row) {
    throw new Error(readErr?.message ?? "Control no encontrado.");
  }
  const { error: upErr } = await supabase
    .from("security_control_items")
    .update({
      completed: !row.completed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", DEFAULT_ORG_ID);
  if (upErr) {
    throw new Error(upErr.message);
  }
  revalidatePath("/seguridad");
}

export async function createInventarioProducto(formData: FormData) {
  const actor = await requireMutationAccess(writerRoles);
  const parsed = inventarioProductoSchema.safeParse({
    codigo: formData.get('codigo'), nombre: formData.get('nombre'), categoria: formData.get('categoria'),
    unidad: formData.get('unidad'), stockMinimo: formData.get('stock_minimo'), fotoUrl: formData.get('foto_url'),
    stockInicial: formData.get('stock_inicial'), costoUnitario: formData.get('costo_unitario'),
  });
  if (!parsed.success) throw new Error('Datos de producto inválidos. Revisa el código, las existencias y el costo.');
  const p = parsed.data;
  const id = await registrarAltaInventario(actor, 'producto_inventario', claveOperacion(formData, true), {
    codigo: p.codigo, nombre: p.nombre, categoria: p.categoria, unidad: p.unidad, stock_minimo: p.stockMinimo,
    foto_url: p.fotoUrl ?? null, costo_unitario: p.costoUnitario && p.costoUnitario > 0 ? p.costoUnitario : null,
    stock_inicial: p.stockInicial, fecha: fechaHoyPeru(),
    ...(formData.get('codigo_automatico') === '1' ? { codigo_automatico: true } : {}),
  });
  revalidatePath('/inventario'); revalidatePath('/');
  return id;
}

export async function createInventarioMovimiento(formData: FormData) {
  const actor = await requireMutationAccess(writerRoles);
  const parsed = inventarioMovimientoSchema.safeParse({
    productoId: formData.get('producto_id'), fecha: formData.get('fecha'), tipo: formData.get('tipo'),
    cantidad: formData.get('cantidad'), costoUnitario: formData.get('costo_unitario'), referencia: formData.get('referencia'),
  });
  if (!parsed.success) throw new Error('Datos de movimiento de inventario inválidos. Revisa producto, fecha, cantidad y costo.');
  const p = parsed.data;
  await registrarAltaInventario(actor, 'movimiento_inventario', claveOperacion(formData, true), {
    producto_id: p.productoId, fecha: p.fecha, tipo: p.tipo, cantidad: p.cantidad,
    costo_unitario: p.costoUnitario ?? null, referencia: p.referencia ?? null,
  });
  revalidatePath('/inventario'); revalidatePath('/');
}

export async function submitCreateInventarioProductoForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    const id = await createInventarioProducto(formData);
    return {
      success: true,
      error: null,
      message: "Producto creado con éxito.",
      id,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo crear el producto.",
      message: null,
    };
  }
}

export async function submitCreateInventarioMovimientoForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await createInventarioMovimiento(formData);
    return {
      success: true,
      error: null,
      message: "Movimiento de inventario registrado con éxito.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo registrar el movimiento.",
      message: null,
    };
  }
}

export async function createInventarioCompraRapida(formData: FormData) {
    const actor = await requireMutationAccess(writerRoles);
    const parsed = inventarioCompraRapidaSchema.safeParse({
        productoId: formData.get("producto_id"),
        cantidad: formData.get("cantidad"),
        costoUnitario: formData.get("costo_unitario"),
        proveedor: formData.get("proveedor"),
        fecha: formData.get("fecha"),
        nota: formData.get("nota"),
        tipoComprobante: formData.get("tipo_comprobante") || "ninguno",
        urlComprobante: formData.get("url_comprobante"),
    });
    if (!parsed.success) {
        throw new Error("Datos de compra inválidos.");
    }
    const referencia = [parsed.data.proveedor?.trim(), parsed.data.nota?.trim()].filter(Boolean).join(' · ') || null;
    const costoUnitario = parsed.data.costoUnitario ?? null;
    const monto = costoUnitario && costoUnitario > 0 ? roundMoney(parsed.data.cantidad * costoUnitario) : 0;
    await registrarOperacionIntegral(actor, { tipo: 'compra_inventario', clave: claveOperacion(formData), documento: { fecha: parsed.data.fecha },
        stock: [{ producto_id: parsed.data.productoId, cantidad: parsed.data.cantidad, costo_unitario: costoUnitario, referencia }],
        caja: monto > 0 ? { fecha: parsed.data.fecha, tipo: 'egreso', medio: 'efectivo', categoria: 'compra_inventario', monto,
            descripcion: referencia ? 'Compra de inventario: ' + referencia : 'Compra de inventario',
            tipo_comprobante: parsed.data.tipoComprobante, url_comprobante: parsed.data.urlComprobante ?? null } : null });
    revalidatePath('/inventario');
    revalidatePath('/caja');
    revalidatePath('/');
}

export async function updateInventarioProducto(formData: FormData) {
  const actor = await requireMutationAccess(writerRoles);
  const parsed = inventarioProductoUpdateSchema.safeParse({
    id: formData.get("id"),
    codigo: formData.get("codigo"),
    nombre: formData.get("nombre"),
    categoria: formData.get("categoria"),
    unidad: formData.get("unidad"),
    stockMinimo: formData.get("stock_minimo"),
    stockActual: formData.get("stock_actual"),
    fotoUrl: formData.get("foto_url"),
    costoUnitario: formData.get("costo_unitario"),
  });
  if (!parsed.success) throw new Error("Datos de producto inválidos.");

  const esperadoRaw = formData.get('stock_esperado');
  const esperado = esperadoRaw === null || esperadoRaw === '' ? null : Number(esperadoRaw);
  if (esperado !== null && (!Number.isFinite(esperado) || esperado < 0)) throw new Error('Stock anterior inválido. Vuelve a abrir el producto.');
  if (parsed.data.stockActual !== undefined && esperado === null) throw new Error('Vuelve a abrir el producto antes de modificar su stock.');
  const datos = { codigo: parsed.data.codigo, nombre: parsed.data.nombre, categoria: parsed.data.categoria,
    unidad: parsed.data.unidad, stock_minimo: parsed.data.stockMinimo,
    ...(parsed.data.stockActual !== undefined ? { stock_actual: parsed.data.stockActual } : {}),
    foto_url: parsed.data.fotoUrl ?? null, costo_unitario: parsed.data.costoUnitario ?? null };
  if (!hasSupabaseEnv()) {
    const updated = demoUpdateInventarioProducto(parsed.data.id, datos, esperado);
    if (!updated) throw new Error('Producto no encontrado.');
  } else {
    const { error } = await getSupabaseServerClient().rpc('editar_producto_inventario_seguro', {
      p_org: actor.organizationId, p_actor: actor.userId, p_id: parsed.data.id, p_datos: datos, p_stock_esperado: esperado,
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath('/inventario');
}

export async function toggleInventarioProductoActivo(formData: FormData) {
  await requireMutationAccess(writerRoles);
  const parsed = inventarioToggleActivoSchema.safeParse({
    id: formData.get("id"),
    activo: formData.get("activo"),
  });
  if (!parsed.success) throw new Error("Solicitud inválida.");

  if (!hasSupabaseEnv()) {
    const row = demoToggleInventarioProductoActivo(parsed.data.id, parsed.data.activo);
    if (!row) throw new Error("Producto no encontrado.");
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("inventario_productos")
      .update({ activo: parsed.data.activo })
      .eq("id", parsed.data.id)
      .eq("organization_id", DEFAULT_ORG_ID);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/inventario");
}

export async function deleteInventarioProducto(formData: FormData) {
  const actor = await requireMutationAccess(writerRoles);
  const parsed = inventarioDeleteProductoSchema.safeParse({
    id: formData.get("id"),
    forzarConMovimientos: formData.get("forzarConMovimientos") === "true",
  });
  if (!parsed.success) throw new Error("Solicitud inválida.");

  const forzar = parsed.data.forzarConMovimientos === true;

  if (!hasSupabaseEnv()) {
    const res = demoDeleteInventarioProducto(parsed.data.id, { forzarConMovimientos: forzar });
    if (!res.ok) throw new Error(res.error);
  } else {
    const { error } = await getSupabaseServerClient().rpc('eliminar_producto_inventario_seguro', {
      p_org: actor.organizationId, p_actor: actor.userId, p_id: parsed.data.id, p_forzar: forzar,
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/inventario");
}

/** Consulta real en BD (no depende del límite de movimientos cargados en la página). */
export async function inventarioProductoTieneMovimientosEnKardex(productoId: string): Promise<boolean> {
  await requireAuthContext();
  const idParsed = z.string().uuid().safeParse(productoId);
  if (!idParsed.success) return false;

  if (!hasSupabaseEnv()) {
    return demoInventarioMovimientosRows().some((m) => m.producto_id === productoId);
  }

  const supabase = getSupabaseServerClient();
  const { count, error } = await supabase
    .from("inventario_movimientos")
    .select("id", { count: "exact", head: true })
    .eq("producto_id", productoId)
    .eq("organization_id", DEFAULT_ORG_ID);

  if (error) {
    console.error("[inventarioProductoTieneMovimientosEnKardex]", error.message);
    return false;
  }
  return (count ?? 0) > 0;
}

export async function deleteInventarioMovimiento(formData: FormData) {
  const actor = await requireMutationAccess(writerRoles);
  const parsed = inventarioDeleteMovimientoSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) throw new Error("Movimiento inválido.");

  if (!hasSupabaseEnv()) {
    const ok = demoDeleteInventarioMovimiento(parsed.data.id);
    if (!ok) throw new Error("Movimiento no encontrado.");
  } else {
    const { error } = await getSupabaseServerClient().rpc('eliminar_movimiento_inventario_seguro', {
      p_org: actor.organizationId, p_actor: actor.userId, p_id: parsed.data.id,
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/inventario");
}

export async function registrarConteoInventario(formData: FormData) {
  const actor = await requireMutationAccess(writerRoles);
  const parsed = inventarioConteoSchema.safeParse({
    productoId: formData.get("producto_id"),
    fecha: formData.get("fecha"),
    stockContado: formData.get("stock_contado"),
    referencia: formData.get("referencia"),
  });
  if (!parsed.success) throw new Error("Datos de conteo inválidos.");

  const raw = formData.get('stock_esperado');
  const esperado = raw === null || raw === '' ? NaN : Number(raw);
  if (!Number.isFinite(esperado) || esperado < 0) throw new Error('Selecciona nuevamente el producto para comprobar su stock.');
  if (!hasSupabaseEnv()) {
    const result = demoRegistrarConteoInventario(parsed.data.productoId, parsed.data.stockContado, parsed.data.fecha, parsed.data.referencia, esperado);
    if (!result.ok) throw new Error(result.error);
  } else {
    const { error } = await getSupabaseServerClient().rpc('registrar_conteo_inventario_seguro', {
      p_org: actor.organizationId, p_actor: actor.userId, p_producto: parsed.data.productoId, p_fecha: parsed.data.fecha,
      p_contado: parsed.data.stockContado, p_referencia: parsed.data.referencia, p_stock_esperado: esperado,
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath('/inventario');
}

export async function createRegistroGeneral(formData: FormData) {
  const actor = await requireMutationAccess(["owner_admin", "gerencia", "almacen"]);
  const parsed = registroGeneralSchema.safeParse({
    categoriaId: formData.get("categoria_id"),
    fecha: formData.get("fecha"),
    titulo: formData.get("titulo"),
    detalle: formData.get("detalle"),
    monto: formData.get("monto"),
  });

  if (!parsed.success) {
    throw new Error("Datos de registro general inválidos.");
  }
  await requireOwnedReference("registro_categorias", parsed.data.categoriaId, actor.organizationId);

  if (!hasSupabaseEnv()) {
    demoCreateRegistroGeneral({
      organization_id: actor.organizationId,
      categoria_id: parsed.data.categoriaId,
      fecha: parsed.data.fecha,
      titulo: parsed.data.titulo,
      detalle: parsed.data.detalle ?? null,
      monto: parsed.data.monto ?? null,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("registros_generales").insert({
      organization_id: actor.organizationId,
      categoria_id: parsed.data.categoriaId,
      fecha: parsed.data.fecha,
      titulo: parsed.data.titulo,
      detalle: parsed.data.detalle ?? null,
      monto: parsed.data.monto ?? null,
      metadata: {},
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/registro");
  revalidatePath("/");
}

export async function createVentaDesdePdf(_formData: FormData) {
  await requireMutationAccess(ventasRoles);
  throw new Error("La lectura automática de PDF no está disponible. Registra la venta desde su formulario y adjunta el comprobante real.");
}

// ---------------------------------------------------------------------------
// Sub-flujo 1: Muebles terminados (catálogo)
// ---------------------------------------------------------------------------

export async function createMuebleCatalogo(formData: FormData) {
  await requireMutationAccess(ventasRoles);
  const parsed = muebleCatalogoSchema.safeParse({
    codigo: formData.get("codigo"),
    nombre: formData.get("nombre"),
    descripcion: formData.get("descripcion"),
    precioLista: formData.get("precio_lista"),
    stockDisponible: formData.get("stock_disponible"),
    fotoUrl: formData.get("foto_url"),
  });
  if (!parsed.success) {
    throw new Error("Datos de mueble inválidos.");
  }
  if (!hasSupabaseEnv()) {
    demoCreateMuebleCatalogo({
      organization_id: DEFAULT_ORG_ID,
      codigo: parsed.data.codigo,
      nombre: parsed.data.nombre,
      descripcion: parsed.data.descripcion || null,
      precio_lista: parsed.data.precioLista,
      stock_disponible: parsed.data.stockDisponible,
      foto_url: parsed.data.fotoUrl || null,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("muebles_catalogo").insert({
      organization_id: DEFAULT_ORG_ID,
      codigo: parsed.data.codigo.trim(),
      nombre: parsed.data.nombre.trim(),
      descripcion: parsed.data.descripcion?.trim() || null,
      precio_lista: parsed.data.precioLista,
      stock_disponible: parsed.data.stockDisponible,
      foto_url: parsed.data.fotoUrl?.trim() || null,
      activo: true,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/ventas");
  revalidatePath("/ventas/muebles-terminados");
  revalidatePath("/inventario");
  revalidatePath("/cotizacion");
}

export async function updateMuebleCatalogo(formData: FormData) {
  const actor = await requireMutationAccess(ventasRoles);
  const parsed = muebleCatalogoUpdateSchema.safeParse({ id: formData.get('id'), descripcion: formData.get('descripcion'),
    precioLista: formData.get('precio_lista'), fotoUrl: formData.get('foto_url') });
  if (!parsed.success) throw new Error('Datos de mueble inválidos.');
  const p = parsed.data, datos = { descripcion: p.descripcion?.trim() || null,
    precio_lista: p.precioLista, foto_url: p.fotoUrl?.trim() || null };
  if (!hasSupabaseEnv()) {
    if (!demoUpdateMuebleCatalogo(p.id, datos)) throw new Error('Mueble no encontrado.');
  } else {
    const { data, error } = await getSupabaseServerClient().rpc('editar_mueble_catalogo_seguro', {
      p_org: actor.organizationId, p_actor: actor.userId, p_id: p.id, p_datos: datos,
    });
    if (error) throw new Error(mensajeOperacionFinanciera(error));
    if (data !== p.id) throw new Error('No se pudo confirmar el cambio del catálogo. Actualiza antes de reintentar.');
  }
  revalidatePath('/inventario'); revalidatePath('/ventas'); revalidatePath('/ventas/muebles-terminados'); revalidatePath('/cotizacion');
}

export async function toggleMuebleCatalogoActivo(formData: FormData) {
  await requireMutationAccess(ventasRoles);
  const parsed = muebleCatalogoToggleSchema.safeParse({
    id: formData.get("id"),
    activo: formData.get("activo"),
  });
  if (!parsed.success) throw new Error("Solicitud inválida.");

  if (!hasSupabaseEnv()) {
    const updated = demoToggleMuebleCatalogoActivo(parsed.data.id, parsed.data.activo);
    if (!updated) throw new Error("Mueble no encontrado.");
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("muebles_catalogo")
      .update({ activo: parsed.data.activo })
      .eq("id", parsed.data.id)
      .eq("organization_id", DEFAULT_ORG_ID);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/inventario");
  revalidatePath("/ventas");
  revalidatePath("/ventas/muebles-terminados");
  revalidatePath("/cotizacion");
}

export async function deleteMuebleCatalogo(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireMutationAccess(ventasRoles);
    const parsedId = z.string().uuid().safeParse(id);
    if (!parsedId.success) return { ok: false, error: "Identificador inválido." };
    if (!hasSupabaseEnv()) {
      const ok = demoDeleteMuebleCatalogo(id);
      if (!ok) return { ok: false, error: "Mueble no encontrado." };
    } else {
      const supabase = getSupabaseServerClient();
      const { data: row } = await supabase
        .from("muebles_catalogo")
        .select("activo")
        .eq("id", id)
        .eq("organization_id", DEFAULT_ORG_ID)
        .maybeSingle();
      if (!row) return { ok: false, error: "Mueble no encontrado." };
      const { error } = await supabase
        .from("muebles_catalogo")
        .delete()
        .eq("id", id)
        .eq("organization_id", DEFAULT_ORG_ID);
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/inventario");
    revalidatePath("/ventas");
    revalidatePath("/ventas/muebles-terminados");
    revalidatePath("/cotizacion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al eliminar el mueble." };
  }
}

export async function createVentaMuebleTerminado(formData: FormData) {
    const actor = await requireMutationAccess(ventasRoles);
    const parsed = ventaMuebleTerminadoSchema.safeParse({
        clienteId: formData.get("cliente_id"),
        muebleCatalogoId: formData.get("mueble_catalogo_id"),
        cantidad: formData.get("cantidad"),
        precioUnitario: formData.get("precio_unitario"),
        fecha: formData.get("fecha"),
        choferId: formData.get("chofer_id"),
        tipoEntrega: formData.get("tipo_entrega"),
        direccionEntrega: formData.get("direccion_entrega"),
        estadoEntrega: formData.get("estado_entrega"),
        metodoPago: formData.get("metodo_pago"),
        modalidadPago: formData.get("modalidad_pago"),
        fechaPagoCredito: formData.get("fecha_pago_credito"),
        adelanto: formData.get("adelanto"),
        montoCredito: formData.get("monto_credito"),
        tipoComprobante: formData.get("tipo_comprobante") || "ninguno",
        urlComprobante: formData.get("url_comprobante"),
    });
    if (!parsed.success) {
        throw new Error("Datos de venta de mueble inválidos.");
    }
    await assertClientePuedeEmitirFactura(parsed.data.clienteId, parsed.data.tipoComprobante);
    const total = roundMoney(parsed.data.precioUnitario * parsed.data.cantidad);
    const montoCaja = montoCobradoVenta(total, parsed.data.modalidadPago, parsed.data.adelanto);
    const clienteNombre = await nombreClienteOperacion(parsed.data.clienteId, actor.organizationId);
    const descripcionCaja = 'Venta de mueble - ' + clienteNombre;
    const correlativo = await nextCorrelativo('venta_mueble');
    const caja = montoCaja > 0 ? { fecha: parsed.data.fecha, tipo: 'ingreso', medio: mapMetodoPagoVentaToMedioCaja(parsed.data.metodoPago),
        categoria: 'venta_mueble_terminado', monto: montoCaja, descripcion: descripcionCaja, tipo_comprobante: parsed.data.tipoComprobante,
        url_comprobante: parsed.data.urlComprobante ?? null } : null;
    await registrarOperacionIntegral(actor, { tipo: 'venta_mueble', clave: claveOperacion(formData),
        documento: { cliente_id: parsed.data.clienteId, mueble_catalogo_id: parsed.data.muebleCatalogoId, cantidad: parsed.data.cantidad,
            precio_unitario: parsed.data.precioUnitario, total, chofer_id: parsed.data.choferId || null, tipo_entrega: parsed.data.tipoEntrega,
            direccion_entrega: parsed.data.direccionEntrega?.trim() || null, estado_entrega: parsed.data.estadoEntrega, metodo_pago: parsed.data.metodoPago,
            modalidad_pago: parsed.data.modalidadPago === 'adelanto_saldo' ? 'adelanto' : parsed.data.modalidadPago,
            fecha_pago_credito: parsed.data.modalidadPago === 'credito' ? parsed.data.fechaPagoCredito || null : null,
            correlativo, fecha: parsed.data.fecha, updated_by: actor.userId }, caja });
    revalidatePath('/ventas');
    revalidatePath('/ventas/muebles-terminados');
    revalidatePath('/inventario');
    revalidatePath('/caja');
}

export async function submitCreateVentaMuebleTerminadoForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await createVentaMuebleTerminado(formData);
    return {
      success: true,
      error: null,
      message: "Venta de mueble registrada correctamente.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo registrar la venta.",
      message: null,
    };
  }
}

export async function marcarEntregaMueble(formData: FormData) {
  const actor = await requireMutationAccess(ventasRoles);
  const id = String(formData.get("id") ?? "");
  const nuevoEstado = String(formData.get("nuevo_estado") ?? "");
  if (!id) throw new Error("Venta inválida.");
  if (
    nuevoEstado !== "pendiente" &&
    nuevoEstado !== "en_proceso" &&
    nuevoEstado !== "entregado"
  ) {
    throw new Error("Estado de entrega inválido.");
  }
  if (!hasSupabaseEnv()) {
    demoMarcarEntregaMueble(id, nuevoEstado);
  } else {
    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("ventas_mueble_terminado")
      .update({
        estado_entrega: nuevoEstado,
        updated_at: now,
        updated_by: actor.userId,
      })
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!updated) {
      throw new Error("No se encontró la venta.");
    }
  }
  revalidatePath("/ventas/muebles-terminados");
}

export async function cancelarVentaMueble(formData: FormData) {
    const actor = await requireMutationAccess(['owner_admin']);
    await anularOperacionIntegral(actor, 'venta_mueble', String(formData.get('id') ?? ''));
    revalidatePath('/ventas');
    revalidatePath('/ventas/muebles-terminados');
    revalidatePath('/inventario');
    revalidatePath('/caja');
    revalidatePath('/');
}

// ---------------------------------------------------------------------------
// Sub-flujo 2: Muebles personalizados (cotizaciones → órdenes)
// ---------------------------------------------------------------------------

/**
 * Acepta una cotización y, en una sola operación atómica, crea (1) la orden de
 * producción y, si se proporciona, (2) el ingreso de adelanto en caja.
 */
export async function aprobarCotizacionAOrden(formData: FormData) {
  const actor = await requireMutationAccess(ventasRoles);
  const parsed = aprobarCotizacionSchema.safeParse({ cotizacionId: formData.get("cotizacion_id"), notas: formData.get("notas"),
    adelanto: formData.get("adelanto"), metodoAdelanto: formData.get("metodo_adelanto") });
  if (!parsed.success) throw new Error("Cotización inválida.");
  const { cotizacionId, notas } = parsed.data;
  const adelanto = parsed.data.adelanto ?? 0;
  const medio = parsed.data.metodoAdelanto ?? "efectivo";
  const correlativo = await nextCorrelativo("orden_produccion");
  const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (!hasSupabaseEnv()) {
    const { demoCotizacionesRows, demoGetCotizacionUnificada, demoCajaRows, demoOrdenesProduccionRows, demoOperacionAtomica } = await import("@/lib/demo-store");
    demoOperacionAtomica(() => {
      const antigua = demoCotizacionesRows().find(c => c.id === cotizacionId);
      const unificada = antigua ? undefined : demoGetCotizacionUnificada(cotizacionId);
      const cot = antigua ?? unificada;
      if (!cot || unificada?.deleted_at) throw new Error("La cotización ya no existe.");
      if ((antigua && antigua.estado !== "confirmada") || (unificada && !["lista_produccion", "en_produccion", "cobrada"].includes(unificada.estado_flujo))) throw new Error("Solo se puede aprobar una cotización aceptada.");
      const ordenes = demoOrdenesProduccionRows();
      if (ordenes.some(o => o.organization_id === DEFAULT_ORG_ID && (antigua ? o.cotizacion_id : o.cotizacion_unificada_id) === cotizacionId)) throw new Error("Esta cotización ya tiene una orden de producción.");
      const total = Number(antigua ? antigua.precio_acordado : unificada!.total);
      montoCobradoVenta(total, "adelanto", adelanto);
      const resumen = resumenCobroLocal(total, cotizacionId, DEFAULT_ORG_ID, demoCajaRows(), ordenes, !antigua);
      if (unificada?.estado_flujo === 'cobrada' && (resumen.saldo !== 0 || adelanto !== 0)) throw new Error('La cotización cobrada solo puede generar la orden, con adelanto cero y pago completo verificado.');
      if (adelanto > resumen.saldo) throw new Error("El adelanto no puede superar el saldo de la cotización.");
      let notasFinal = notas?.trim() || null;
      if (unificada) {
        const cliente = demoClientesRows().find(c => c.id === unificada.cliente_id && c.organization_id === DEFAULT_ORG_ID);
        const resumenOrden = textoNotasOrdenProduccionDesdeUnificada({ clienteNombre: cliente?.nombre ?? "Cliente", correlativo: unificada.correlativo,
          cotIdShort: cotizacionId.slice(0, 8), total, detalle: unificada.detalle });
        notasFinal = notasFinal ? notasFinal + "\n\n---\n" + resumenOrden : resumenOrden;
      }
      const orden = demoCreateOrdenProduccion({ organization_id: DEFAULT_ORG_ID, cliente_id: cot.cliente_id,
        cotizacion_id: antigua ? cotizacionId : null, cotizacion_unificada_id: antigua ? null : cotizacionId,
        estado: "en_produccion", notas: notasFinal, correlativo, fecha_aprobacion: fecha });
      if (adelanto > 0) demoCreateCaja({ organization_id: DEFAULT_ORG_ID, fecha, tipo: "ingreso", medio,
        categoria: "adelanto_mueble_personalizado", monto: adelanto, descripcion: "Adelanto al aprobar cotización " + (cot.correlativo ?? cotizacionId.slice(0, 8)),
        modulo_origen: "ventas", referencia_id: orden.id });
      if (unificada && unificada.estado_flujo !== 'cobrada') demoUpdateCotizacionUnificada(cotizacionId, { estado_flujo: "en_produccion" });
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { data: antigua, error: lecturaAntigua } = await supabase.from("cotizaciones_mueble").select("id,cliente_id,estado,precio_acordado").eq("id", cotizacionId).eq("organization_id", DEFAULT_ORG_ID).maybeSingle();
    if (lecturaAntigua) throw new Error(lecturaAntigua.message);
    let total = antigua ? Number(antigua.precio_acordado) : 0;
    let notasFinal = notas?.trim() || null;
    if (!antigua) {
      const { data: cu, error } = await supabase.from("cotizaciones_unificadas").select("id,cliente_id,total,detalle,correlativo").eq("id", cotizacionId).eq("organization_id", DEFAULT_ORG_ID).is("deleted_at", null).maybeSingle();
      if (error || !cu) throw new Error(error?.message ?? "La cotización ya no existe.");
      total = Number(cu.total);
      const { data: cliente } = await supabase.from("clientes").select("nombre").eq("id", cu.cliente_id).eq("organization_id", DEFAULT_ORG_ID).maybeSingle();
      const resumen = textoNotasOrdenProduccionDesdeUnificada({ clienteNombre: cliente?.nombre ?? "Cliente", correlativo: cu.correlativo, cotIdShort: cotizacionId.slice(0, 8), total, detalle: cu.detalle });
      notasFinal = notasFinal ? notasFinal + "\n\n---\n" + resumen : resumen;
    }
    montoCobradoVenta(total, "adelanto", adelanto);
    const { error } = await supabase.rpc("aprobar_cotizacion_con_adelanto", { p_org: DEFAULT_ORG_ID, p_actor: actor.userId,
      p_cot: cotizacionId, p_unificada: !antigua, p_total_esperado: total, p_adelanto: adelanto, p_medio: medio,
      p_orden: { notas: notasFinal, correlativo, fecha_aprobacion: fecha } });
    if (error) throw new Error(mensajeOperacionFinanciera(error));
  }
  revalidatePath("/ventas/muebles-personalizados"); revalidatePath("/cotizacion"); revalidatePath("/ventas"); revalidatePath("/caja");
}

export async function cambiarEstadoOrden(formData: FormData) {
  const actor = await requireMutationAccess(ventasRoles);
  const parsed = cambiarEstadoOrdenSchema.safeParse({
    ordenId: formData.get("orden_id"),
    nuevoEstado: formData.get("nuevo_estado"),
  });
  if (!parsed.success) {
    throw new Error("Orden o estado inválidos.");
  }
  if (!hasSupabaseEnv()) {
    demoCambiarEstadoOrden(parsed.data.ordenId, parsed.data.nuevoEstado);
  } else {
    const supabase = getSupabaseServerClient();
    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("ordenes_produccion")
      .update({
        estado: parsed.data.nuevoEstado,
        updated_at: now,
        updated_by: actor.userId,
      })
      .eq("id", parsed.data.ordenId)
      .eq("organization_id", DEFAULT_ORG_ID)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!updated) {
      throw new Error("No se encontró la orden.");
    }
  }
  revalidatePath("/ventas/muebles-personalizados");
}

// ---------------------------------------------------------------------------
// Sub-flujo 3: Madera cortada
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sub-flujo 3: Madera cortada
// ---------------------------------------------------------------------------
export async function createVentaMaderaCortada(formData: FormData) {
    const actor = await requireMutationAccess(ventasRoles);
    const parsed = ventaMaderaCortadaSchema.safeParse({
        clienteId: formData.get("cliente_id"),
        fecha: formData.get("fecha"),
        tipoCorte: formData.get("tipo_corte"),
        totalPt: formData.get("total_pt"),
        precioPorPt: formData.get("precio_por_pt"),
        cantidadPiezas: formData.get("cantidad_piezas"),
        precioUnitarioComercial: formData.get("precio_unitario_comercial"),
        total: formData.get("total"),
        metodoPago: formData.get("metodo_pago"),
        modalidadPago: formData.get("modalidad_pago"),
        fechaPagoCredito: formData.get("fecha_pago_credito"),
        adelanto: formData.get("adelanto"),
        montoCredito: formData.get("monto_credito"),
        choferId: formData.get("chofer_id"),
        tipoEntrega: formData.get("tipo_entrega"),
        direccionEntrega: formData.get("direccion_entrega"),
        estadoEntrega: formData.get("estado_entrega"),
        inventarioProductoId: formData.get("inventario_producto_id"),
        tipoComprobante: formData.get("tipo_comprobante") || "ninguno",
        urlComprobante: formData.get("url_comprobante"),
    });
    if (!parsed.success) {
        console.error("[createVentaMaderaCortada] Validation failed:", parsed.error.format());
        const fieldErrors = Object.entries(parsed.error.flatten().fieldErrors)
            .map(([field, errs]) => `${field}: ${errs?.join(", ")}`)
            .join(" | ");
        throw new Error(`Datos de venta de madera cortada inválidos: ${fieldErrors}`);
    }
    await assertClientePuedeEmitirFactura(parsed.data.clienteId, parsed.data.tipoComprobante);
    const lineasRaw = formData.get("lineas_cubicaje");
    const lineas = parseMaderaCortadaCubicajeLines(lineasRaw);
    const lineasComprobante = buildMaderaCortadaVoucherLines(lineas, parsed.data.precioPorPt);
    if (lineas.length === 0 || lineasComprobante.length === 0) {
        throw new Error("No se pudo conservar el detalle de la venta. Revisa las piezas ingresadas antes de registrar.");
    }
    const totalPtReal = lineasComprobante.reduce((sum, linea) => sum + ((linea.espesor * linea.ancho * linea.largo) / 12) * linea.cantidad, 0);
    const cantidadPiezasReal = lineasComprobante.reduce((sum, linea) => sum + linea.cantidad, 0);
    const totalCalculadoReal = roundMoney(lineasComprobante.reduce((sum, linea) => sum + linea.subtotal, 0));
    const totalManualRaw = formData.get("total_manual_input");
    const usaTotalManual = typeof totalManualRaw === "string" && totalManualRaw.trim().length > 0;
    const totalCobrado = usaTotalManual ? parsed.data.total : totalCalculadoReal;
    const montoCaja = montoCobradoVenta(totalCobrado, parsed.data.modalidadPago, parsed.data.adelanto);
    const precioUnitarioComercialReal = cantidadPiezasReal > 0
        ? roundMoney(totalCobrado / cantidadPiezasReal)
        : 0;
    const productPtMap = new Map<string, number>();
    for (const linea of lineas) {
        const id = linea.inventario_producto_id;
        if (id && id !== 'manual' && id.trim() && linea.cantidad > 0 && linea.espesor > 0 && linea.ancho > 0 && linea.largo > 0) {
            const pt = ((linea.espesor * linea.ancho * linea.largo) / 12) * linea.cantidad;
            productPtMap.set(id, (productPtMap.get(id) ?? 0) + pt);
        }
    }
    const productoId = parsed.data.inventarioProductoId || null;
    if (!productPtMap.size && productoId)
        productPtMap.set(productoId, totalPtReal);
    const stock = [...productPtMap].map(([producto_id, pt]) => ({ producto_id, cantidad: pt / 12, costo_unitario: parsed.data.precioPorPt * 12 }));
    const descripcionBase = cantidadPiezasReal > 0 && precioUnitarioComercialReal > 0
        ? 'Venta ' + cantidadPiezasReal + ' pzs x S/ ' + precioUnitarioComercialReal.toFixed(2) + ' (' + parsed.data.tipoCorte + ')'
        : 'Venta ' + totalPtReal.toFixed(2) + ' PT (' + parsed.data.tipoCorte + ')';
    const descripcionCaja = descripcionBase + (['adelanto', 'adelanto_saldo'].includes(parsed.data.modalidadPago)
        ? ' - Adelanto: S/ ' + parsed.data.adelanto.toFixed(2) : '');
    const caja = montoCaja > 0 ? { fecha: parsed.data.fecha, tipo: 'ingreso', medio: mapMetodoPagoVentaToMedioCaja(parsed.data.metodoPago),
        categoria: 'venta_madera_cortada', monto: montoCaja, descripcion: descripcionCaja, tipo_comprobante: parsed.data.tipoComprobante,
        url_comprobante: parsed.data.urlComprobante ?? null } : null;
    const id = await registrarOperacionIntegral(actor, { tipo: 'venta_madera_cortada', clave: claveOperacion(formData),
        documento: { cliente_id: parsed.data.clienteId, fecha: parsed.data.fecha, estado: 'confirmada', tipo_corte: parsed.data.tipoCorte,
            total_pt: totalPtReal, precio_por_pt: parsed.data.precioPorPt, cantidad_piezas: cantidadPiezasReal || null,
            precio_unitario_comercial: precioUnitarioComercialReal || null, lineas_comprobante: lineasComprobante, tipo_comprobante: parsed.data.tipoComprobante,
            total: totalCobrado, metodo_pago: parsed.data.metodoPago, modalidad_pago: parsed.data.modalidadPago === 'adelanto_saldo' ? 'adelanto' : parsed.data.modalidadPago,
            fecha_pago_credito: parsed.data.modalidadPago === 'credito' ? parsed.data.fechaPagoCredito || null : null,
            chofer_id: parsed.data.choferId || null, tipo_entrega: parsed.data.tipoEntrega, direccion_entrega: parsed.data.direccionEntrega?.trim() || null,
            estado_entrega: parsed.data.estadoEntrega, inventario_producto_id: productoId }, stock, caja });
    revalidatePath('/ventas');
    revalidatePath('/ventas/madera-cortada');
    revalidatePath('/inventario');
    revalidatePath('/caja');
    return id;
}

/** Wrapper con MutationFormState para useActionState (cierre automático del modal). */
export async function submitCreateVentaMaderaCortadaForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    const id = await createVentaMaderaCortada(formData);
    return { success: true, error: null, message: "Venta registrada correctamente.", id };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo registrar la venta.",
      message: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Sub-flujo 4: Alquiler Bomba Mixer (contrato extendido)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sub-flujo 4: Alquiler Bomba Mixer (contrato extendido)
// ---------------------------------------------------------------------------
export async function createContratoAlquiler(formData: FormData) {
    const actor = await requireMutationAccess(writerRoles);
    const parsed = contratoAlquilerSchema.safeParse({
        clienteId: formData.get("cliente_id"),
        activo: formData.get("activo"),
        codigo: formData.get("codigo"),
        representante: formData.get("representante"),
        rucEmpresa: formData.get("ruc_empresa"),
        direccionEjecucion: formData.get("direccion_ejecucion"),
        fechaInicio: formData.get("fecha_inicio"),
        fechaTermino: formData.get("fecha_termino"),
        diasAlquiler: formData.get("dias_alquiler"),
        tarifaUnidad: formData.get("tarifa_unidad"),
        tarifa: formData.get("tarifa"),
        montoTotal: formData.get("monto_total"),
        metodoPago: formData.get("metodo_pago"),
        modalidadPago: formData.get("modalidad_pago"),
        fechaPagoCredito: formData.get("fecha_pago_credito"),
        adelanto: formData.get("adelanto"),
        montoCredito: formData.get("monto_credito"),
        penalidadRetrasoPagoPct: formData.get("penalidad_retraso_pago_pct"),
        penalidadDevolucionTardiaPct: formData.get("penalidad_devolucion_tardia_pct"),
        penalidadDaniosPct: formData.get("penalidad_danios_pct"),
    });
    if (!parsed.success) {
        throw new Error("Datos de contrato inválidos.");
    }
    // Calculate deposito30 dynamically
    const total = roundMoney(parsed.data.montoTotal);
    montoCobradoVenta(total, parsed.data.modalidadPago, parsed.data.adelanto);
    let deposito30 = roundMoney(total * 0.3);
    if (parsed.data.modalidadPago === "adelanto" || parsed.data.modalidadPago === "adelanto_saldo") {
        if (parsed.data.adelanto !== undefined && parsed.data.adelanto > 0) {
            deposito30 = roundMoney(parsed.data.adelanto);
        }
    }
    else if (parsed.data.modalidadPago === "credito") {
        deposito30 = 0;
    }
    const clienteNombre = await nombreClienteOperacion(parsed.data.clienteId, actor.organizationId);
    const codigo = parsed.data.codigo?.trim() || (await nextCorrelativo('contrato_alquiler'));
    await registrarServicioIntegral(actor, { tipo: 'alquiler', clave: claveOperacion(formData, true), documento: {
      cliente_id: parsed.data.clienteId, activo: parsed.data.activo.trim(), fecha_inicio: parsed.data.fechaInicio,
      fecha_fin: null, fecha_termino: parsed.data.fechaTermino?.trim() || null, tarifa: parsed.data.tarifa,
      penalidad: 0, estado: 'abierto', codigo, representante: parsed.data.representante?.trim() || null,
      ruc_empresa: parsed.data.rucEmpresa?.trim() || null, direccion_ejecucion: parsed.data.direccionEjecucion?.trim() || null,
      dias_alquiler: parsed.data.diasAlquiler ?? null, tarifa_unidad: parsed.data.tarifaUnidad, monto_total: parsed.data.montoTotal,
      deposito_30: deposito30, penalidad_retraso_pago_pct: parsed.data.penalidadRetrasoPagoPct,
      penalidad_devolucion_tardia_pct: parsed.data.penalidadDevolucionTardiaPct, penalidad_danios_pct: parsed.data.penalidadDaniosPct,
      metodo_pago: parsed.data.metodoPago, modalidad_pago: parsed.data.modalidadPago === 'adelanto_saldo' ? 'adelanto' : parsed.data.modalidadPago,
      fecha_pago_credito: parsed.data.modalidadPago === 'credito' ? parsed.data.fechaPagoCredito || null : null,
    }, caja: deposito30 > 0 ? { fecha: parsed.data.fechaInicio, tipo: 'ingreso', medio: mapMetodoPagoVentaToMedioCaja(parsed.data.metodoPago),
      categoria: 'alquiler_bomba_mixer', monto: deposito30, descripcion: 'Alquiler de mixer - ' + clienteNombre } : null });
    revalidatePath("/ventas");
    revalidatePath("/ventas/alquiler-mixer");
    revalidatePath("/alquiler");
    revalidatePath("/caja");
}

export async function cerrarContratoAlquiler(formData: FormData) {
  try {
    const actor = await requireMutationAccess(writerRoles);
    const parsed = cerrarContratoSchema.safeParse({
      contratoId: formData.get("contrato_id"),
      fechaCierre: formData.get("fecha_cierre"),
      observaciones: formData.get("observaciones"),
      retrasoPago: formData.get("retraso_pago"),
      devolucionTardia: formData.get("devolucion_tardia"),
      danios: formData.get("danios"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Datos de cierre inválidos." };
    }
    if (!hasSupabaseEnv()) {
      demoCerrarContratoAlquiler(parsed.data.contratoId, {
        fechaCierre: parsed.data.fechaCierre,
        observaciones: parsed.data.observaciones || null,
        penalidades: {
          retraso_pago: parsed.data.retrasoPago,
          devolucion_tardia: parsed.data.devolucionTardia,
          danios: parsed.data.danios,
        },
      });
    } else {
      const supabase = getSupabaseServerClient();
      const { data: row, error: fetchErr } = await supabase
        .from("alquileres")
        .select("*")
        .eq("id", parsed.data.contratoId)
        .eq("organization_id", DEFAULT_ORG_ID)
        .maybeSingle();

      if (fetchErr) {
        return { ok: false, error: fetchErr.message };
      }
      if (!row) {
        return { ok: false, error: "Contrato no encontrado." };
      }
      if (row.estado === "cerrado") {
        return { ok: false, error: "El contrato ya está cerrado." };
      }

      const montoTotal = row.monto_total != null ? Number(row.monto_total) : null;
      let penalidadTotal = 0;
      if (montoTotal != null && montoTotal > 0) {
        if (parsed.data.retrasoPago) {
          penalidadTotal += (montoTotal * Number(row.penalidad_retraso_pago_pct)) / 100;
        }
        if (parsed.data.devolucionTardia) {
          penalidadTotal += (montoTotal * Number(row.penalidad_devolucion_tardia_pct)) / 100;
        }
        if (parsed.data.danios) {
          penalidadTotal += (montoTotal * Number(row.penalidad_danios_pct)) / 100;
        }
      }
      penalidadTotal = roundMoney(penalidadTotal);

      const { error } = await supabase.rpc("cerrar_alquiler_con_caja", {
        p_org: DEFAULT_ORG_ID, p_actor: actor.userId, p_contrato: row.id, p_fecha: parsed.data.fechaCierre,
        p_observaciones: parsed.data.observaciones?.trim() || null, p_penalidad: penalidadTotal,
        p_snapshot_esperado: { monto_total: row.monto_total == null ? null : Number(row.monto_total),
          deposito_30: row.deposito_30 == null ? null : Number(row.deposito_30), penalidad: Number(row.penalidad),
          retraso_pct: Number(row.penalidad_retraso_pago_pct), devolucion_pct: Number(row.penalidad_devolucion_tardia_pct),
          danios_pct: Number(row.penalidad_danios_pct), metodo_pago: row.metodo_pago ?? null },
      });
      if (error) return { ok: false, error: mensajeOperacionFinanciera(error) };
    }
    revalidatePath("/ventas/alquiler-mixer");
    revalidatePath("/alquiler");
    revalidatePath("/caja");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al cerrar el contrato." };
  }
}

// ---------------------------------------------------------------------------
// Sub-flujo 5: Servicio aserradero
// ---------------------------------------------------------------------------

const CLIENTE_PROVISIONAL_NOMBRE = "Cliente pendiente";

function isCodigoClienteProvisional(value: string | null | undefined) {
  return Boolean(value && value.startsWith("PEND-"));
}

export async function createServicioAserradero(formData: FormData) {
    const actor = await requireMutationAccess(ventasRoles);
    const usarClienteProvisional = formData.get("usarClienteProvisional") === "true";
    const tipoComprobante = String(formData.get("tipo_comprobante") || "ninguno");
    if (usarClienteProvisional && tipoComprobante === "factura") {
        throw new Error("Completa un cliente con RUC valido antes de emitir factura.");
    }
    const parsed = servicioAserraderoSchema.safeParse({
        clienteId: usarClienteProvisional ? randomUUID() : formData.get("cliente_id"),
        fecha: formData.get("fecha"),
        piesCubicos: formData.get("pies_cubicos"),
        costoCubicaje: formData.get("costo_cubicaje"),
        precioCobrado: formData.get("precio_cobrado"),
        lineas: formData.get("lineas_json"),
        metodoPago: formData.get("metodo_pago") || "efectivo",
        modalidadPago: formData.get("modalidad_pago") || "contado",
        fechaPagoCredito: formData.get("fecha_pago_credito") || undefined,
        adelanto: formData.get("adelanto") || 0,
        tipoComprobante: formData.get("tipo_comprobante") || "ninguno",
        urlComprobante: formData.get("url_comprobante"),
    });
    if (!parsed.success) {
        throw new Error("Datos de servicio invalidos.");
    }
    const modalidadPago = parsed.data.modalidadPago === "adelanto_saldo" ? "adelanto" : parsed.data.modalidadPago;
    const adelanto = modalidadPago === "adelanto" ? parsed.data.adelanto : 0;
    const montoCaja = montoCobradoVenta(parsed.data.precioCobrado, modalidadPago, adelanto);
    let lineasJson: Record<string, unknown>[] = [];
    if (parsed.data.lineas) {
        try {
            const parsedLineas = JSON.parse(parsed.data.lineas);
            if (Array.isArray(parsedLineas)) {
                lineasJson = parsedLineas;
            }
            else {
                throw new Error("El detalle de Aserradero no contiene un arreglo JSON válido.");
            }
        }
        catch {
            throw new Error("El detalle de Aserradero contiene JSON inválido y no puede guardarse.");
        }
    }
    let clienteNombre = CLIENTE_PROVISIONAL_NOMBRE;
    if (!usarClienteProvisional) {
      clienteNombre = await nombreClienteOperacion(parsed.data.clienteId, actor.organizationId);
      const documento = !hasSupabaseEnv() ? demoClientesRows().find(c => c.id === parsed.data.clienteId)?.documento
        : (await getSupabaseServerClient().from('clientes').select('documento').eq('id', parsed.data.clienteId).eq('organization_id', actor.organizationId).maybeSingle()).data?.documento;
      if (parsed.data.tipoComprobante === 'factura' && isCodigoClienteProvisional(documento)) throw new Error('Completa un cliente con RUC valido antes de emitir factura.');
    }
    const correlativo = await nextCorrelativo('servicio_aserradero');
    await registrarServicioIntegral(actor, { tipo: 'aserradero', clave: claveOperacion(formData, true), provisional: usarClienteProvisional,
      documento: { cliente_id: usarClienteProvisional ? null : parsed.data.clienteId, fecha: parsed.data.fecha,
        pies_cubicos: parsed.data.piesCubicos, costo_cubicaje: parsed.data.costoCubicaje, precio_cobrado: parsed.data.precioCobrado,
        utilidad: 0, lineas_json: lineasJson, correlativo, metodo_pago: parsed.data.metodoPago,
        modalidad_pago: modalidadPago, adelanto, fecha_pago_credito: parsed.data.fechaPagoCredito || null },
      caja: montoCaja > 0 ? { fecha: parsed.data.fecha, tipo: 'ingreso', medio: mapMetodoPagoVentaToMedioCaja(parsed.data.metodoPago),
        categoria: 'servicio_aserradero', monto: montoCaja, descripcion: 'Servicio de aserradero - ' + clienteNombre,
        tipo_comprobante: parsed.data.tipoComprobante, url_comprobante: parsed.data.urlComprobante ?? null } : null });
    revalidatePath('/ventas');
    revalidatePath('/ventas/aserradero-servicios');
    revalidatePath('/caja');
}

export async function submitCreateServicioAserraderoForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await createServicioAserradero(formData);
    return {
      success: true,
      error: null,
      message: "Servicio de aserradero registrado correctamente.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo registrar el servicio.",
      message: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Form wrappers (`useActionState`): éxito/toast en cliente sin lanzar Error
// ---------------------------------------------------------------------------

export async function submitCajaMovimientoForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await createCajaMovimiento(formData);
    return {
      success: true,
      error: null,
      message: "Movimiento de caja registrado.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo registrar el movimiento.",
      message: null,
    };
  }
}

export async function submitRegistroGeneralForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await createRegistroGeneral(formData);
    return {
      success: true,
      error: null,
      message: "Registro guardado.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo guardar el registro.",
      message: null,
    };
  }
}

export async function submitContratoAlquilerForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await createContratoAlquiler(formData);
    return {
      success: true,
      error: null,
      message: "Contrato de alquiler registrado.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo registrar el contrato.",
      message: null,
    };
  }
}

export async function submitCreateCotizacionForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await createCotizacion(formData);
    return {
      success: true,
      error: null,
      message: "Cotización guardada.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo guardar la cotización.",
      message: null,
    };
  }
}

export async function submitAprobarCotizacionForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await aprobarCotizacionAOrden(formData);
    return {
      success: true,
      error: null,
      message: "Cotización aceptada; orden creada.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo aceptar la cotización.",
      message: null,
    };
  }
}

export async function submitRepetirGastosMesAnteriorForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await repetirGastosMesAnterior(formData);
    return {
      success: true,
      error: null,
      message: "Gastos del mes anterior copiados.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudieron generar las copias.",
      message: null,
    };
  }
}

export async function submitInventarioCompraRapidaForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await createInventarioCompraRapida(formData);
    return {
      success: true,
      error: null,
      message: "Compra registrada en inventario.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo registrar la compra.",
      message: null,
    };
  }
}

export async function submitCreateMuebleCatalogoForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await createMuebleCatalogo(formData);
    return {
      success: true,
      error: null,
      message: "Mueble agregado al catálogo.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo guardar el mueble.",
      message: null,
    };
  }
}

export async function submitUpdateMuebleCatalogoForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await updateMuebleCatalogo(formData);
    return {
      success: true,
      error: null,
      message: "Catálogo actualizado.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo actualizar el mueble.",
      message: null,
    };
  }
}

export async function submitToggleMuebleCatalogoForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await toggleMuebleCatalogoActivo(formData);
    const activo = String(formData.get("activo") ?? "") === "true";
    return {
      success: true,
      error: null,
      message: activo ? "Mueble activado." : "Mueble desactivado.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo cambiar el estado del mueble.",
      message: null,
    };
  }
}

export async function updateClienteEstado(formData: FormData) {
  await requireMutationAccess(ventasRoles);
  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");
  if (!id || !["activo", "inactivo", "moroso", "vip"].includes(estado)) {
    throw new Error("Datos inválidos.");
  }
  if (!hasSupabaseEnv()) {
    demoUpdateClienteEstado(id, estado as "activo" | "inactivo" | "moroso" | "vip");
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("clientes")
      .update({ estado })
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .is("deleted_at", null);
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/ventas/clientes");
  revalidatePath(`/ventas/clientes/${id}`);
}

export async function deleteCliente(formData: FormData) {
  await requireMutationAccess(ventasRoles);
  const id = String(formData.get("id") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "").trim();
  const redirectWithMessage = (message: string) => {
    const baseUrl = id ? `/gerencial?cliente=${encodeURIComponent(id)}` : "/gerencial";
    const separator = id ? "&" : "?";
    redirect(`${baseUrl}${separator}mensaje=${encodeURIComponent(message)}`);
  };
  if (!id) {
    redirectWithMessage("Identificador inválido para eliminar el cliente.");
  }
  if (confirmacion !== "ELIMINAR CLIENTE") {
    redirectWithMessage('Escribe "ELIMINAR CLIENTE" en el campo de confirmación.');
  }
  if (!hasSupabaseEnv()) {
    demoDeleteCliente(id);
  } else {
    const supabase = getSupabaseServerClient();
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("estado")
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .maybeSingle();
    if (clienteError) {
      redirectWithMessage(clienteError.message || "No se pudo verificar el estado del cliente.");
    }
    if (!cliente) {
      redirectWithMessage("Cliente no encontrado.");
      return;
    }
    if (cliente.estado === "activo") {
      redirectWithMessage("El cliente está activo. Cambia su estado a inactivo antes de eliminar.");
    }

    const dependentTables = [
      { table: "cotizaciones_mueble", label: "cotizaciones de muebles" },
      { table: "cotizaciones_unificadas", label: "cotizaciones unificadas" },
      { table: "ventas_madera", label: "ventas de madera" },
      { table: "ventas_mueble_terminado", label: "ventas de muebles terminados" },
      { table: "servicios_aserradero", label: "servicios de aserradero" },
      { table: "alquileres", label: "contratos de alquiler" },
      { table: "ordenes_produccion", label: "órdenes de producción" },
    ];

    const blocked = [] as string[];
    for (const entry of dependentTables) {
      const { count, error } = await supabase
        .from(entry.table)
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", id)
        .eq("organization_id", DEFAULT_ORG_ID);
      if (error) {
        redirectWithMessage(error.message || "Error al verificar los datos relacionados del cliente.");
      }
      if ((count ?? 0) > 0) {
        blocked.push(entry.label);
      }
    }
    if (blocked.length > 0) {
      redirectWithMessage(
        `El cliente tiene registros relacionados en: ${blocked.join(", ")}. Elimina o desvincula esos registros antes de borrar el cliente.`,
      );
    }

    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID);
    if (error) {
      redirectWithMessage(error.message || "No se pudo eliminar el cliente.");
    }
  }
  revalidatePath("/ventas/clientes");
  revalidatePath("/gerencial");
}

/**
 * Elimina un cliente y TODOS sus registros relacionados en cascada.
 * Solo disponible para owner_admin. Requiere confirmación escrita.
 */
/**
 * Elimina un cliente y TODOS sus registros relacionados en cascada.
 * Solo disponible para owner_admin. Requiere confirmación escrita.
 */
export async function forzarEliminarClienteCompleto(formData: FormData) {
    const actor = await requireMutationAccess(['owner_admin']);
    const id = String(formData.get('id') ?? '').trim();
    const base = '/gerencial?cliente=' + encodeURIComponent(id);
    if (!z.uuid().safeParse(id).success || formData.get('confirmacion') !== 'ELIMINAR TODO')
        return redirect(base + '&mensaje=' + encodeURIComponent('Escribe ELIMINAR TODO para confirmar un cliente válido.'));
    try {
        if (!hasSupabaseEnv()) {
            const d = await import('@/lib/demo-store');
            d.demoEliminarClienteIntegral(actor.organizationId, id);
        }
        else {
            const { error } = await getSupabaseServerClient().rpc('eliminar_cliente_integral', { p_org: actor.organizationId, p_actor: actor.userId, p_id: id });
            if (error)
                throw new Error(mensajeOperacionFinanciera(error));
        }
    }
    catch (error) {
        return redirect(base + '&mensaje=' + encodeURIComponent(error instanceof Error ? error.message : 'No se pudo eliminar el cliente.'));
    }
    revalidatePath('/ventas/clientes');
    revalidatePath('/gerencial');
    revalidatePath('/ventas');
    revalidatePath('/caja');
    revalidatePath('/inventario');
    revalidatePath('/');
    redirect('/gerencial?mensaje=' + encodeURIComponent('Cliente y todos sus registros eliminados correctamente.'));
}

export async function submitCreateClienteForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  const requestedReturnTo = String(formData.get("return_to") ?? "").trim();
  const safeReturnTo = /^\/(?!\/)[^\\\r\n]*$/.test(requestedReturnTo)
    ? requestedReturnTo
    : "/ventas";
  formData.set("skip_redirect", "true");

  try {
    await createCliente(formData);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo registrar el cliente.",
      message: null,
    };
  }

  if (requestedReturnTo) {
    formData.set("return_to", safeReturnTo);
    maybeRedirectToQuickStep(formData);
  }

  return {
    success: true,
    error: null,
    message: "Cliente registrado con éxito.",
  };
}

export async function submitCreateProveedorForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await createProveedor(formData);
    return {
      success: true,
      error: null,
      message: "Proveedor registrado con éxito.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo registrar el proveedor.",
      message: null,
    };
  }
}

export async function submitCreateChoferForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await createChofer(formData);
    return {
      success: true,
      error: null,
      message: "Chofer registrado con éxito.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo registrar el chofer.",
      message: null,
    };
  }
}

const servicioEspecialTarifaUpdateSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  tarifaPorPieza: z.coerce.number().nonnegative("La tarifa debe ser mayor o igual a 0"),
});

export async function updateServicioEspecialTarifa(id: string, nombre: string, tarifaPorPieza: number) {
  const actor = await requireAuthContext({ allowedRoles: ["owner_admin"], redirectTo: null });

  const parsed = servicioEspecialTarifaUpdateSchema.safeParse({
    id,
    nombre,
    tarifaPorPieza,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Datos de tarifa inválidos.");
  }

  if (!hasSupabaseEnv()) {
    const { demoServiciosEspecialesTarifaRows } = await import("@/lib/demo-store");
    if (!demoServiciosEspecialesTarifaRows().some(row=>row.id === parsed.data.id && row.organization_id === actor.organizationId)) throw new Error("Tarifa no disponible en esta empresa.");
    const updated = demoUpdateServicioEspecialTarifa(parsed.data.id, {
      nombre: parsed.data.nombre,
      tarifa_por_pieza: parsed.data.tarifaPorPieza,
    });
    if (!updated) throw new Error("Tarifa no encontrada en el almacén local.");
  } else {
    const supabase = getSupabaseServerClient();
    const { data: updated, error } = await supabase
      .from("servicios_especiales_tarifa")
      .update({
        nombre: parsed.data.nombre,
        tarifa_por_pieza: parsed.data.tarifaPorPieza,
      })
      .eq("id", parsed.data.id)
      .eq("organization_id", actor.organizationId).select("id").maybeSingle();

    if (error || !updated) {
      throw new Error("No se pudo confirmar el cambio de tarifa.");
    }
  }

  revalidatePath("/configuracion");
  return { success: true };
}

export async function updateMargenGananciaPredeterminado(margenGananciaDefaultPct: string | number) {
  const context = await requireAuthContext({allowedRoles:["owner_admin"],redirectTo:null});
  const parsed = margenGananciaConfigSchema.safeParse({margenGananciaDefaultPct});
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "El margen debe ser un número válido.");
  if (!hasSupabaseEnv()) throw new Error("El margen requiere la conexión publicada. No se guardaron cambios desde la copia local.");
  const margen = roundMoney(parsed.data.margenGananciaDefaultPct);
  const {data,error} = await getSupabaseServerClient().from("configuracion_empresa").update({margen_ganancia_default_pct:margen,updated_at:new Date().toISOString()}).eq("organization_id",context.organizationId).select("organization_id").maybeSingle();
  if(error || !data) throw new Error("No se pudo guardar el margen. Comprueba que los datos de empresa estén configurados; no se cambiaron el nombre ni el logo.");
  revalidatePath("/configuracion");revalidatePath("/cotizacion");
  return {ok:true as const,margenGananciaDefaultPct:margen};
}

export async function submitMargenGananciaPredeterminado(value: string | number) {
  try {
    return await updateMargenGananciaPredeterminado(value);
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "No se pudo confirmar el cambio de margen." };
  }
}

export async function submitServicioEspecialTarifa(id: string, nombre: string, tarifa: number) {
  try {
    await updateServicioEspecialTarifa(id, nombre, tarifa);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "No se pudo confirmar el cambio de tarifa." };
  }
}

export async function deleteCajaMovimiento(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireMutationAccess(["owner_admin"]);
    const parsedId = z.string().uuid().safeParse(id);
    if (!parsedId.success) {
      return { ok: false, error: "Identificador inválido." };
    }
    if (!hasSupabaseEnv()) {
      const row = demoCajaRows().find(movimiento => movimiento.id === id && movimiento.organization_id === actor.organizationId && !movimiento.deleted_at);
      if (!row) return { ok: false, error: "Movimiento no encontrado o ya no disponible." };
      const bloqueo = cajaEliminacionBloqueo(row);
      if (bloqueo) return { ok: false, error: bloqueo };
      const res = demoDeleteOneById("caja", id);
      if (res.eliminados === 0) {
        return { ok: false, error: "Movimiento no encontrado o no se pudo eliminar." };
      }
      revalidatePath("/caja");
      revalidatePath("/");
      return { ok: true };
    }
    const supabase = getSupabaseServerClient();
    const { data: row, error: lecturaError } = await supabase
      .from("movimientos_caja")
      .select("periodo_cerrado,modulo_origen,referencia_id")
      .eq("id", id)
      .eq("organization_id", actor.organizationId)
      .is("deleted_at", null)
      .is("voided_at", null)
      .maybeSingle();
    if (lecturaError) return { ok: false, error: "No se pudo comprobar el movimiento. Intenta nuevamente." };
    if (!row) return { ok: false, error: "Movimiento no encontrado o ya no disponible." };
    const bloqueo = cajaEliminacionBloqueo(row);
    if (bloqueo) return { ok: false, error: bloqueo };
    // Comprobar de nuevo al eliminar evita borrar un registro cerrado o enlazado
    // desde otra pestaña después de cargar la confirmación.
    const { data: eliminados, error } = await supabase
      .from("movimientos_caja")
      .delete()
      .eq("id", id)
      .eq("organization_id", actor.organizationId)
      .eq("periodo_cerrado", false)
      .is("referencia_id", null)
      .or("modulo_origen.is.null,modulo_origen.eq.caja")
      .is("deleted_at", null)
      .is("voided_at", null)
      .select("id");
    if (error) {
      return { ok: false, error: "No se pudo eliminar el movimiento. Intenta nuevamente." };
    }
    if (!eliminados?.length) return { ok: false, error: "El movimiento cambió o ya no está disponible. Actualiza Caja para revisarlo." };
    revalidatePath("/caja");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

export async function createUnidadMedida(formData: FormData) {
  try {
    await requireMutationAccess(writerRoles);
    const nombre = formData.get("nombre");
    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
      return { ok: false, error: "El nombre de la unidad es requerido." };
    }

    const nombreTrimmed = nombre.trim();

    if (hasSupabaseEnv()) {
      const supabase = getSupabaseServerClient();

      // Verificar si ya existe para evitar lanzar una violación de restricción única en BD
      const { data: existing } = await supabase
        .from("unidades_medida")
        .select("id")
        .eq("nombre", nombreTrimmed)
        .limit(1);

      if (existing && existing.length > 0) {
        return { ok: false, error: `La unidad de medida "${nombreTrimmed}" ya existe.` };
      }

      const { error } = await supabase.from("unidades_medida").insert({
        organization_id: DEFAULT_ORG_ID,
        nombre: nombreTrimmed,
        activo: true,
      });
      if (error) {
        if (error.code === "23505") {
          return { ok: false, error: `La unidad de medida "${nombreTrimmed}" ya existe.` };
        }
        return { ok: false, error: error.message };
      }
    }
    revalidatePath("/inventario");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

export async function updateContratoAlquiler(formData: FormData): Promise<{
    ok: true;
} | {
    ok: false;
    error: string;
}> {
    try {
        const actor = await requireMutationAccess(writerRoles);
        const id = formData.get("id") as string;
        if (!id)
            return { ok: false, error: "ID de contrato requerido." };
        const parsed = contratoAlquilerSchema.safeParse({
            clienteId: formData.get("cliente_id"),
            activo: formData.get("activo"),
            codigo: formData.get("codigo"),
            representante: formData.get("representante"),
            rucEmpresa: formData.get("ruc_empresa"),
            direccionEjecucion: formData.get("direccion_ejecucion"),
            fechaInicio: formData.get("fecha_inicio"),
            fechaTermino: formData.get("fecha_termino"),
            diasAlquiler: formData.get("dias_alquiler"),
            tarifaUnidad: formData.get("tarifa_unidad"),
            tarifa: formData.get("tarifa"),
            montoTotal: formData.get("monto_total"),
            metodoPago: formData.get("metodo_pago"),
            modalidadPago: formData.get("modalidad_pago"),
            fechaPagoCredito: formData.get("fecha_pago_credito"),
            adelanto: formData.get("adelanto"),
            montoCredito: formData.get("monto_credito"),
            penalidadRetrasoPagoPct: formData.get("penalidad_retraso_pago_pct"),
            penalidadDevolucionTardiaPct: formData.get("penalidad_devolucion_tardia_pct"),
            penalidadDaniosPct: formData.get("penalidad_danios_pct"),
        });
        if (!parsed.success) {
            return { ok: false, error: "Datos de contrato inválidos." };
        }
        const total = roundMoney(parsed.data.montoTotal);
        montoCobradoVenta(total, parsed.data.modalidadPago, parsed.data.adelanto);
        let deposito30 = roundMoney(total * 0.3);
        if (parsed.data.modalidadPago === "adelanto" || parsed.data.modalidadPago === "adelanto_saldo") {
            if (parsed.data.adelanto !== undefined && parsed.data.adelanto > 0) {
                deposito30 = roundMoney(parsed.data.adelanto);
            }
        }
        else if (parsed.data.modalidadPago === "credito") {
            deposito30 = 0;
        }
        const clienteNombre = await nombreClienteOperacion(parsed.data.clienteId, actor.organizationId);
        const documento = { cliente_id: parsed.data.clienteId, activo: parsed.data.activo.trim(), fecha_inicio: parsed.data.fechaInicio,
            fecha_termino: parsed.data.fechaTermino?.trim() || null, tarifa: parsed.data.tarifa, representante: parsed.data.representante?.trim() || null,
            ruc_empresa: parsed.data.rucEmpresa?.trim() || null, direccion_ejecucion: parsed.data.direccionEjecucion?.trim() || null,
            dias_alquiler: parsed.data.diasAlquiler ?? null, tarifa_unidad: parsed.data.tarifaUnidad, monto_total: parsed.data.montoTotal,
            penalidad_retraso_pago_pct: parsed.data.penalidadRetrasoPagoPct, penalidad_devolucion_tardia_pct: parsed.data.penalidadDevolucionTardiaPct,
            penalidad_danios_pct: parsed.data.penalidadDaniosPct, metodo_pago: parsed.data.metodoPago,
            modalidad_pago: parsed.data.modalidadPago === 'adelanto_saldo' ? 'adelanto' : parsed.data.modalidadPago,
            fecha_pago_credito: parsed.data.modalidadPago === 'credito' ? parsed.data.fechaPagoCredito || null : null };
        const medio = mapMetodoPagoVentaToMedioCaja(parsed.data.metodoPago), descripcion = 'Alquiler de mixer - ' + clienteNombre;
        if (!hasSupabaseEnv()) {
            const d = await import('@/lib/demo-store');
            d.demoOperacionAtomica(() => {
                const row = d.demoAlquilerRows().find(r => r.id === id && r.organization_id === actor.organizationId);
                if (!row)
                    throw new Error('Contrato no encontrado.');
                if (row.estado === 'cerrado')
                    throw new Error('El contrato ya está cerrado y no se puede modificar.');
                d.demoComprobarPeriodoAbierto(actor.organizationId, row.fecha_inicio);
                d.demoComprobarPeriodoAbierto(actor.organizationId, documento.fecha_inicio);
                const movimientos = d.demoCajaRows().filter(c => c.organization_id === actor.organizationId && c.referencia_id === id
                    && ['ventas_alquiler', 'alquiler'].includes(c.modulo_origen ?? '') && !c.deleted_at);
                if (movimientos.length > 1)
                    throw new Error('Revisa los cobros vinculados al contrato antes de editar.');
                const caja = movimientos[0];
                if (caja?.periodo_cerrado)
                    throw new Error('El cobro pertenece a un período cerrado.');
                if (caja)
                    d.demoComprobarPeriodoAbierto(actor.organizationId, caja.fecha);
                Object.assign(row, documento, { deposito_30: deposito30 });
                if (caja && deposito30 > 0)
                    Object.assign(caja, { fecha: documento.fecha_inicio, monto: deposito30, medio, descripcion });
                else if (caja)
                    d.demoVoidCajaMov(caja.id, 'El contrato cambió a crédito');
                else if (deposito30 > 0)
                    d.demoCreateCaja({ organization_id: actor.organizationId, fecha: documento.fecha_inicio, tipo: 'ingreso', medio,
                        categoria: 'alquiler_bomba_mixer', monto: deposito30, descripcion, modulo_origen: 'ventas_alquiler', referencia_id: id });
            });
        }
        else {
            const { error } = await getSupabaseServerClient().rpc('editar_alquiler_integral', { p_org: actor.organizationId, p_actor: actor.userId, p_id: id,
                p_documento: documento, p_monto: deposito30, p_medio: medio, p_descripcion: descripcion });
            if (error)
                throw new Error(mensajeOperacionFinanciera(error));
        }
        revalidatePath('/ventas');
        revalidatePath('/ventas/alquiler-mixer');
        revalidatePath('/alquiler');
        revalidatePath('/caja');
        return { ok: true };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'No se pudo actualizar el contrato.' };
    }
}

export async function submitUpdateContratoAlquilerForm(
  prevState: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    const res = await updateContratoAlquiler(formData);
    if (!res.ok) {
      return {
        success: false,
        error: res.error,
        message: null,
      };
    }
    return {
      success: true,
      error: null,
      message: "Contrato actualizado con éxito.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error desconocido.",
      message: null,
    };
  }
}

export async function deleteServicioAserradero(id: string) {
    try {
        const actor = await requireMutationAccess(ventasRoles);
        await anularOperacionIntegral(actor, 'aserradero', id);
        revalidatePath('/ventas/aserradero-servicios');
        revalidatePath('/ventas');
        revalidatePath('/caja');
        revalidatePath('/inventario');
        revalidatePath('/');
        return { ok: true as const };
    }
    catch (error) {
        return { ok: false as const, error: error instanceof Error ? error.message : 'No se pudo anular la operación.' };
    }
}

export async function deleteAlquilerContrato(id: string) {
    try {
        const actor = await requireMutationAccess(ventasRoles);
        await anularOperacionIntegral(actor, 'alquiler', id);
        revalidatePath('/ventas/alquiler-mixer');
        revalidatePath('/ventas');
        revalidatePath('/caja');
        revalidatePath('/inventario');
        revalidatePath('/');
        return { ok: true as const };
    }
    catch (error) {
        return { ok: false as const, error: error instanceof Error ? error.message : 'No se pudo anular la operación.' };
    }
}

export async function updateServicioAserradero(formData: FormData) {
  const actor = await requireMutationAccess(ventasRoles);
  const id = String(formData.get("id") ?? "");
  if (!z.uuid().safeParse(id).success) throw new Error("ID de servicio requerido.");
  const demo = !hasSupabaseEnv();
  const storeDemo = demo ? await import("@/lib/demo-store") : null;
  const supabase = demo ? null : getSupabaseServerClient();
  const lectura = supabase ? await supabase.from("servicios_aserradero").select("*").eq("id", id).eq("organization_id", DEFAULT_ORG_ID).maybeSingle() : null;
  if (lectura?.error) throw new Error(lectura.error.message);
  const current = storeDemo ? storeDemo.demoServiciosAserraderoRows().find(s => s.id === id && s.organization_id === DEFAULT_ORG_ID) : lectura?.data;
  if (!current) throw new Error("Servicio no encontrado.");
  const parsed = servicioAserraderoSchema.safeParse({ clienteId: formData.get("cliente_id"), fecha: formData.get("fecha"),
    piesCubicos: formData.get("pies_cubicos"), costoCubicaje: formData.get("costo_cubicaje"), precioCobrado: formData.get("precio_cobrado"),
    lineas: formData.get("lineas_json"), metodoPago: formData.get("metodo_pago") ?? current.metodo_pago ?? "efectivo",
    modalidadPago: formData.get("modalidad_pago") ?? current.modalidad_pago ?? "contado",
    adelanto: formData.get("adelanto") ?? current.adelanto ?? 0, fechaPagoCredito: formData.get("fecha_pago_credito") ?? current.fecha_pago_credito ?? undefined });
  if (!parsed.success) throw new Error("Datos de servicio inválidos.");
  const modalidadPago = parsed.data.modalidadPago === "adelanto_saldo" ? "adelanto" : parsed.data.modalidadPago;
  const adelanto = modalidadPago === "adelanto" ? parsed.data.adelanto : 0;
  const monto = montoCobradoVenta(parsed.data.precioCobrado, modalidadPago, adelanto);
  let lineas: Json = [];
  if (parsed.data.lineas) {
    try {
      const data: unknown = JSON.parse(parsed.data.lineas);
      if (!Array.isArray(data)) throw new Error("Formato inválido");
      lineas = data as Json;
    } catch { throw new Error("El detalle histórico contiene JSON inválido. No se guardó ningún cambio."); }
  }
  const payload = { cliente_id: parsed.data.clienteId, fecha: parsed.data.fecha, pies_cubicos: parsed.data.piesCubicos,
    costo_cubicaje: parsed.data.costoCubicaje, precio_cobrado: parsed.data.precioCobrado, lineas_json: lineas,
    metodo_pago: parsed.data.metodoPago, modalidad_pago: modalidadPago,
    adelanto, fecha_pago_credito: parsed.data.fechaPagoCredito || null };
  const cliente = storeDemo ? { data: storeDemo.demoClientesRows().find(c => c.id === payload.cliente_id && c.organization_id === DEFAULT_ORG_ID), error: null }
    : await supabase!.from("clientes").select("nombre").eq("id", payload.cliente_id).eq("organization_id", DEFAULT_ORG_ID).maybeSingle();
  if (cliente.error || !cliente.data) throw new Error(cliente.error?.message ?? "Cliente no encontrado.");
  const descripcion = `Servicio de aserradero - ${cliente.data.nombre}`;
  const medio = mapMetodoPagoVentaToMedioCaja(parsed.data.metodoPago);
  if (storeDemo) {
    storeDemo.demoOperacionAtomica(() => {
      const movimientos = storeDemo.demoCajaRows().filter(c => c.organization_id === DEFAULT_ORG_ID && c.referencia_id === id && c.modulo_origen === "ventas_aserradero" && !c.voided_at && !c.deleted_at);
      if (movimientos.length > 1) throw new Error("Revisa los movimientos vinculados al servicio antes de editar.");
      const movimiento = movimientos[0];
      if (movimiento?.periodo_cerrado) throw new Error("El movimiento pertenece a un período cerrado.");
      Object.assign(current, payload);
      if (movimiento && monto > 0) Object.assign(movimiento, { monto, medio, fecha: payload.fecha, descripcion });
      else if (movimiento) storeDemo.demoDeleteOneById("caja", movimiento.id);
      else if (monto > 0) storeDemo.demoCreateCaja({ organization_id: DEFAULT_ORG_ID, fecha: payload.fecha, tipo: "ingreso", medio,
        categoria: "servicio_aserradero", monto, descripcion, modulo_origen: "ventas_aserradero", referencia_id: id });
    });
  } else {
    const { error } = await supabase!.rpc("editar_aserradero_con_caja", { p_org: DEFAULT_ORG_ID, p_actor: actor.userId, p_servicio_id: id,
      p_snapshot_esperado: { precio_cobrado: Number(current.precio_cobrado), metodo_pago: current.metodo_pago ?? null,
        modalidad_pago: current.modalidad_pago ?? null, adelanto: current.adelanto == null ? null : Number(current.adelanto) },
      p_servicio: { ...payload, medio_caja: medio, descripcion_caja: descripcion }, p_monto_caja: monto });
    if (error) throw new Error(mensajeOperacionFinanciera(error));
  }
  revalidatePath("/ventas"); revalidatePath("/ventas/aserradero-servicios"); revalidatePath("/caja");
}

export async function submitUpdateServicioAserraderoForm(
  prevState: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await updateServicioAserradero(formData);
    return {
      success: true,
      error: null,
      message: "Servicio actualizado con éxito.",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error desconocido.",
      message: null,
    };
  }
}

export async function deleteVentaMaderaCortada(id: string) {
    try {
        const actor = await requireMutationAccess(ventasRoles);
        await anularOperacionIntegral(actor, 'venta_madera_cortada', id);
        revalidatePath('/ventas/madera-cortada');
        revalidatePath('/ventas');
        revalidatePath('/caja');
        revalidatePath('/inventario');
        revalidatePath('/');
        return { ok: true as const, error: '' };
    }
    catch (error) {
        return { ok: false as const, error: error instanceof Error ? error.message : 'No se pudo anular la operación.' };
    }
}

export async function updateVentaMaderaCortada(_formData: FormData) {
  await requireMutationAccess(ventasRoles);
  throw new Error(
    "La edición directa fue reemplazada por la revisión controlada de boleta. Usa ‘Revisar y corregir boleta’.",
  );
}

export async function submitUpdateVentaMaderaCortadaForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await updateVentaMaderaCortada(formData);
    return { success: true, error: null, message: "Venta actualizada con éxito." };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error desconocido.",
      message: null,
    };
  }
}

const correccionHistoricaMaderaSchema = z.object({
  id: z.string().uuid(),
  precioPorPt: z.preprocess(preprocessDecimal, z.number().positive()),
  totalMode: z.enum(["calculado", "registrado", "manual"]),
  totalManual: z.preprocess(
    (value) => (value === "" || value === null ? undefined : preprocessDecimal(value)),
    z.number().positive().optional(),
  ),
  motivo: z.string().trim().min(10, "Explica el motivo con al menos 10 caracteres."),
});

function parseCorrectionLines(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Debes completar al menos una línea para la boleta.");
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(raw);
  } catch {
    throw new Error("El detalle de piezas no es válido. Vuelve a revisar las líneas.");
  }
  if (!Array.isArray(parsedRaw) || parsedRaw.length === 0) {
    throw new Error("Debes completar al menos una línea para la boleta.");
  }

  const lineIds = parsedRaw.map((value) => (
    value && typeof value === "object" && "id" in value
      ? Number(value.id)
      : Number.NaN
  ));
  if (lineIds.some((id) => !Number.isInteger(id) || id <= 0)
      || new Set(lineIds).size !== lineIds.length) {
    throw new Error("La revisión de piezas no es válida. Vuelve a abrir la venta.");
  }

  const lines = parseMaderaCortadaCubicajeLines(parsedRaw);
  if (lines.length !== parsedRaw.length) {
    throw new Error("Hay una línea incompleta o inválida. No se guardó ningún cambio.");
  }
  const incompleteIndex = lines.findIndex((line) =>
    !line.descripcion.trim()
    || line.cantidad <= 0
    || line.espesor <= 0
    || line.ancho <= 0
    || line.largo <= 0
  );
  if (incompleteIndex >= 0) {
    throw new Error(
      `Completa la descripción, cantidad y las tres medidas de la pieza ${incompleteIndex + 1}.`,
    );
  }
  const genericDescriptionIndex = lines.findIndex(
    (line) => !isDetailedMaderaCortadaDescription(line.descripcion),
  );
  if (genericDescriptionIndex >= 0) {
    throw new Error(
      `Completa una descripción clara para el cliente en la pieza ${genericDescriptionIndex + 1}.`,
    );
  }
  return { lines, lineIds };
}

function parseConfirmedCorrectionPieces(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);
  } catch {
    return [];
  }
}

/**
 * Corrección documental controlada de una venta histórica. Recalcula todo en
 * el servidor, conserva el PT registrado para no alterar inventario y delega
 * el guardado real a una única transacción auditable en Supabase.
 */
export async function correctVentaMaderaCortadaHistorica(formData: FormData) {
  const actor = await requireAuthContext({ redirectTo: null });
  if (!canCorrectHistoricalMadera(actor.role, actor.uiRole)) {
    throw new Error("Solo Katia puede corregir comprobantes históricos.");
  }
  if (formData.get("confirmacion") !== "on") {
    throw new Error("Confirma que revisaste la comparación antes de guardar.");
  }

  const parsed = correccionHistoricaMaderaSchema.safeParse({
    id: formData.get("id"),
    precioPorPt: formData.get("precio_por_pt"),
    totalMode: formData.get("total_mode"),
    totalManual: formData.get("total_manual"),
    motivo: formData.get("motivo_correccion"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Revisa los datos de la corrección.");
  }
  if (parsed.data.totalMode === "manual" && parsed.data.totalManual === undefined) {
    throw new Error("Ingresa el total manual que quedará en la boleta.");
  }

  const { lines, lineIds } = parseCorrectionLines(formData.get("lineas_cubicaje"));
  const confirmedPieceIds = parseConfirmedCorrectionPieces(formData.get("piezas_confirmadas"));
  const confirmedPieceIdSet = new Set(confirmedPieceIds);
  if (confirmedPieceIds.length !== confirmedPieceIdSet.size
      || lineIds.some((id) => !confirmedPieceIdSet.has(id))
      || confirmedPieceIdSet.size !== lineIds.length) {
    throw new Error("Confirma cada pieza por separado antes de guardar la corrección.");
  }
  const voucherLines = buildMaderaCortadaVoucherLines(lines, parsed.data.precioPorPt);
  if (voucherLines.length !== lines.length) {
    throw new Error("Hay líneas incompletas. No se guardó ningún cambio.");
  }
  const calculatedTotalPt = voucherLines.reduce(
    (sum, line) => sum + ((line.espesor * line.ancho * line.largo) / 12) * line.cantidad,
    0,
  );
  const calculatedQuantity = voucherLines.reduce((sum, line) => sum + line.cantidad, 0);
  const calculatedSubtotal = roundMoney(
    voucherLines.reduce((sum, line) => sum + line.subtotal, 0),
  );

  let current: {
    id: string;
    estado: string;
    total: number;
    total_pt: number;
    precio_por_pt: number;
    modalidad_pago?: string | null;
    lineas_comprobante?: unknown;
  } | null = null;

  if (!hasSupabaseEnv()) {
    const { demoVentasRows } = await import("@/lib/demo-store");
    const row = demoVentasRows().find((item) => item.id === parsed.data.id);
    current = row
      ? {
          id: row.id,
          estado: row.estado,
          total: Number(row.total),
          total_pt: Number(row.total_pt ?? 0),
          precio_por_pt: Number(row.precio_por_pt ?? 0),
          modalidad_pago: row.modalidad_pago,
          lineas_comprobante: row.lineas_comprobante ?? [],
        }
      : null;
  } else {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("ventas_madera_cortada")
      .select("id,estado,total,total_pt,precio_por_pt,modalidad_pago,lineas_comprobante")
      .eq("id", parsed.data.id)
      .eq("organization_id", actor.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    current = data
      ? {
          ...data,
          total: Number(data.total),
          total_pt: Number(data.total_pt),
          precio_por_pt: Number(data.precio_por_pt),
        }
      : null;
  }

  if (!current) throw new Error("No se encontró la venta que quieres corregir.");
  if (current.estado !== "confirmada") {
    throw new Error("Solo se pueden corregir ventas confirmadas.");
  }
  if (Math.abs(calculatedTotalPt - current.total_pt) > 0.01) {
    throw new Error(
      "Las medidas no reproducen el PT registrado. No se guardó nada para proteger el inventario.",
    );
  }

  const nextTotal = parsed.data.totalMode === "registrado"
    ? roundMoney(current.total)
    : parsed.data.totalMode === "manual"
      ? roundMoney(parsed.data.totalManual ?? 0)
      : calculatedSubtotal;
  if (nextTotal <= 0 || calculatedQuantity <= 0) {
    throw new Error("El total y la cantidad corregidos deben ser mayores que cero.");
  }
  const changesTotal = Math.abs(nextTotal - current.total) >= 0.01;

  if (!hasSupabaseEnv()) {
    const { demoVentasRows, demoCajaRows, demoOperacionAtomica, demoComprobarPeriodoAbierto } = await import("@/lib/demo-store");
    const row = demoVentasRows().find((item) => item.id === parsed.data.id);
    if (!row) throw new Error("La venta cambió mientras la revisabas. Vuelve a abrirla.");

    demoOperacionAtomica(() => {
    const cobros = demoCajaRows().filter(c => c.organization_id === actor.organizationId && c.referencia_id === current!.id
      && c.modulo_origen === 'ventas_madera_cortada' && !c.voided_at && !c.deleted_at);
    const recibido = roundMoney(cobros.reduce((sum,c) => sum + (c.tipo === 'ingreso' ? c.monto : c.tipo === 'egreso' ? -c.monto : 0),0));
    if (current.modalidad_pago !== 'contado' && (recibido < 0 || nextTotal < recibido)) throw new Error('El total no puede ser inferior al dinero ya recibido. Revisa los cobros.');
    if (changesTotal && current.modalidad_pago === "contado") {
      const cashRows = demoCajaRows().filter(
        (item) => item.referencia_id === current?.id
          && item.modulo_origen === "ventas_madera_cortada",
      );
      if (cashRows.length !== 1) {
        throw new Error("Caja no tiene un único movimiento activo para esta venta.");
      }
      if (cashRows[0].periodo_cerrado) {
        throw new Error("El movimiento pertenece a un período cerrado y no puede modificarse.");
      }
      demoComprobarPeriodoAbierto(actor.organizationId, cashRows[0].fecha);
      cashRows[0].monto = nextTotal;
    }

    row.precio_por_pt = parsed.data.precioPorPt;
    row.cantidad_piezas = calculatedQuantity;
    row.precio_unitario_comercial = roundMoney(nextTotal / calculatedQuantity);
    row.lineas_comprobante = voucherLines;
    row.total = nextTotal;
    });
  } else {
    const supabase = getSupabaseServerClient();
    let syncCash = false;
    if (changesTotal && current.modalidad_pago === "contado") {
      const { data: cashRows, error: cashError } = await supabase
        .from("movimientos_caja")
        .select("id,periodo_cerrado")
        .eq("organization_id", actor.organizationId)
        .eq("referencia_id", current.id)
        .eq("modulo_origen", "ventas_madera_cortada")
        .is("voided_at", null);
      if (cashError) throw new Error(cashError.message);
      if ((cashRows ?? []).length !== 1) {
        throw new Error("Caja no tiene un único movimiento activo para esta venta.");
      }
      if (cashRows?.[0]?.periodo_cerrado) {
        throw new Error("El movimiento pertenece a un período cerrado y no puede modificarse.");
      }
      syncCash = true;
    }

    const snapshot = {
      total: current.total,
      total_pt: current.total_pt,
      precio_por_pt: current.precio_por_pt,
      lineas_comprobante: current.lineas_comprobante ?? [],
    };
    const { error } = await supabase.rpc("corregir_venta_madera_cortada_historica", {
      p_venta_id: current.id,
      p_actor_id: actor.userId,
      p_snapshot_esperado: snapshot as unknown as Json,
      p_precio_por_pt: parsed.data.precioPorPt,
      p_lineas_comprobante: voucherLines as unknown as Json,
      p_total: nextTotal,
      p_motivo: parsed.data.motivo,
      p_sincronizar_caja: syncCash,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/ventas/madera-cortada");
  revalidatePath(`/ventas/comprobante/madera/${parsed.data.id}`);
  revalidatePath(`/print/a4/boleta/${parsed.data.id}`);
  revalidatePath(`/print/a4/factura/${parsed.data.id}`);
  revalidatePath(`/print/ticket/boleta/${parsed.data.id}`);
  revalidatePath(`/print/ticket/factura/${parsed.data.id}`);
  revalidatePath("/caja");
}

export async function submitCorrectVentaMaderaCortadaHistoricaForm(
  _prev: MutationFormState,
  formData: FormData,
): Promise<MutationFormState> {
  try {
    await correctVentaMaderaCortadaHistorica(formData);
    return {
      success: true,
      error: null,
      message: "Boleta histórica corregida y registrada en auditoría.",
      id: String(formData.get("id") ?? ""),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo corregir la boleta.",
      message: null,
    };
  }
}
