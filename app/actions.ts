"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthContext } from "@/lib/auth";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import {
  demoCambiarEstadoOrden,
  demoCerrarContratoAlquiler,
  demoCerrarMes,
  demoCreateAdelanto,
  demoCreateAlquiler,
  demoCreateCaja,
  demoCreateChofer,
  demoCreateCliente,
  demoCreateCompraMadera,
  demoCreateCotizacionUnificada,
  demoCreateContratoAlquiler,
  demoCreateCorte,
  demoCreateCotizacion,
  demoCreateEmpleado,
  demoCreateInventarioMovimiento,
  demoCreateInventarioProducto,
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
  demoCreateRegistroGeneral,
  demoDeleteByCategory,
  demoDeleteOneById,
  demoResetStore,
  demoCreateServicioAserradero,
  demoCreateSueldo,
  demoCreateVenta,
  demoCreateVentaMaderaCortada,
  demoCreateVentaMuebleTerminado,
  demoCreateZonaEntrega,
  demoMarcarEntregaMueble,
  demoRegistrarConteoInventario,
  demoToggleInventarioProductoActivo,
  demoToggleSecurityControl,
  demoUpdateInventarioProducto,
  demoUpdateCotizacionUnificada,
} from "@/lib/demo-store";
import { totalGeneralDetalle } from "@/lib/cotizacion-calculos";
import {
  cotizacionDetalleV1Schema,
  textoNotasOrdenProduccionDesdeUnificada,
} from "@/lib/cotizacion-unificada-payload";
import { nextCorrelativo } from "@/lib/numeracion";
import type { FilaImportada } from "@/lib/importar";
import { hasSupabaseEnv } from "@/lib/runtime";
import type { MutationFormState } from "@/lib/mutation-form-state";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, Json } from "@/lib/supabase/types";

const cajaSchema = z.object({
  fecha: z.string().min(1),
  tipo: z.enum(["ingreso", "egreso", "transferencia"]),
  medio: z.enum(["efectivo", "banco", "yape", "otro"]),
  categoria: z.string().min(2),
  monto: z.coerce.number().positive(),
  descripcion: z.string().optional(),
  esPersonal: z.coerce.boolean().optional(),
  urlComprobante: z.string().optional(),
});

const ventaSchema = z.object({
  clienteId: z.string().uuid(),
  fecha: z.string().min(1),
  total: z.coerce.number().positive(),
  estado: z.enum(["borrador", "confirmada"]).default("borrador"),
  productoInventarioId: z.string().uuid().optional(),
  cantidadProducto: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().positive().optional(),
  ),
});

const alquilerSchema = z.object({
  clienteId: z.string().uuid(),
  activo: z.string().min(2),
  fechaInicio: z.string().min(1),
  tarifa: z.coerce.number().positive(),
  penalidad: z.coerce.number().nonnegative().default(0),
});

const cotizacionSchema = z.object({
  clienteId: z.string().uuid(),
  fecha: z.string().min(1),
  tipo: z.enum(["mueble_personalizado", "servicio_corte"]),
  especieMadera: z.string().min(2),
  unidadMedida: z.enum(["cm", "in", "otro"]),
  precioCalculado: z.coerce.number().nonnegative(),
  precioAcordado: z.coerce.number().positive(),
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
  nombre: z.string().min(3),
  rol: z.string().min(2),
  fechaIngreso: z.string().min(1),
});

const adelantoSchema = z.object({
  empleadoId: z.string().uuid(),
  fecha: z.string().min(1),
  monto: z.coerce.number().positive(),
});

const sueldoSchema = z.object({
  empleadoId: z.string().uuid(),
  periodo: z.string().min(7),
  montoBruto: z.coerce.number().positive(),
  descuentos: z.coerce.number().nonnegative().default(0),
});

const clienteSchema = z.object({
  nombre: z.string().min(3),
  documento: z.string().optional(),
  telefono: z.string().optional(),
  ruc: z.string().optional(),
  direccion: z.string().optional(),
  tipoPersona: z.enum(["natural", "empresa", ""]).optional(),
});

const choferSchema = z.object({
  nombre: z.string().min(3),
  telefono: z.string().optional(),
  placa: z.string().optional(),
});

const zonaEntregaSchema = z.object({
  nombre: z.string().min(3),
  distanciaKm: z.coerce.number().nonnegative(),
  tarifa: z.coerce.number().nonnegative(),
});

const metodoPagoEnum = z.enum([
  "efectivo",
  "yape",
  "transferencia",
  "billetera_digital",
  "otro",
]);
const modalidadPagoEnum = z.enum(["contado", "adelanto", "credito"]);
const tipoEntregaEnum = z.enum(["puesto_en_obra", "entrega_local", "envio"]);
const estadoEntregaEnum = z.enum(["pendiente", "en_proceso", "entregado"]);

const muebleCatalogoSchema = z.object({
  codigo: z.string().min(2),
  nombre: z.string().min(3),
  descripcion: z.string().optional(),
  precioLista: z.coerce.number().nonnegative(),
  stockDisponible: z.coerce.number().int().nonnegative().default(0),
  fotoUrl: z.string().optional(),
});

const ventaMuebleTerminadoSchema = z.object({
  clienteId: z.string().uuid(),
  muebleCatalogoId: z.string().uuid(),
  cantidad: z.coerce.number().int().positive(),
  precioUnitario: z.coerce.number().positive(),
  fecha: z.string().min(1),
  choferId: z.string().uuid().optional().or(z.literal("")),
  tipoEntrega: tipoEntregaEnum.default("envio"),
  direccionEntrega: z.string().optional(),
  estadoEntrega: estadoEntregaEnum.default("pendiente"),
  metodoPago: metodoPagoEnum.default("efectivo"),
  modalidadPago: modalidadPagoEnum.default("contado"),
  fechaPagoCredito: z.string().optional().or(z.literal("")),
});

const ventaPdfSchema = z.object({
  clienteId: z.string().uuid(),
  fecha: z.string().min(1),
  total: z.coerce.number().positive(),
  tipoEvento: z.string().default("General"),
  detalle: z.string().optional(),
  metodoPago: metodoPagoEnum.default("efectivo"),
  modalidadPago: modalidadPagoEnum.default("contado"),
  referenciaPdf: z.string().optional(),
  banco: z.string().optional(),
  numeroOperacion: z.string().optional(),
  notasCompletas: z.string().optional(),
});

const aprobarCotizacionSchema = z.object({
  cotizacionId: z.string().uuid(),
  notas: z.string().optional(),
  /** Monto del adelanto cobrado al aceptar (si > 0 se asienta en caja). */
  adelanto: z.coerce.number().nonnegative().optional(),
  metodoAdelanto: z.enum(["efectivo", "yape", "banco", "otro"]).optional(),
});

const cambiarEstadoOrdenSchema = z.object({
  ordenId: z.string().uuid(),
  nuevoEstado: z.enum(["en_produccion", "terminado", "entregado"]),
});

const ventaMaderaCortadaSchema = z.object({
  clienteId: z.string().uuid(),
  fecha: z.string().min(1),
  tipoCorte: z.enum(["tabla", "liston", "cuarton", "poste"]),
  totalPt: z.coerce.number().positive(),
  precioPorPt: z.coerce.number().nonnegative(),
  total: z.coerce.number().nonnegative(),
  metodoPago: metodoPagoEnum.default("efectivo"),
  modalidadPago: modalidadPagoEnum.default("contado"),
  fechaPagoCredito: z.string().optional().or(z.literal("")),
  choferId: z.string().uuid().optional().or(z.literal("")),
  tipoEntrega: tipoEntregaEnum.default("envio"),
  direccionEntrega: z.string().optional(),
  estadoEntrega: estadoEntregaEnum.default("pendiente"),
  inventarioProductoId: z.string().uuid().optional().or(z.literal("")),
});

const contratoAlquilerSchema = z.object({
  clienteId: z.string().uuid(),
  activo: z.string().min(2),
  codigo: z.string().optional(),
  representante: z.string().optional(),
  rucEmpresa: z.string().optional(),
  direccionEjecucion: z.string().optional(),
  fechaInicio: z.string().min(1),
  fechaTermino: z.string().optional().or(z.literal("")),
  diasAlquiler: z.coerce.number().int().positive().optional(),
  tarifaUnidad: z.enum(["hora_maquina", "m3", "dia"]).default("hora_maquina"),
  tarifa: z.coerce.number().positive(),
  montoTotal: z.coerce.number().positive(),
  metodoPago: metodoPagoEnum.default("efectivo"),
  modalidadPago: modalidadPagoEnum.default("adelanto"),
  fechaPagoCredito: z.string().optional().or(z.literal("")),
});

const cerrarContratoSchema = z.object({
  contratoId: z.string().uuid(),
  fechaCierre: z.string().min(1),
  observaciones: z.string().optional(),
  retrasoPago: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(false),
  devolucionTardia: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(false),
  danios: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(false),
});

const servicioAserraderoSchema = z.object({
  clienteId: z.string().uuid(),
  fecha: z.string().min(1),
  piesCubicos: z.coerce.number().positive(),
  costoCubicaje: z.coerce.number().nonnegative(),
  precioCobrado: z.coerce.number().positive(),
  lineas: z.string().optional(), // JSON con desglose si aplica
});

const proveedorSchema = z.object({
  nombre: z.string().min(3),
  documento: z.string().optional(),
  telefono: z.string().optional(),
});

const compraMaderaSchema = z.object({
  proveedorId: z.string().uuid(),
  fecha: z.string().min(1),
  especieMadera: z.string().min(2),
  detalle: z.string().optional(),
  cantidad: z.coerce.number().positive(),
  unidad: z.string().min(1).default("unidad"),
  precioUnitario: z.coerce.number().positive(),
  modalidadPago: z.enum(["contado", "fiado"]).default("contado"),
  adelanto: z.coerce.number().nonnegative().default(0),
  estado: z.enum(["borrador", "confirmada"]).default("confirmada"),
  urlComprobante: z.string().optional(),
});

const inventarioProductoSchema = z.object({
  codigo: z.string().min(2),
  nombre: z.string().min(2),
  categoria: z.string().min(2),
  unidad: z.string().min(1),
  stockMinimo: z.coerce.number().nonnegative(),
});

const inventarioMovimientoSchema = z.object({
  productoId: z.string().uuid(),
  fecha: z.string().min(1),
  tipo: z.enum(["entrada_compra", "salida_venta", "ajuste"]),
  cantidad: z.coerce.number().positive(),
  costoUnitario: z.coerce.number().nonnegative().optional(),
  referencia: z.string().optional(),
});

const inventarioCompraRapidaSchema = z.object({
  productoId: z.string().uuid(),
  cantidad: z.coerce.number().positive(),
  costoUnitario: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().nonnegative().optional(),
  ),
  proveedor: z.string().optional(),
  fecha: z.string().min(1),
  nota: z.string().optional(),
});

const inventarioProductoUpdateSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string().min(2),
  nombre: z.string().min(2),
  categoria: z.string().min(2),
  unidad: z.string().min(1),
  stockMinimo: z.coerce.number().nonnegative(),
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
  precioLista: z.coerce.number().nonnegative(),
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
  fecha: z.string().min(1),
  stockContado: z.coerce.number().nonnegative(),
  referencia: z.string().min(3),
});

const registroGeneralSchema = z.object({
  categoriaId: z.string().uuid(),
  fecha: z.string().min(1),
  titulo: z.string().min(3),
  detalle: z.string().optional(),
  monto: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().nonnegative().optional(),
  ),
});

const writerRoles: readonly AppRole[] = ["owner_admin", "gerencia", "almacen", "ventas"];
const ventasRoles: readonly AppRole[] = ["owner_admin", "gerencia", "ventas"];
const cajaRoles: readonly AppRole[] = ["owner_admin", "gerencia", "caja", "operaciones_caja"];
const rrhhRoles: readonly AppRole[] = ["owner_admin", "gerencia", "rrhh"];
const liderazgoRoles: readonly AppRole[] = ["owner_admin", "gerencia"];

async function requireMutationAccess(allowedRoles: readonly AppRole[]) {
  return requireAuthContext({
    allowedRoles,
    redirectTo: null,
  });
}

function parseBoolPersonalImport(f: FilaImportada): boolean {
  const raw = (f.es_personal ?? f.personal ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (["1", "true", "si", "yes", "s"].includes(raw)) return true;
  if (["0", "false", "no", "n"].includes(raw)) return false;
  return false;
}

function normalizeMedioImport(raw: string | undefined): "efectivo" | "banco" | "yape" | "otro" {
  const m = (raw ?? "").trim().toLowerCase();
  if (m === "efectivo" || m === "yape" || m === "banco" || m === "otro") return m;
  return "efectivo";
}

const PENALIDAD_ALQUILER_PCT_DEFAULT = 3;

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
  await requireMutationAccess(cajaRoles);
  const parsed = cajaSchema.safeParse({
    fecha: formData.get("fecha"),
    tipo: formData.get("tipo"),
    medio: formData.get("medio"),
    monto: formData.get("monto"),
    descripcion: formData.get("descripcion"),
    urlComprobante: formData.get("url_comprobante"),
    categoria: formData.get("categoria"),
    esPersonal: formData.get("es_personal"),
  });

  if (!parsed.success) {
    throw new Error("Datos de caja inválidos.");
  }

  if (!hasSupabaseEnv()) {
    demoCreateCaja({
      organization_id: DEFAULT_ORG_ID,
      fecha: parsed.data.fecha,
      tipo: parsed.data.tipo,
      medio: parsed.data.medio,
      categoria: parsed.data.categoria,
      monto: parsed.data.monto,
      descripcion: parsed.data.descripcion ?? null,
      modulo_origen: "caja",
      es_personal: parsed.data.esPersonal ?? false,
      url_comprobante: parsed.data.urlComprobante ?? null,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("movimientos_caja").insert({
      organization_id: DEFAULT_ORG_ID,
      fecha: parsed.data.fecha,
      tipo: parsed.data.tipo,
      medio: parsed.data.medio,
      categoria: parsed.data.categoria,
      monto: parsed.data.monto,
      descripcion: parsed.data.descripcion ?? null,
      modulo_origen: "caja",
      es_personal: parsed.data.esPersonal ?? false,
      url_comprobante: parsed.data.urlComprobante ?? null,
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/caja");
  revalidatePath("/");
}

/**
 * Genera copias de los egresos del mes anterior en el mes actual, con el mismo día.
 * Útil para gastos recurrentes (luz, planilla, alquiler, etc.).
 */
export async function repetirGastosMesAnterior(formData: FormData) {
  await requireMutationAccess(cajaRoles);
  const incluirPersonal =
    formData.get("incluir_personal") === "on" || formData.get("incluir_personal") === "true";

  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;
  const mesPrevio = mesActual === 1 ? 12 : mesActual - 1;
  const anioPrevio = mesActual === 1 ? anioActual - 1 : anioActual;

  if (!hasSupabaseEnv()) {
    const { demoCajaRows } = await import("@/lib/demo-store");
    const todos = demoCajaRows();

    const candidatos = todos.filter((r) => {
      if (r.tipo !== "egreso") return false;
      if (!incluirPersonal && r.es_personal) return false;
      const d = new Date(r.fecha);
      return d.getFullYear() === anioPrevio && d.getMonth() + 1 === mesPrevio;
    });

    let creados = 0;
    for (const r of candidatos) {
      const fechaOriginal = new Date(r.fecha);
      const dia = fechaOriginal.getDate();
      const ultimoDiaMesActual = new Date(anioActual, mesActual, 0).getDate();
      const diaAjustado = Math.min(dia, ultimoDiaMesActual);
      const fechaNueva = `${anioActual}-${String(mesActual).padStart(2, "0")}-${String(diaAjustado).padStart(2, "0")}`;
      demoCreateCaja({
        organization_id: r.organization_id,
        fecha: fechaNueva,
        tipo: r.tipo,
        medio: r.medio,
        categoria: r.categoria,
        monto: Number(r.monto),
        descripcion: r.descripcion ? `${r.descripcion} (recurrente)` : "Recurrente del mes anterior",
        modulo_origen: r.modulo_origen ?? "caja",
        es_personal: r.es_personal,
        url_comprobante: r.url_comprobante,
      });
      creados += 1;
    }
    revalidatePath("/caja");
    if (creados === 0) {
      throw new Error(
        `No se encontraron egresos en ${String(mesPrevio).padStart(2, "0")}/${anioPrevio} para repetir.`,
      );
    }
  } else {
    const supabase = getSupabaseServerClient();
    const startPrev = `${anioPrevio}-${String(mesPrevio).padStart(2, "0")}-01`;
    const lastDayPrev = new Date(anioPrevio, mesPrevio, 0).getDate();
    const endPrev = `${anioPrevio}-${String(mesPrevio).padStart(2, "0")}-${String(lastDayPrev).padStart(2, "0")}`;

    const { data: rows, error: qErr } = await supabase
      .from("movimientos_caja")
      .select("*")
      .eq("organization_id", DEFAULT_ORG_ID)
      .eq("tipo", "egreso")
      .gte("fecha", startPrev)
      .lte("fecha", endPrev);

    if (qErr) {
      throw new Error(qErr.message);
    }

    const candidatos = (rows ?? []).filter((r) => !(r.es_personal && !incluirPersonal));
    if (candidatos.length === 0) {
      throw new Error(
        `No se encontraron egresos en ${String(mesPrevio).padStart(2, "0")}/${anioPrevio} para repetir.`,
      );
    }

    const inserts = candidatos.map((r) => {
      const fechaOriginal = new Date(`${r.fecha}T12:00:00`);
      const dia = fechaOriginal.getDate();
      const ultimoDiaMesActual = new Date(anioActual, mesActual, 0).getDate();
      const diaAjustado = Math.min(dia, ultimoDiaMesActual);
      const fechaNueva = `${anioActual}-${String(mesActual).padStart(2, "0")}-${String(diaAjustado).padStart(2, "0")}`;
      const desc = r.descripcion?.trim()
        ? `${r.descripcion} (recurrente)`
        : "Recurrente del mes anterior";
      return {
        organization_id: DEFAULT_ORG_ID,
        fecha: fechaNueva,
        tipo: r.tipo as "egreso",
        medio: r.medio,
        categoria: r.categoria,
        monto: Number(r.monto),
        descripcion: desc,
        modulo_origen: r.modulo_origen ?? "caja",
        es_personal: Boolean(r.es_personal),
        url_comprobante:
          r.url_comprobante != null && String(r.url_comprobante).trim() !== ""
            ? String(r.url_comprobante)
            : null,
      };
    });

    const { error: insErr } = await supabase.from("movimientos_caja").insert(inserts);
    if (insErr) {
      throw new Error(insErr.message);
    }

    revalidatePath("/caja");
    revalidatePath("/");
  }
}

/**
 * Importa filas desde un archivo Excel (.xlsx) o CSV en uno de los buckets:
 * gastos (caja), clientes o proveedores. Devuelve mediante exception el resumen.
 */
export async function importarArchivo(formData: FormData) {
  await requireMutationAccess(cajaRoles);
  const tipo = String(formData.get("tipo") ?? "");
  const file = formData.get("archivo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Adjunta un archivo .xlsx o .csv válido.");
  }
  if (!hasSupabaseEnv()) {
    const { leerFilas } = await import("@/lib/importar");
    const { demoCreateCliente, demoCreateProveedor } = await import("@/lib/demo-store");
    const filas = await leerFilas(file);
    let creados = 0;

    if (tipo === "gastos") {
      for (const f of filas) {
        const monto = Number(f.monto ?? f.importe ?? 0);
        if (!Number.isFinite(monto) || monto <= 0) continue;
        demoCreateCaja({
          organization_id: DEFAULT_ORG_ID,
          fecha: f.fecha || new Date().toISOString().slice(0, 10),
          tipo: "egreso",
          medio: normalizeMedioImport(f.medio),
          categoria: f.categoria || "general",
          monto,
          descripcion: f.descripcion || null,
          modulo_origen: "caja",
          es_personal: parseBoolPersonalImport(f),
        });
        creados += 1;
      }
    } else if (tipo === "clientes") {
      for (const f of filas) {
        const nombre = (f.nombre || "").trim();
        if (!nombre) continue;
        demoCreateCliente({
          organization_id: DEFAULT_ORG_ID,
          nombre,
          documento: f.documento || f.dni || null,
          telefono: f.telefono || null,
          ruc: f.ruc || null,
          direccion: f.direccion || null,
          tipo_persona: f.tipo_persona === "empresa" ? "empresa" : "natural",
        });
        creados += 1;
      }
    } else if (tipo === "proveedores") {
      for (const f of filas) {
        const nombre = (f.nombre || "").trim();
        if (!nombre) continue;
        demoCreateProveedor({
          organization_id: DEFAULT_ORG_ID,
          nombre,
          documento: f.documento || f.ruc || null,
          telefono: f.telefono || null,
        });
        creados += 1;
      }
    } else {
      throw new Error(`Tipo de importación desconocido: ${tipo}`);
    }

    revalidatePath("/admin/importar");
    revalidatePath("/caja");
    revalidatePath("/ventas");
    if (creados === 0) {
      throw new Error("No se procesó ninguna fila válida del archivo.");
    }
  } else {
    const { leerFilas } = await import("@/lib/importar");
    const supabase = getSupabaseServerClient();
    let creados = 0;

    if (tipo === "gastos") {
      let filas =
        file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xlsm")
          ? await leerFilas(file, { sheetName: "Caja" })
          : await leerFilas(file);
      if (
        filas.length === 0 &&
        (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xlsm"))
      ) {
        filas = await leerFilas(file);
      }
      for (const f of filas) {
        const tipoRow = (f.tipo ?? "egreso").trim().toLowerCase();
        if (tipoRow && tipoRow !== "egreso") continue;
        const monto = Number(String(f.monto ?? f.importe ?? "").replace(",", "."));
        if (!Number.isFinite(monto) || monto <= 0) continue;
        const fechaStr = (f.fecha ?? "").trim() || new Date().toISOString().slice(0, 10);
        const { error } = await supabase.from("movimientos_caja").insert({
          organization_id: DEFAULT_ORG_ID,
          fecha: fechaStr,
          tipo: "egreso",
          medio: normalizeMedioImport(f.medio),
          categoria: (f.categoria || "general").trim() || "general",
          monto,
          descripcion: f.descripcion?.trim() || null,
          modulo_origen: "caja",
          es_personal: parseBoolPersonalImport(f),
        });
        if (error) {
          throw new Error(error.message);
        }
        creados += 1;
      }
    } else if (tipo === "clientes") {
      const filas = await leerFilas(file);
      for (const f of filas) {
        const nombre = (f.nombre || "").trim();
        if (!nombre) continue;
        const { error } = await supabase.from("clientes").insert({
          organization_id: DEFAULT_ORG_ID,
          nombre,
          documento: f.documento || f.dni || null,
          telefono: f.telefono || null,
          ruc: f.ruc || null,
          direccion: f.direccion || null,
          tipo_persona: f.tipo_persona === "empresa" ? "empresa" : "natural",
        });
        if (error) {
          throw new Error(error.message);
        }
        creados += 1;
      }
    } else if (tipo === "proveedores") {
      const filas = await leerFilas(file);
      for (const f of filas) {
        const nombre = (f.nombre || "").trim();
        if (!nombre) continue;
        const { error } = await supabase.from("proveedores").insert({
          organization_id: DEFAULT_ORG_ID,
          nombre,
          documento: f.documento || f.ruc || null,
          telefono: f.telefono || null,
        });
        if (error) {
          throw new Error(error.message);
        }
        creados += 1;
      }
    } else {
      throw new Error(`Tipo de importación desconocido: ${tipo}`);
    }

    revalidatePath("/admin/importar");
    revalidatePath("/caja");
    revalidatePath("/ventas");
    if (creados === 0) {
      throw new Error("No se procesó ninguna fila válida del archivo.");
    }
  }
}

/**
 * Restaura un respaldo JSON completo del store local. Reemplaza todas las
 * tablas existentes; usar con cuidado.
 */
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
  const text = await file.text();
  const { demoImportStore } = await import("@/lib/demo-store");
  const { creados } = demoImportStore(text);
  if (creados === 0) {
    throw new Error("El archivo no contiene datos válidos.");
  }
  revalidatePath("/", "layout");
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
    productoInventarioId: formData.get("inventario_producto_id"),
    cantidadProducto: formData.get("cantidad_producto"),
  });

  if (!parsed.success) {
    throw new Error("Datos de venta inválidos.");
  }

  if (!hasSupabaseEnv()) {
    const anioCorrel = Number(parsed.data.fecha.slice(0, 4)) || new Date().getFullYear();
    const correlativo = await nextCorrelativo("venta_madera", anioCorrel);
    demoCreateVenta({
      organization_id: DEFAULT_ORG_ID,
      cliente_id: parsed.data.clienteId,
      fecha: parsed.data.fecha,
      total: parsed.data.total,
      estado: parsed.data.estado,
      correlativo,
    });
    if (parsed.data.estado === "confirmada" && parsed.data.productoInventarioId && parsed.data.cantidadProducto) {
      demoCreateInventarioMovimiento({
        organization_id: DEFAULT_ORG_ID,
        producto_id: parsed.data.productoInventarioId,
        fecha: parsed.data.fecha,
        tipo: "salida_venta",
        cantidad: parsed.data.cantidadProducto,
        costo_unitario: Number((parsed.data.total / parsed.data.cantidadProducto).toFixed(2)),
        referencia: "Venta confirmada",
      });
    }
  } else {
    const supabase = getSupabaseServerClient();
    const anioCorrel = Number(parsed.data.fecha.slice(0, 4)) || new Date().getFullYear();
    const correlativo = await nextCorrelativo("venta_madera", anioCorrel);

    const { data, error } = await supabase
      .from("ventas_madera")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        cliente_id: parsed.data.clienteId,
        fecha: parsed.data.fecha,
        total: parsed.data.total,
        estado: parsed.data.estado,
        correlativo,
        created_by: actor.userId,
      })
      .select("id")
      .single();
    if (error) {
      throw new Error(error.message);
    }

    if (parsed.data.cantidadProducto) {
      const precioUnitario = Number((parsed.data.total / parsed.data.cantidadProducto).toFixed(2));
      const { error: lineaError } = await supabase.from("ventas_madera_lineas").insert({
        venta_id: data.id,
        item_id: null,
        cantidad: parsed.data.cantidadProducto,
        precio_unitario: precioUnitario,
      });
      if (lineaError) {
        await supabase.from("ventas_madera").delete().eq("id", data.id);
        throw new Error(lineaError.message);
      }
    }

    let inventarioInsertado = false;
    if (parsed.data.estado === "confirmada" && parsed.data.productoInventarioId && parsed.data.cantidadProducto) {
      const { error: inventarioError } = await supabase.from("inventario_movimientos").insert({
        organization_id: DEFAULT_ORG_ID,
        producto_id: parsed.data.productoInventarioId,
        fecha: parsed.data.fecha,
        tipo: "salida_venta",
        cantidad: parsed.data.cantidadProducto,
        referencia: `venta:${data.id}`,
      });
      if (inventarioError) {
        await supabase.from("ventas_madera_lineas").delete().eq("venta_id", data.id);
        await supabase.from("ventas_madera").delete().eq("id", data.id);
        throw new Error(inventarioError.message);
      }
      inventarioInsertado = true;
    }

    if (parsed.data.estado === "confirmada") {
      const { error: cajaError } = await supabase.from("movimientos_caja").insert({
        organization_id: DEFAULT_ORG_ID,
        fecha: parsed.data.fecha,
        tipo: "ingreso",
        medio: "efectivo",
        categoria: "venta_madera",
        monto: parsed.data.total,
        descripcion: `Venta madera ${correlativo}`,
        modulo_origen: "ventas_madera",
        referencia_id: data.id,
        created_by: actor.userId,
        updated_by: actor.userId,
      });
      if (cajaError) {
        if (inventarioInsertado) {
          await supabase
            .from("inventario_movimientos")
            .delete()
            .eq("organization_id", DEFAULT_ORG_ID)
            .eq("referencia", `venta:${data.id}`);
        }
        await supabase.from("ventas_madera_lineas").delete().eq("venta_id", data.id);
        await supabase.from("ventas_madera").delete().eq("id", data.id);
        throw new Error(cajaError.message);
      }
    }
  }

  revalidatePath("/ventas");
  revalidatePath("/caja");
  revalidatePath("/");
  maybeRedirectToQuickStep(formData);
}

export async function createCliente(formData: FormData) {
  await requireMutationAccess(writerRoles);
  const parsed = clienteSchema.safeParse({
    nombre: formData.get("nombre"),
    documento: formData.get("documento"),
    telefono: formData.get("telefono"),
    ruc: formData.get("ruc"),
    direccion: formData.get("direccion"),
    tipoPersona: formData.get("tipo_persona"),
  });
  if (!parsed.success) {
    throw new Error("Datos de cliente inválidos.");
  }
  const tipoPersona =
    parsed.data.tipoPersona === "natural" || parsed.data.tipoPersona === "empresa"
      ? parsed.data.tipoPersona
      : null;
  if (!hasSupabaseEnv()) {
    demoCreateCliente({
      organization_id: DEFAULT_ORG_ID,
      nombre: parsed.data.nombre,
      documento: parsed.data.documento || null,
      telefono: parsed.data.telefono || null,
      ruc: parsed.data.ruc || null,
      direccion: parsed.data.direccion || null,
      tipo_persona: tipoPersona,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("clientes").insert({
      organization_id: DEFAULT_ORG_ID,
      nombre: parsed.data.nombre,
      documento: parsed.data.documento || parsed.data.ruc || null,
      telefono: parsed.data.telefono || null,
      ruc: parsed.data.ruc || null,
      direccion: parsed.data.direccion || null,
      tipo_persona: tipoPersona,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/ventas");
  revalidatePath("/alquiler");
  maybeRedirectToQuickStep(formData);
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
  clienteId: string;
  tipoCliente: "natural" | "empresa";
  fecha: string;
  detalle: unknown;
  total: number;
  estadoFlujo: "pendiente" | "lista_produccion";
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireMutationAccess(ventasRoles);
    const detParsed = cotizacionDetalleV1Schema.safeParse(input.detalle);
    if (!detParsed.success) {
      return { ok: false, error: "Detalle de cotización inválido." };
    }
    const det = detParsed.data;
    const calc = totalGeneralDetalle(det);
    if (Math.abs(calc - input.total) > 0.05) {
      return { ok: false, error: "El total no coincide con el detalle. Revisa los importes." };
    }
    const detalleRecord = JSON.parse(JSON.stringify(det)) as Record<string, unknown>;

    if (!hasSupabaseEnv()) {
      if (input.id) {
        const prev = demoGetCotizacionUnificada(input.id);
        if (!prev) {
          return { ok: false, error: "La cotización ya no existe." };
        }
        if (prev.estado_flujo === "cobrada") {
          return { ok: false, error: "No se puede editar una cotización ya cobrada." };
        }
        demoUpdateCotizacionUnificada(input.id, {
          cliente_id: input.clienteId,
          tipo_cliente: input.tipoCliente,
          fecha: input.fecha,
          total: input.total,
          estado_flujo: input.estadoFlujo,
          detalle: detalleRecord,
        });
        revalidatePath("/cotizacion");
        return { ok: true, id: input.id };
      }
      const correlativo = await nextCorrelativo("cotizacion");
      const row = demoCreateCotizacionUnificada({
        organization_id: DEFAULT_ORG_ID,
        cliente_id: input.clienteId,
        fecha: input.fecha,
        correlativo,
        tipo_cliente: input.tipoCliente,
        total: input.total,
        estado_flujo: input.estadoFlujo,
        detalle: detalleRecord,
      });
      revalidatePath("/cotizacion");
      return { ok: true, id: row.id };
    }

    const supabase = getSupabaseServerClient();
    if (input.id) {
      const { data: prevRow } = await supabase
        .from("cotizaciones_unificadas")
        .select("estado_flujo")
        .eq("id", input.id)
        .eq("organization_id", DEFAULT_ORG_ID)
        .maybeSingle();
      if (prevRow?.estado_flujo === "cobrada") {
        return { ok: false, error: "No se puede editar una cotización ya cobrada." };
      }
      const { error } = await supabase
        .from("cotizaciones_unificadas")
        .update({
          cliente_id: input.clienteId,
          tipo_cliente: input.tipoCliente,
          fecha: input.fecha,
          total: input.total,
          estado_flujo: input.estadoFlujo,
          detalle: det as unknown as Json,
        })
        .eq("id", input.id)
        .eq("organization_id", DEFAULT_ORG_ID);
      if (error) {
        return { ok: false, error: error.message };
      }
      revalidatePath("/cotizacion");
      return { ok: true, id: input.id };
    }
    const correlativo = await nextCorrelativo("cotizacion");
    const { data, error } = await supabase
      .from("cotizaciones_unificadas")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        cliente_id: input.clienteId,
        fecha: input.fecha,
        correlativo,
        tipo_cliente: input.tipoCliente,
        total: input.total,
        estado_flujo: input.estadoFlujo,
        detalle: det as unknown as Json,
      })
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "No se pudo guardar." };
    }
    revalidatePath("/cotizacion");
    return { ok: true, id: data.id };
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
        return { ok: false, error: "Solo se pueden eliminar cotizaciones en estado pendiente." };
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
      .maybeSingle();
    if (!row || row.estado_flujo !== "pendiente") {
      return { ok: false, error: "Solo se pueden eliminar cotizaciones en estado pendiente." };
    }
    const { error } = await supabase
      .from("cotizaciones_unificadas")
      .delete()
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID);
    if (error) {
      return { ok: false, error: error.message };
    }
    revalidatePath("/cotizacion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ocurrio un problema, intenta de nuevo." };
  }
}

export async function marcarListaProduccionCotizacion(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireMutationAccess(ventasRoles);
    if (!hasSupabaseEnv()) {
      const row = demoGetCotizacionUnificada(id);
      if (!row) {
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
      .maybeSingle();
    if (!prevLista) {
      return { ok: false, error: "Cotización no encontrada." };
    }
    if (prevLista.estado_flujo === "cobrada") {
      return { ok: false, error: "No se puede cambiar el estado de una cotización ya cobrada." };
    }
    const { error } = await supabase
      .from("cotizaciones_unificadas")
      .update({ estado_flujo: "lista_produccion" })
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID);
    if (error) {
      return { ok: false, error: error.message };
    }
    revalidatePath("/cotizacion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ocurrio un problema, intenta de nuevo." };
  }
}

export async function pasarCotizacionAProduccion(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireMutationAccess(ventasRoles);
    if (!hasSupabaseEnv()) {
      const row = demoGetCotizacionUnificada(id);
      if (!row) {
        return { ok: false, error: "Cotización no encontrada." };
      }
      if (row.estado_flujo === "cobrada") {
        return { ok: false, error: "La cotización ya fue cobrada." };
      }
      if (row.estado_flujo === "en_produccion") {
        return { ok: false, error: "Esta cotización ya está en producción." };
      }
      demoUpdateCotizacionUnificada(id, { estado_flujo: "en_produccion" });
      demoCreateOrdenProduccion({
        organization_id: DEFAULT_ORG_ID,
        cliente_id: row.cliente_id,
        cotizacion_id: null,
        cotizacion_unificada_id: id,
        estado: "en_produccion",
        notas: `Generada desde cotización ${row.correlativo ?? id.slice(0, 8)} · Total S/ ${row.total.toFixed(2)}`,
        correlativo: await nextCorrelativo("orden_produccion"),
      });
      revalidatePath("/cotizacion");
      revalidatePath("/ventas/muebles-personalizados");
      return { ok: true };
    }
    const supabase = getSupabaseServerClient();
    const { data: row } = await supabase
      .from("cotizaciones_unificadas")
      .select("*")
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .maybeSingle();
    if (!row) {
      return { ok: false, error: "Cotización no encontrada." };
    }
    if (row.estado_flujo === "cobrada") {
      return { ok: false, error: "La cotización ya fue cobrada." };
    }

    const { data: ordenExistente } = await supabase
      .from("ordenes_produccion")
      .select("id")
      .eq("organization_id", DEFAULT_ORG_ID)
      .eq("cotizacion_unificada_id", id)
      .maybeSingle();

    if (ordenExistente) {
      return {
        ok: false,
        error: "Esta cotización ya tiene una orden de producción.",
      };
    }

    const prevEstado = row.estado_flujo;
    const debeActualizarFlujo = prevEstado !== "en_produccion";

    if (debeActualizarFlujo) {
      const { error: upErr } = await supabase
        .from("cotizaciones_unificadas")
        .update({ estado_flujo: "en_produccion" })
        .eq("id", id)
        .eq("organization_id", DEFAULT_ORG_ID);
      if (upErr) {
        return { ok: false, error: upErr.message };
      }
    }

    const correlativo = await nextCorrelativo("orden_produccion");
    const hoy = new Date().toISOString().slice(0, 10);

    const { data: clienteRow } = await supabase
      .from("clientes")
      .select("nombre")
      .eq("id", row.cliente_id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .maybeSingle();

    const clienteNombre = clienteRow?.nombre ?? "Cliente";

    const notas = textoNotasOrdenProduccionDesdeUnificada({
      clienteNombre,
      correlativo: row.correlativo,
      cotIdShort: id.slice(0, 8),
      total: Number(row.total),
      detalle: row.detalle,
    });

    const { error: ordenErr } = await supabase.from("ordenes_produccion").insert({
      organization_id: DEFAULT_ORG_ID,
      cliente_id: row.cliente_id,
      cotizacion_id: null,
      cotizacion_unificada_id: id,
      estado: "en_produccion",
      notas,
      fecha_aprobacion: hoy,
      correlativo,
      created_by: actor.userId,
      updated_by: actor.userId,
    });

    if (ordenErr) {
      if (debeActualizarFlujo) {
        await supabase
          .from("cotizaciones_unificadas")
          .update({ estado_flujo: prevEstado })
          .eq("id", id)
          .eq("organization_id", DEFAULT_ORG_ID);
      }
      return { ok: false, error: ordenErr.message };
    }

    revalidatePath("/cotizacion");
    revalidatePath("/ventas/muebles-personalizados");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ocurrio un problema, intenta de nuevo." };
  }
}

export async function registrarCobroCotizacionUnificada(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireMutationAccess(ventasRoles);
    const fecha = new Date().toISOString().slice(0, 10);

    if (!hasSupabaseEnv()) {
      const row = demoGetCotizacionUnificada(id);
      if (!row) {
        return { ok: false, error: "Cotización no encontrada." };
      }
      if (row.estado_flujo !== "lista_produccion" && row.estado_flujo !== "en_produccion") {
        return {
          ok: false,
          error: "Solo se puede cobrar una cotización en lista de producción o en producción.",
        };
      }
      demoUpdateCotizacionUnificada(id, { estado_flujo: "cobrada" });
      const label = row.correlativo ?? id.slice(0, 8);
      demoCreateCaja({
        organization_id: DEFAULT_ORG_ID,
        fecha,
        tipo: "ingreso",
        medio: "efectivo",
        categoria: "cotizaciones",
        monto: Number(row.total),
        descripcion: `Cobro cotización ${label}`,
        modulo_origen: "cotizacion_unificada",
        referencia_id: id,
        es_personal: false,
      });
      revalidatePath("/cotizacion");
      revalidatePath("/caja");
      return { ok: true };
    }

    const supabase = getSupabaseServerClient();
    const { data: row } = await supabase
      .from("cotizaciones_unificadas")
      .select("estado_flujo,total,correlativo")
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .maybeSingle();

    if (!row) {
      return { ok: false, error: "Cotización no encontrada." };
    }
    if (row.estado_flujo !== "lista_produccion" && row.estado_flujo !== "en_produccion") {
      return {
        ok: false,
        error: "Solo se puede cobrar una cotización en lista de producción o en producción.",
      };
    }

    const prevEstado = row.estado_flujo;
    const label = row.correlativo ?? id.slice(0, 8);

    const { data: updatedRows, error: upErr } = await supabase
      .from("cotizaciones_unificadas")
      .update({ estado_flujo: "cobrada" })
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .in("estado_flujo", ["lista_produccion", "en_produccion"])
      .select("id");

    if (upErr) {
      return { ok: false, error: upErr.message };
    }
    if (!updatedRows?.length) {
      return { ok: false, error: "No se pudo actualizar el estado (¿ya cobrada?)." };
    }

    const { error: cajaErr } = await supabase.from("movimientos_caja").insert({
      organization_id: DEFAULT_ORG_ID,
      fecha,
      tipo: "ingreso",
      medio: "efectivo",
      categoria: "cotizaciones",
      monto: Number(row.total),
      descripcion: `Cobro cotización ${label}`,
      modulo_origen: "cotizacion_unificada",
      referencia_id: id,
      es_personal: false,
    });

    if (cajaErr) {
      await supabase
        .from("cotizaciones_unificadas")
        .update({ estado_flujo: prevEstado })
        .eq("id", id)
        .eq("organization_id", DEFAULT_ORG_ID);
      return { ok: false, error: cajaErr.message };
    }

    revalidatePath("/cotizacion");
    revalidatePath("/caja");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ocurrio un problema, intenta de nuevo." };
  }
}

export async function createChofer(formData: FormData) {
  await requireMutationAccess(writerRoles);
  const parsed = choferSchema.safeParse({
    nombre: formData.get("nombre"),
    telefono: formData.get("telefono"),
    placa: formData.get("placa"),
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
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("choferes").insert({
      organization_id: DEFAULT_ORG_ID,
      nombre: parsed.data.nombre.trim(),
      telefono: parsed.data.telefono?.trim() || null,
      placa: parsed.data.placa?.trim() || null,
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

export async function createZonaEntrega(formData: FormData) {
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
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("proveedores").insert({
      organization_id: DEFAULT_ORG_ID,
      nombre: parsed.data.nombre,
      documento: parsed.data.documento || null,
      telefono: parsed.data.telefono || null,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/ventas");
  maybeRedirectToQuickStep(formData);
}

export async function createCompraMadera(formData: FormData) {
  const actor = await requireMutationAccess(ventasRoles);
  const parsed = compraMaderaSchema.safeParse({
    proveedorId: formData.get("proveedor_id"),
    fecha: formData.get("fecha"),
    especieMadera: formData.get("especie_madera"),
    detalle: formData.get("detalle"),
    cantidad: formData.get("cantidad"),
    unidad: formData.get("unidad"),
    precioUnitario: formData.get("precio_unitario"),
    modalidadPago: formData.get("modalidad_pago"),
    adelanto: formData.get("adelanto"),
    estado: formData.get("estado"),
    urlComprobante: formData.get("url_comprobante"),
  });

  if (!parsed.success) {
    throw new Error("Datos de compra de madera inválidos.");
  }

  const total = Number((parsed.data.cantidad * parsed.data.precioUnitario).toFixed(2));
  const adelanto =
    parsed.data.modalidadPago === "fiado"
      ? Number(Math.min(parsed.data.adelanto, total).toFixed(2))
      : total;
  const saldoPendiente = Number((total - adelanto).toFixed(2));

  if (!hasSupabaseEnv()) {
    demoCreateCompraMadera({
      organization_id: DEFAULT_ORG_ID,
      proveedor_id: parsed.data.proveedorId,
      fecha: parsed.data.fecha,
      especie_madera: parsed.data.especieMadera,
      detalle: parsed.data.detalle ?? null,
      cantidad: parsed.data.cantidad,
      unidad: parsed.data.unidad,
      precio_unitario: parsed.data.precioUnitario,
      total,
      modalidad_pago: parsed.data.modalidadPago,
      adelanto,
      saldo_pendiente: saldoPendiente,
      estado: parsed.data.estado,
      url_comprobante: parsed.data.urlComprobante || null,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("compras_madera")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        proveedor_id: parsed.data.proveedorId,
        fecha: parsed.data.fecha,
        especie_madera: parsed.data.especieMadera,
        detalle: parsed.data.detalle ?? null,
        cantidad: parsed.data.cantidad,
        unidad: parsed.data.unidad,
        precio_unitario: parsed.data.precioUnitario,
        total,
        modalidad_pago: parsed.data.modalidadPago,
        adelanto,
        saldo_pendiente: saldoPendiente,
        estado: parsed.data.estado,
        created_by: actor.userId,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (parsed.data.estado === "confirmada") {
      const egreso = parsed.data.modalidadPago === "fiado" ? adelanto : total;
      if (egreso > 0) {
        const { error: cajaError } = await supabase.from("movimientos_caja").insert({
          organization_id: DEFAULT_ORG_ID,
          fecha: parsed.data.fecha,
          tipo: "egreso",
          medio: "efectivo",
          categoria: "compra_madera",
          monto: egreso,
          descripcion:
            parsed.data.modalidadPago === "fiado"
              ? "Egreso por adelanto de compra fiada"
              : "Egreso por compra de madera al contado",
          modulo_origen: "compras_madera",
          referencia_id: data.id,
          created_by: actor.userId,
          updated_by: actor.userId,
        });
        if (cajaError) {
          throw new Error(cajaError.message);
        }
      }
    }
  }

  revalidatePath("/ventas");
  revalidatePath("/");
  maybeRedirectToQuickStep(formData);
}

export async function createCotizacion(formData: FormData) {
  await requireMutationAccess(ventasRoles);
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
    throw new Error("Datos de cotización inválidos.");
  }

  if (!hasSupabaseEnv()) {
    const correlativo = await nextCorrelativo("cotizacion");
    demoCreateCotizacion({
      organization_id: DEFAULT_ORG_ID,
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
      correlativo,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("cotizaciones_mueble").insert({
      organization_id: DEFAULT_ORG_ID,
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
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/ventas/muebles-corte");
  revalidatePath("/ventas/muebles-personalizados");
  revalidatePath("/");
}

export async function deleteCotizacionMueblePersonalizada(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireMutationAccess(ventasRoles);
    const parsedId = z.string().uuid().safeParse(id);
    if (!parsedId.success) {
      return { ok: false, error: "Identificador inválido." };
    }
    if (!hasSupabaseEnv()) {
      const res = demoDeleteCotizacionMueblePersonalizada(id);
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      revalidatePath("/ventas/muebles-personalizados");
      revalidatePath("/ventas");
      return { ok: true };
    }
    const supabase = getSupabaseServerClient();
    const { data: row, error: selErr } = await supabase
      .from("cotizaciones_mueble")
      .select("id, tipo, cliente_id")
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .maybeSingle();
    if (selErr) {
      return { ok: false, error: selErr.message };
    }
    if (!row) {
      return { ok: false, error: "Cotización no encontrada." };
    }
    if (row.tipo !== "mueble_personalizado") {
      return {
        ok: false,
        error: "Solo se pueden eliminar cotizaciones de mueble personalizado desde este listado.",
      };
    }
    const { data: cliente } = await supabase.from("clientes").select("estado").eq("id", row.cliente_id).maybeSingle();
    if (cliente && cliente.estado === "activo") {
      return { ok: false, error: "El cliente está activo. Cambie su estado manualmente." };
    }
    const { data: orden } = await supabase
      .from("ordenes_produccion")
      .select("id")
      .eq("cotizacion_id", id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .maybeSingle();
    if (orden) {
      return {
        ok: false,
        error:
          "No se puede eliminar: hay una orden de producción vinculada. Quitá o completá esa orden desde el tablero Kanban antes de borrar la cotización.",
      };
    }
    const { error } = await supabase
      .from("cotizaciones_mueble")
      .delete()
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID);
    if (error) {
      return { ok: false, error: error.message };
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
  const valor = Number((base * parsed.data.factor).toFixed(2));

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

export async function createEmpleado(formData: FormData) {
  await requireMutationAccess(rrhhRoles);
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
      organization_id: DEFAULT_ORG_ID,
      nombre: parsed.data.nombre,
      rol: parsed.data.rol,
      fecha_ingreso: parsed.data.fechaIngreso,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("empleados").insert({
      organization_id: DEFAULT_ORG_ID,
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
  await requireMutationAccess(rrhhRoles);
  const parsed = adelantoSchema.safeParse({
    empleadoId: formData.get("empleado_id"),
    fecha: formData.get("fecha"),
    monto: formData.get("monto"),
  });
  if (!parsed.success) {
    throw new Error("Datos de adelanto inválidos.");
  }
  if (!hasSupabaseEnv()) {
    demoCreateAdelanto({
      organization_id: DEFAULT_ORG_ID,
      empleado_id: parsed.data.empleadoId,
      fecha: parsed.data.fecha,
      monto: parsed.data.monto,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("adelantos").insert({
      organization_id: DEFAULT_ORG_ID,
      empleado_id: parsed.data.empleadoId,
      fecha: parsed.data.fecha,
      monto: parsed.data.monto,
      estado: "pendiente",
    });
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/personal");
}

export async function createSueldo(formData: FormData) {
  await requireMutationAccess(rrhhRoles);
  const parsed = sueldoSchema.safeParse({
    empleadoId: formData.get("empleado_id"),
    periodo: formData.get("periodo"),
    montoBruto: formData.get("monto_bruto"),
    descuentos: formData.get("descuentos"),
  });
  if (!parsed.success) {
    throw new Error("Datos de sueldo inválidos.");
  }
  const montoNeto = Number((parsed.data.montoBruto - parsed.data.descuentos).toFixed(2));
  if (!hasSupabaseEnv()) {
    demoCreateSueldo({
      organization_id: DEFAULT_ORG_ID,
      empleado_id: parsed.data.empleadoId,
      periodo: parsed.data.periodo,
      monto_bruto: parsed.data.montoBruto,
      descuentos: parsed.data.descuentos,
      monto_neto: montoNeto,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("sueldos").insert({
      organization_id: DEFAULT_ORG_ID,
      empleado_id: parsed.data.empleadoId,
      periodo: parsed.data.periodo,
      monto_bruto: parsed.data.montoBruto,
      descuentos: parsed.data.descuentos,
      monto_neto: montoNeto,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/personal");
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
  await requireMutationAccess(writerRoles);
  const parsed = inventarioProductoSchema.safeParse({
    codigo: formData.get("codigo"),
    nombre: formData.get("nombre"),
    categoria: formData.get("categoria"),
    unidad: formData.get("unidad"),
    stockMinimo: formData.get("stock_minimo"),
  });
  if (!parsed.success) {
    throw new Error("Datos de producto inválidos.");
  }

  if (!hasSupabaseEnv()) {
    demoCreateInventarioProducto({
      organization_id: DEFAULT_ORG_ID,
      codigo: parsed.data.codigo,
      nombre: parsed.data.nombre,
      categoria: parsed.data.categoria,
      unidad: parsed.data.unidad,
      stock_minimo: parsed.data.stockMinimo,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("inventario_productos").insert({
      organization_id: DEFAULT_ORG_ID,
      codigo: parsed.data.codigo,
      nombre: parsed.data.nombre,
      categoria: parsed.data.categoria,
      unidad: parsed.data.unidad,
      stock_minimo: parsed.data.stockMinimo,
      stock_actual: 0,
      activo: true,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/inventario");
  revalidatePath("/");
  maybeRedirectToQuickStep(formData);
}

export async function createInventarioMovimiento(formData: FormData) {
  await requireMutationAccess(writerRoles);
  const parsed = inventarioMovimientoSchema.safeParse({
    productoId: formData.get("producto_id"),
    fecha: formData.get("fecha"),
    tipo: formData.get("tipo"),
    cantidad: formData.get("cantidad"),
    costoUnitario: formData.get("costo_unitario"),
    referencia: formData.get("referencia"),
  });
  if (!parsed.success) {
    throw new Error("Datos de movimiento de inventario inválidos.");
  }

  if (!hasSupabaseEnv()) {
    demoCreateInventarioMovimiento({
      organization_id: DEFAULT_ORG_ID,
      producto_id: parsed.data.productoId,
      fecha: parsed.data.fecha,
      tipo: parsed.data.tipo,
      cantidad: parsed.data.cantidad,
      costo_unitario: parsed.data.costoUnitario ?? null,
      referencia: parsed.data.referencia ?? null,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("inventario_movimientos").insert({
      organization_id: DEFAULT_ORG_ID,
      producto_id: parsed.data.productoId,
      fecha: parsed.data.fecha,
      tipo: parsed.data.tipo,
      cantidad: parsed.data.cantidad,
      costo_unitario: parsed.data.costoUnitario ?? null,
      referencia: parsed.data.referencia ?? null,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/inventario");
  revalidatePath("/");
  maybeRedirectToQuickStep(formData);
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
  });
  if (!parsed.success) {
    throw new Error("Datos de compra inválidos.");
  }

  const referenciaPartes = [parsed.data.proveedor?.trim(), parsed.data.nota?.trim()].filter(Boolean);
  const referencia = referenciaPartes.join(" · ") || null;
  const costoUnitario = parsed.data.costoUnitario ?? null;
  const montoCompra =
    costoUnitario && costoUnitario > 0 ? Number((parsed.data.cantidad * costoUnitario).toFixed(2)) : 0;

  if (!hasSupabaseEnv()) {
    demoCreateInventarioMovimiento({
      organization_id: DEFAULT_ORG_ID,
      producto_id: parsed.data.productoId,
      fecha: parsed.data.fecha,
      tipo: "entrada_compra",
      cantidad: parsed.data.cantidad,
      costo_unitario: costoUnitario,
      referencia,
    });
    if (montoCompra > 0) {
      demoCreateCaja({
        organization_id: DEFAULT_ORG_ID,
        fecha: parsed.data.fecha,
        tipo: "egreso",
        medio: "efectivo",
        categoria: "compra_inventario",
        monto: montoCompra,
        descripcion: referencia ? `Compra de inventario: ${referencia}` : "Compra de inventario",
        modulo_origen: "inventario",
      });
    }
  } else {
    const supabase = getSupabaseServerClient();
    const { data: producto, error: productoErr } = await supabase
      .from("inventario_productos")
      .select("id, nombre")
      .eq("id", parsed.data.productoId)
      .eq("organization_id", DEFAULT_ORG_ID)
      .maybeSingle();
    if (productoErr) throw new Error(productoErr.message);
    if (!producto) throw new Error("Producto no encontrado.");

    const { data: movimiento, error: movErr } = await supabase
      .from("inventario_movimientos")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        producto_id: parsed.data.productoId,
        fecha: parsed.data.fecha,
        tipo: "entrada_compra",
        cantidad: parsed.data.cantidad,
        costo_unitario: costoUnitario,
        referencia,
      })
      .select("id")
      .single();
    if (movErr || !movimiento) throw new Error(movErr?.message ?? "No se pudo registrar la entrada.");

    if (montoCompra > 0) {
      const { error: cajaErr } = await supabase.from("movimientos_caja").insert({
        organization_id: DEFAULT_ORG_ID,
        fecha: parsed.data.fecha,
        tipo: "egreso",
        medio: "efectivo",
        categoria: "compra_inventario",
        monto: montoCompra,
        descripcion: `Compra de inventario: ${producto.nombre}`,
        modulo_origen: "inventario",
        referencia_id: movimiento.id,
        created_by: actor.userId,
        updated_by: actor.userId,
      });
      if (cajaErr) {
        throw new Error(cajaErr.message);
      }
    }
  }

  revalidatePath("/inventario");
  revalidatePath("/caja");
  revalidatePath("/");
}

export async function updateInventarioProducto(formData: FormData) {
  await requireMutationAccess(writerRoles);
  const parsed = inventarioProductoUpdateSchema.safeParse({
    id: formData.get("id"),
    codigo: formData.get("codigo"),
    nombre: formData.get("nombre"),
    categoria: formData.get("categoria"),
    unidad: formData.get("unidad"),
    stockMinimo: formData.get("stock_minimo"),
  });
  if (!parsed.success) throw new Error("Datos de producto inválidos.");

  if (!hasSupabaseEnv()) {
    const updated = demoUpdateInventarioProducto(parsed.data.id, {
      codigo: parsed.data.codigo,
      nombre: parsed.data.nombre,
      categoria: parsed.data.categoria,
      unidad: parsed.data.unidad,
      stock_minimo: parsed.data.stockMinimo,
    });
    if (!updated) throw new Error("Producto no encontrado.");
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("inventario_productos")
      .update({
        codigo: parsed.data.codigo,
        nombre: parsed.data.nombre,
        categoria: parsed.data.categoria,
        unidad: parsed.data.unidad,
        stock_minimo: parsed.data.stockMinimo,
      })
      .eq("id", parsed.data.id)
      .eq("organization_id", DEFAULT_ORG_ID);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/inventario");
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
  await requireMutationAccess(writerRoles);
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
    const supabase = getSupabaseServerClient();
    if (!forzar) {
      const { data: movBlock, error: movErr } = await supabase
        .from("inventario_movimientos")
        .select("id")
        .eq("producto_id", parsed.data.id)
        .eq("organization_id", DEFAULT_ORG_ID)
        .limit(1);
      if (movErr) throw new Error(`No se pudo verificar el kardex: ${movErr.message}`);
      if (movBlock && movBlock.length > 0) {
        throw new Error(
          "[INV_KARDEX_BLOCK] No se puede eliminar: este producto tiene al menos un movimiento en el kardex. Eliminá primero esos movimientos en la pestaña Kardex o desactivá el producto.",
        );
      }
    } else {
      const { error: delMovErr } = await supabase
        .from("inventario_movimientos")
        .delete()
        .eq("producto_id", parsed.data.id)
        .eq("organization_id", DEFAULT_ORG_ID);
      if (delMovErr) {
        throw new Error(`No se pudieron eliminar los movimientos del kardex: ${delMovErr.message}`);
      }
    }
    const { data: deletedRows, error: delErr } = await supabase
      .from("inventario_productos")
      .delete()
      .eq("id", parsed.data.id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .select("id");
    if (delErr) {
      if (/foreign key|violates|restrict|23503/i.test(delErr.message)) {
        throw new Error(
          "No se puede eliminar: el producto sigue referenciado en el sistema (p. ej. ventas o tablas vinculadas).",
        );
      }
      throw new Error(delErr.message);
    }
    if (!deletedRows?.length) {
      throw new Error(
        "No se eliminó ningún registro. Verificá que el producto exista y que la variable de entorno ERP_ORG_ID coincida con organization_id en Supabase.",
      );
    }
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
  await requireMutationAccess(writerRoles);
  const parsed = inventarioDeleteMovimientoSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) throw new Error("Movimiento inválido.");

  if (!hasSupabaseEnv()) {
    const ok = demoDeleteInventarioMovimiento(parsed.data.id);
    if (!ok) throw new Error("Movimiento no encontrado.");
  } else {
    const supabase = getSupabaseServerClient();
    const { data: mov } = await supabase
      .from("inventario_movimientos")
      .select("*")
      .eq("id", parsed.data.id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .maybeSingle();
    if (!mov) throw new Error("Movimiento no encontrado.");

    const delta =
      mov.tipo === "entrada_compra"
        ? -Number(mov.cantidad)
        : mov.tipo === "salida_venta"
          ? Number(mov.cantidad)
          : -Number(mov.cantidad);
    const { data: producto } = await supabase
      .from("inventario_productos")
      .select("stock_actual")
      .eq("id", mov.producto_id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .maybeSingle();
    const stockActual = Number(producto?.stock_actual ?? 0);
    const stockNuevo = Math.max(0, stockActual + delta);

    const { error: deleteError } = await supabase
      .from("inventario_movimientos")
      .delete()
      .eq("id", parsed.data.id)
      .eq("organization_id", DEFAULT_ORG_ID);
    if (deleteError) throw new Error(deleteError.message);
    const { error: updateError } = await supabase
      .from("inventario_productos")
      .update({ stock_actual: stockNuevo })
      .eq("id", mov.producto_id)
      .eq("organization_id", DEFAULT_ORG_ID);
    if (updateError) throw new Error(updateError.message);
  }
  revalidatePath("/inventario");
}

export async function registrarConteoInventario(formData: FormData) {
  await requireMutationAccess(writerRoles);
  const parsed = inventarioConteoSchema.safeParse({
    productoId: formData.get("producto_id"),
    fecha: formData.get("fecha"),
    stockContado: formData.get("stock_contado"),
    referencia: formData.get("referencia"),
  });
  if (!parsed.success) throw new Error("Datos de conteo inválidos.");

  if (!hasSupabaseEnv()) {
    const result = demoRegistrarConteoInventario(
      parsed.data.productoId,
      parsed.data.stockContado,
      parsed.data.fecha,
      parsed.data.referencia,
    );
    if (!result.ok) throw new Error(result.error);
  } else {
    const supabase = getSupabaseServerClient();
    const { data: producto } = await supabase
      .from("inventario_productos")
      .select("*")
      .eq("id", parsed.data.productoId)
      .eq("organization_id", DEFAULT_ORG_ID)
      .maybeSingle();
    if (!producto) throw new Error("Producto no encontrado.");
    const stockActual = Number(producto.stock_actual);
    const diferencia = Number((parsed.data.stockContado - stockActual).toFixed(2));
    if (Math.abs(diferencia) > 0.0001) {
      const { error: movError } = await supabase.from("inventario_movimientos").insert({
        organization_id: DEFAULT_ORG_ID,
        producto_id: parsed.data.productoId,
        fecha: parsed.data.fecha,
        tipo: "ajuste",
        cantidad: diferencia,
        costo_unitario: null,
        referencia: parsed.data.referencia,
      });
      if (movError) throw new Error(movError.message);
      const { error: prodError } = await supabase
        .from("inventario_productos")
        .update({ stock_actual: Number((stockActual + diferencia).toFixed(2)) })
        .eq("id", parsed.data.productoId)
        .eq("organization_id", DEFAULT_ORG_ID);
      if (prodError) throw new Error(prodError.message);
    }
  }
  revalidatePath("/inventario");
}

export async function createRegistroGeneral(formData: FormData) {
  await requireMutationAccess(writerRoles);
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

  if (!hasSupabaseEnv()) {
    demoCreateRegistroGeneral({
      organization_id: DEFAULT_ORG_ID,
      categoria_id: parsed.data.categoriaId,
      fecha: parsed.data.fecha,
      titulo: parsed.data.titulo,
      detalle: parsed.data.detalle ?? null,
      monto: parsed.data.monto ?? null,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("registros_generales").insert({
      organization_id: DEFAULT_ORG_ID,
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

export async function createVentaDesdePdf(formData: FormData) {
  const actor = await requireMutationAccess(ventasRoles);
  const parsed = ventaPdfSchema.safeParse({
    clienteId: formData.get("cliente_id"),
    fecha: formData.get("fecha"),
    total: formData.get("total"),
    tipoEvento: formData.get("tipo_evento"),
    detalle: formData.get("detalle"),
    metodoPago: formData.get("metodo_pago"),
    modalidadPago: formData.get("modalidad_pago"),
    referenciaPdf: formData.get("referencia_pdf"),
    banco: formData.get("banco"),
    numeroOperacion: formData.get("numero_operacion"),
    notasCompletas: formData.get("notas_completas"),
  });

  if (!parsed.success) {
    console.error("[createVentaDesdePdf] Error de validación:", parsed.error);
    throw new Error("Datos de venta PDF inválidos.");
  }

  const { 
    clienteId, fecha, total, tipoEvento, detalle, 
    metodoPago, modalidadPago, referenciaPdf, 
    banco, numeroOperacion, notasCompletas 
  } = parsed.data;

  if (!hasSupabaseEnv()) {
    const correlativo = await nextCorrelativo("venta_pdf");
    demoCreateVenta({
      organization_id: DEFAULT_ORG_ID,
      cliente_id: clienteId,
      fecha,
      total,
      estado: "confirmada",
      correlativo: `PDF-${correlativo}`,
    });
    // También asentar en caja
    demoCreateCaja({
      organization_id: DEFAULT_ORG_ID,
      fecha,
      tipo: "ingreso",
      medio: mapMetodoPagoVentaToMedioCaja(metodoPago),
      categoria: `venta_pdf_${tipoEvento.toLowerCase()}`,
      monto: total,
      descripcion: `Venta PDF (${tipoEvento}): ${detalle || "Sin detalle"}. Ref: ${referenciaPdf || "N/A"}. Banco: ${banco || "N/A"}. Op: ${numeroOperacion || "N/A"}. Notas: ${notasCompletas || "N/A"}`,
      modulo_origen: "ventas_pdf",
      es_personal: false,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const correlativo = await nextCorrelativo("venta_pdf");
    
    const { data: venta, error: ventaErr } = await supabase.from("ventas_madera").insert({
      organization_id: DEFAULT_ORG_ID,
      cliente_id: clienteId,
      fecha,
      total,
      estado: "confirmada",
      correlativo: `PDF-${correlativo}`,
      created_by: actor.userId
    }).select("id").single();

    if (ventaErr) throw new Error(ventaErr.message);

    // Asentar en caja con todos los datos detallados
    const { error: cajaErr } = await supabase.from("movimientos_caja").insert({
      organization_id: DEFAULT_ORG_ID,
      fecha,
      tipo: "ingreso",
      medio: mapMetodoPagoVentaToMedioCaja(metodoPago),
      categoria: "ventas_pdf",
      descripcion: `Venta PDF ${tipoEvento} - Ref: ${referenciaPdf || correlativo} | Banco: ${banco || "N/A"} | Op: ${numeroOperacion || "N/A"} | Detalles: ${detalle || ""} | Notas: ${notasCompletas || ""}`,
      modulo_origen: "ventas_madera",
      referencia_id: venta.id,
      created_by: actor.userId
    });

    if (cajaErr) throw new Error(cajaErr.message);
  }

  revalidatePath("/ventas");
  revalidatePath("/caja");
  revalidatePath("/registro");
  
  const returnTo = formData.get("return_to")?.toString();
  if (returnTo) redirect(returnTo);
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
  await requireMutationAccess(ventasRoles);
  const parsed = muebleCatalogoUpdateSchema.safeParse({
    id: formData.get("id"),
    descripcion: formData.get("descripcion"),
    precioLista: formData.get("precio_lista"),
    fotoUrl: formData.get("foto_url"),
  });
  if (!parsed.success) {
    throw new Error("Datos de mueble inválidos.");
  }

  if (!hasSupabaseEnv()) {
    const updated = demoUpdateMuebleCatalogo(parsed.data.id, {
      descripcion: parsed.data.descripcion?.trim() || null,
      precio_lista: parsed.data.precioLista,
      foto_url: parsed.data.fotoUrl?.trim() || null,
    });
    if (!updated) throw new Error("Mueble no encontrado.");
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("muebles_catalogo")
      .update({
        descripcion: parsed.data.descripcion?.trim() || null,
        precio_lista: parsed.data.precioLista,
        foto_url: parsed.data.fotoUrl?.trim() || null,
      })
      .eq("id", parsed.data.id)
      .eq("organization_id", DEFAULT_ORG_ID);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/inventario");
  revalidatePath("/ventas");
  revalidatePath("/ventas/muebles-terminados");
  revalidatePath("/cotizacion");
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
      if (row.activo) return { ok: false, error: "Solo se pueden eliminar muebles inactivos." };
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
  });
  if (!parsed.success) {
    throw new Error("Datos de venta de mueble inválidos.");
  }

  const total = Number((parsed.data.cantidad * parsed.data.precioUnitario).toFixed(2));

  if (!hasSupabaseEnv()) {
    demoCreateVentaMuebleTerminado({
      organization_id: DEFAULT_ORG_ID,
      cliente_id: parsed.data.clienteId,
      mueble_catalogo_id: parsed.data.muebleCatalogoId,
      cantidad: parsed.data.cantidad,
      precio_unitario: parsed.data.precioUnitario,
      total,
      chofer_id: parsed.data.choferId || null,
      tipo_entrega: parsed.data.tipoEntrega,
      direccion_entrega: parsed.data.direccionEntrega || null,
      estado_entrega: parsed.data.estadoEntrega,
      metodo_pago: parsed.data.metodoPago,
      modalidad_pago: parsed.data.modalidadPago,
      fecha_pago_credito: parsed.data.fechaPagoCredito || null,
      fecha: parsed.data.fecha,
      correlativo: await nextCorrelativo("venta_mueble"),
    });
  } else {
    const supabase = getSupabaseServerClient();
    const muebleId = parsed.data.muebleCatalogoId;

    const { data: mueble, error: muebleErr } = await supabase
      .from("muebles_catalogo")
      .select("id, nombre, stock_disponible")
      .eq("id", muebleId)
      .eq("organization_id", DEFAULT_ORG_ID)
      .maybeSingle();

    if (muebleErr) {
      throw new Error(muebleErr.message);
    }
    if (!mueble) {
      throw new Error("El mueble seleccionado no existe en el catálogo.");
    }
    if (mueble.stock_disponible < parsed.data.cantidad) {
      throw new Error("Stock insuficiente para esta venta.");
    }

    const correlativo = await nextCorrelativo("venta_mueble");
    const fechaCredito =
      parsed.data.modalidadPago === "credito" && parsed.data.fechaPagoCredito
        ? parsed.data.fechaPagoCredito
        : null;

    const { data: venta, error: ventaErr } = await supabase
      .from("ventas_mueble_terminado")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        cliente_id: parsed.data.clienteId,
        mueble_catalogo_id: muebleId,
        cantidad: parsed.data.cantidad,
        precio_unitario: parsed.data.precioUnitario,
        total,
        chofer_id: parsed.data.choferId || null,
        tipo_entrega: parsed.data.tipoEntrega,
        direccion_entrega: parsed.data.direccionEntrega?.trim() || null,
        estado_entrega: parsed.data.estadoEntrega,
        metodo_pago: parsed.data.metodoPago,
        modalidad_pago: parsed.data.modalidadPago,
        fecha_pago_credito: fechaCredito,
        correlativo,
        fecha: parsed.data.fecha,
        created_by: actor.userId,
        updated_by: actor.userId,
      })
      .select("id")
      .single();

    if (ventaErr || !venta) {
      throw new Error(ventaErr?.message ?? "No se pudo registrar la venta.");
    }

    const stockPrevio = mueble.stock_disponible;
    const { data: muebleActualizado, error: stockErr } = await supabase
      .from("muebles_catalogo")
      .update({
        stock_disponible: stockPrevio - parsed.data.cantidad,
      })
      .eq("id", muebleId)
      .eq("organization_id", DEFAULT_ORG_ID)
      .eq("stock_disponible", stockPrevio)
      .select("id")
      .maybeSingle();

    if (stockErr) {
      await supabase.from("ventas_mueble_terminado").delete().eq("id", venta.id);
      throw new Error(stockErr.message);
    }
    if (!muebleActualizado) {
      await supabase.from("ventas_mueble_terminado").delete().eq("id", venta.id);
      throw new Error("El stock cambió mientras procesabas la venta; intenta de nuevo.");
    }

    const montoCaja = parsed.data.modalidadPago === "credito" ? 0 : total;
    if (montoCaja > 0) {
      const medioCaja = mapMetodoPagoVentaToMedioCaja(parsed.data.metodoPago);
      const { error: cajaError } = await supabase.from("movimientos_caja").insert({
        organization_id: DEFAULT_ORG_ID,
        fecha: parsed.data.fecha,
        tipo: "ingreso",
        medio: medioCaja,
        categoria: "venta_mueble_terminado",
        monto: montoCaja,
        descripcion: `Venta de ${parsed.data.cantidad} × ${mueble.nombre}`,
        modulo_origen: "ventas_muebles_terminados",
        referencia_id: venta.id,
        created_by: actor.userId,
        updated_by: actor.userId,
      });
      if (cajaError) {
        await supabase
          .from("muebles_catalogo")
          .update({ stock_disponible: stockPrevio })
          .eq("id", muebleId)
          .eq("organization_id", DEFAULT_ORG_ID);
        await supabase.from("ventas_mueble_terminado").delete().eq("id", venta.id);
        throw new Error(cajaError.message);
      }
    }
  }

  revalidatePath("/ventas");
  revalidatePath("/ventas/muebles-terminados");
  revalidatePath("/caja");
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

// ---------------------------------------------------------------------------
// Sub-flujo 2: Muebles personalizados (cotizaciones → órdenes)
// ---------------------------------------------------------------------------

/**
 * Acepta una cotización y, en una sola operación atómica, crea (1) la orden de
 * producción y, si se proporciona, (2) el ingreso de adelanto en caja.
 */
export async function aprobarCotizacionAOrden(formData: FormData) {
  const actor = await requireMutationAccess(ventasRoles);
  const parsed = aprobarCotizacionSchema.safeParse({
    cotizacionId: formData.get("cotizacion_id"),
    notas: formData.get("notas"),
    adelanto: formData.get("adelanto"),
    metodoAdelanto: formData.get("metodo_adelanto"),
  });
  if (!parsed.success) {
    throw new Error("Cotización inválida.");
  }
  if (!hasSupabaseEnv()) {
    const { demoCotizacionesRows } = await import("@/lib/demo-store");
    const cotizacion = demoCotizacionesRows().find((c) => c.id === parsed.data.cotizacionId);
    if (!cotizacion) {
      throw new Error("La cotización ya no existe.");
    }
    demoCreateOrdenProduccion({
      organization_id: DEFAULT_ORG_ID,
      cliente_id: cotizacion.cliente_id,
      cotizacion_id: cotizacion.id,
      notas: parsed.data.notas || null,
      correlativo: await nextCorrelativo("orden_produccion"),
    });

    const adelanto = parsed.data.adelanto ?? 0;
    if (adelanto > 0) {
      const medio = parsed.data.metodoAdelanto ?? "efectivo";
      demoCreateCaja({
        organization_id: DEFAULT_ORG_ID,
        fecha: new Date().toISOString().slice(0, 10),
        tipo: "ingreso",
        medio,
        categoria: "adelanto_mueble_personalizado",
        monto: adelanto,
        descripcion: `Adelanto al aprobar cotización ${cotizacion.correlativo ?? cotizacion.id.slice(0, 8)}`,
        modulo_origen: "ventas",
        referencia_id: cotizacion.id,
      });
    }
  } else {
    const supabase = getSupabaseServerClient();
    const { data: cot, error: cotErr } = await supabase
      .from("cotizaciones_mueble")
      .select("id, cliente_id, estado, fecha")
      .eq("id", parsed.data.cotizacionId)
      .eq("organization_id", DEFAULT_ORG_ID)
      .maybeSingle();

    if (cotErr) {
      throw new Error(cotErr.message);
    }
    if (!cot) {
      throw new Error("La cotización ya no existe.");
    }
    if (cot.estado !== "confirmada") {
      throw new Error("Solo se pueden aprobar cotizaciones confirmadas.");
    }

    const { data: ordenExistente } = await supabase
      .from("ordenes_produccion")
      .select("id")
      .eq("organization_id", DEFAULT_ORG_ID)
      .eq("cotizacion_id", cot.id)
      .maybeSingle();

    if (ordenExistente) {
      throw new Error("Esta cotización ya tiene una orden de producción.");
    }

    const correlativo = await nextCorrelativo("orden_produccion");
    const hoy = new Date().toISOString().slice(0, 10);

    const { data: orden, error: ordenErr } = await supabase
      .from("ordenes_produccion")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        cliente_id: cot.cliente_id,
        cotizacion_id: cot.id,
        cotizacion_unificada_id: null,
        estado: "en_produccion",
        notas: parsed.data.notas?.trim() || null,
        fecha_aprobacion: hoy,
        correlativo,
        created_by: actor.userId,
        updated_by: actor.userId,
      })
      .select("id")
      .single();

    if (ordenErr || !orden) {
      throw new Error(ordenErr?.message ?? "No se pudo crear la orden.");
    }

    const adelanto = parsed.data.adelanto ?? 0;
    if (adelanto > 0) {
      const medio = parsed.data.metodoAdelanto ?? "efectivo";
      const { error: cajaError } = await supabase.from("movimientos_caja").insert({
        organization_id: DEFAULT_ORG_ID,
        fecha: hoy,
        tipo: "ingreso",
        medio,
        categoria: "adelanto_mueble_personalizado",
        monto: adelanto,
        descripcion: `Adelanto al aprobar cotización ${cot.fecha} (${cot.id.slice(0, 8)})`,
        modulo_origen: "ventas",
        referencia_id: orden.id,
        created_by: actor.userId,
        updated_by: actor.userId,
      });
      if (cajaError) {
        throw new Error(cajaError.message);
      }
    }
  }
  revalidatePath("/ventas");
  revalidatePath("/ventas/muebles-personalizados");
  revalidatePath("/caja");
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

export async function createVentaMaderaCortada(formData: FormData) {
  const actor = await requireMutationAccess(ventasRoles);
  const parsed = ventaMaderaCortadaSchema.safeParse({
    clienteId: formData.get("cliente_id"),
    fecha: formData.get("fecha"),
    tipoCorte: formData.get("tipo_corte"),
    totalPt: formData.get("total_pt"),
    precioPorPt: formData.get("precio_por_pt"),
    total: formData.get("total"),
    metodoPago: formData.get("metodo_pago"),
    modalidadPago: formData.get("modalidad_pago"),
    fechaPagoCredito: formData.get("fecha_pago_credito"),
    choferId: formData.get("chofer_id"),
    tipoEntrega: formData.get("tipo_entrega"),
    direccionEntrega: formData.get("direccion_entrega"),
    estadoEntrega: formData.get("estado_entrega"),
    inventarioProductoId: formData.get("inventario_producto_id"),
  });
  if (!parsed.success) {
    throw new Error("Datos de venta de madera cortada inválidos.");
  }

  if (!hasSupabaseEnv()) {
    demoCreateVentaMaderaCortada({
      organization_id: DEFAULT_ORG_ID,
      cliente_id: parsed.data.clienteId,
      fecha: parsed.data.fecha,
      tipo_corte: parsed.data.tipoCorte,
      total_pt: parsed.data.totalPt,
      precio_por_pt: parsed.data.precioPorPt,
      total: parsed.data.total,
      metodo_pago: parsed.data.metodoPago,
      modalidad_pago: parsed.data.modalidadPago,
      fecha_pago_credito: parsed.data.fechaPagoCredito || null,
      chofer_id: parsed.data.choferId || null,
      tipo_entrega: parsed.data.tipoEntrega,
      direccion_entrega: parsed.data.direccionEntrega || null,
      estado_entrega: parsed.data.estadoEntrega,
      inventario_producto_id: parsed.data.inventarioProductoId || null,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const productoId =
      parsed.data.inventarioProductoId && parsed.data.inventarioProductoId.length > 0
        ? parsed.data.inventarioProductoId
        : null;

    if (productoId) {
      const { data: prod, error: prodErr } = await supabase
        .from("inventario_productos")
        .select("id, stock_actual")
        .eq("id", productoId)
        .eq("organization_id", DEFAULT_ORG_ID)
        .maybeSingle();
      if (prodErr) {
        throw new Error(prodErr.message);
      }
      if (!prod) {
        throw new Error("Producto de inventario no encontrado.");
      }
      if (Number(prod.stock_actual) < parsed.data.totalPt) {
        throw new Error("Stock insuficiente para la cantidad vendida.");
      }
    }

    const fechaCredito =
      parsed.data.modalidadPago === "credito" && parsed.data.fechaPagoCredito
        ? parsed.data.fechaPagoCredito
        : null;

    const { data: venta, error: ventaErr } = await supabase
      .from("ventas_madera_cortada")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        cliente_id: parsed.data.clienteId,
        fecha: parsed.data.fecha,
        estado: "confirmada",
        tipo_corte: parsed.data.tipoCorte,
        total_pt: parsed.data.totalPt,
        precio_por_pt: parsed.data.precioPorPt,
        total: parsed.data.total,
        metodo_pago: parsed.data.metodoPago,
        modalidad_pago: parsed.data.modalidadPago,
        fecha_pago_credito: fechaCredito,
        chofer_id: parsed.data.choferId || null,
        tipo_entrega: parsed.data.tipoEntrega,
        direccion_entrega: parsed.data.direccionEntrega?.trim() || null,
        estado_entrega: parsed.data.estadoEntrega,
        inventario_producto_id: productoId,
        created_by: actor.userId,
      })
      .select("id")
      .single();

    if (ventaErr || !venta) {
      throw new Error(ventaErr?.message ?? "No se pudo registrar la venta.");
    }

    const montoCaja = parsed.data.modalidadPago === "credito" ? 0 : parsed.data.total;
    let cajaRegistrado = false;
    if (montoCaja > 0) {
      const medioCaja = mapMetodoPagoVentaToMedioCaja(parsed.data.metodoPago);
      const { error: cajaError } = await supabase.from("movimientos_caja").insert({
        organization_id: DEFAULT_ORG_ID,
        fecha: parsed.data.fecha,
        tipo: "ingreso",
        medio: medioCaja,
        categoria: "venta_madera_cortada",
        monto: montoCaja,
        descripcion: `Venta ${parsed.data.totalPt.toFixed(2)} PT (${parsed.data.tipoCorte})`,
        modulo_origen: "ventas_madera_cortada",
        referencia_id: venta.id,
        created_by: actor.userId,
        updated_by: actor.userId,
      });
      if (cajaError) {
        await supabase.from("ventas_madera_cortada").delete().eq("id", venta.id);
        throw new Error(cajaError.message);
      }
      cajaRegistrado = true;
    }

    if (productoId) {
      const { error: movErr } = await supabase.from("inventario_movimientos").insert({
        organization_id: DEFAULT_ORG_ID,
        producto_id: productoId,
        fecha: parsed.data.fecha,
        tipo: "salida_venta",
        cantidad: parsed.data.totalPt,
        costo_unitario: parsed.data.precioPorPt,
        referencia: `venta_madera_cortada:${venta.id}`,
      });
      if (movErr) {
        if (cajaRegistrado) {
          await supabase
            .from("movimientos_caja")
            .delete()
            .eq("referencia_id", venta.id)
            .eq("organization_id", DEFAULT_ORG_ID)
            .eq("modulo_origen", "ventas_madera_cortada");
        }
        await supabase.from("ventas_madera_cortada").delete().eq("id", venta.id);
        throw new Error(movErr.message);
      }
    }
  }
  revalidatePath("/ventas");
  revalidatePath("/ventas/madera-cortada");
  revalidatePath("/caja");
}

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
  });
  if (!parsed.success) {
    throw new Error("Datos de contrato inválidos.");
  }
  if (!hasSupabaseEnv()) {
    const codigo = parsed.data.codigo || (await nextCorrelativo("contrato_alquiler"));
    demoCreateContratoAlquiler({
      organization_id: DEFAULT_ORG_ID,
      cliente_id: parsed.data.clienteId,
      activo: parsed.data.activo,
      fecha_inicio: parsed.data.fechaInicio,
      fecha_termino: parsed.data.fechaTermino || null,
      dias_alquiler: parsed.data.diasAlquiler ?? null,
      tarifa_unidad: parsed.data.tarifaUnidad,
      tarifa: parsed.data.tarifa,
      monto_total: parsed.data.montoTotal,
      codigo,
      representante: parsed.data.representante || null,
      ruc_empresa: parsed.data.rucEmpresa || null,
      direccion_ejecucion: parsed.data.direccionEjecucion || null,
      metodo_pago: parsed.data.metodoPago,
      modalidad_pago: parsed.data.modalidadPago,
      fecha_pago_credito: parsed.data.fechaPagoCredito || null,
    });
  } else {
    const supabase = getSupabaseServerClient();
    const codigo = parsed.data.codigo?.trim() || (await nextCorrelativo("contrato_alquiler"));
    const montoTotal = parsed.data.montoTotal;
    const deposito30 = Number((montoTotal * 0.3).toFixed(2));
    const fechaCredito =
      parsed.data.modalidadPago === "credito" && parsed.data.fechaPagoCredito
        ? parsed.data.fechaPagoCredito
        : null;

    const { data: contrato, error: insErr } = await supabase
      .from("alquileres")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        cliente_id: parsed.data.clienteId,
        activo: parsed.data.activo.trim(),
        fecha_inicio: parsed.data.fechaInicio,
        fecha_fin: null,
        fecha_termino: parsed.data.fechaTermino?.trim() || null,
        tarifa: parsed.data.tarifa,
        penalidad: 0,
        estado: "abierto",
        codigo,
        representante: parsed.data.representante?.trim() || null,
        ruc_empresa: parsed.data.rucEmpresa?.trim() || null,
        direccion_ejecucion: parsed.data.direccionEjecucion?.trim() || null,
        dias_alquiler: parsed.data.diasAlquiler ?? null,
        tarifa_unidad: parsed.data.tarifaUnidad,
        monto_total: montoTotal,
        deposito_30: deposito30,
        penalidad_retraso_pago_pct: PENALIDAD_ALQUILER_PCT_DEFAULT,
        penalidad_devolucion_tardia_pct: PENALIDAD_ALQUILER_PCT_DEFAULT,
        penalidad_danios_pct: PENALIDAD_ALQUILER_PCT_DEFAULT,
        metodo_pago: parsed.data.metodoPago,
        modalidad_pago: parsed.data.modalidadPago,
        fecha_pago_credito: fechaCredito,
      })
      .select("id")
      .single();

    if (insErr || !contrato) {
      throw new Error(insErr?.message ?? "No se pudo crear el contrato.");
    }

    if (deposito30 > 0) {
      const medioCaja = mapMetodoPagoVentaToMedioCaja(parsed.data.metodoPago);
      const { error: cajaErr } = await supabase.from("movimientos_caja").insert({
        organization_id: DEFAULT_ORG_ID,
        fecha: parsed.data.fechaInicio,
        tipo: "ingreso",
        medio: medioCaja,
        categoria: "alquiler_bomba_mixer",
        monto: deposito30,
        descripcion: `Depósito 30% contrato ${codigo}`,
        modulo_origen: "ventas_alquiler",
        referencia_id: contrato.id,
        created_by: actor.userId,
        updated_by: actor.userId,
      });
      if (cajaErr) {
        await supabase.from("alquileres").delete().eq("id", contrato.id);
        throw new Error(cajaErr.message);
      }
    }
  }
  revalidatePath("/ventas");
  revalidatePath("/ventas/alquiler-mixer");
  revalidatePath("/alquiler");
  revalidatePath("/caja");
}

export async function cerrarContratoAlquiler(formData: FormData) {
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
    throw new Error("Datos de cierre inválidos.");
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
      throw new Error(fetchErr.message);
    }
    if (!row) {
      throw new Error("Contrato no encontrado.");
    }
    if (row.estado === "cerrado") {
      throw new Error("El contrato ya está cerrado.");
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
    penalidadTotal = Number(penalidadTotal.toFixed(2));

    const penalidadAcum = Number(row.penalidad) + penalidadTotal;

    const { error: updErr } = await supabase
      .from("alquileres")
      .update({
        estado: "cerrado",
        fecha_fin: parsed.data.fechaCierre,
        observaciones_retorno:
          parsed.data.observaciones?.trim() || row.observaciones_retorno,
        penalidad: penalidadAcum,
      })
      .eq("id", row.id)
      .eq("organization_id", DEFAULT_ORG_ID);

    if (updErr) {
      throw new Error(updErr.message);
    }

    const refCodigo = row.codigo ?? row.id.slice(0, 8);

    if (penalidadTotal > 0) {
      const { error: penErr } = await supabase.from("movimientos_caja").insert({
        organization_id: DEFAULT_ORG_ID,
        fecha: parsed.data.fechaCierre,
        tipo: "ingreso",
        medio: "efectivo",
        categoria: "penalidad_alquiler",
        monto: penalidadTotal,
        descripcion: `Penalidad cierre contrato ${refCodigo}`,
        modulo_origen: "ventas_alquiler",
        referencia_id: row.id,
        created_by: actor.userId,
        updated_by: actor.userId,
      });
      if (penErr) {
        throw new Error(penErr.message);
      }
    }

    const deposito = row.deposito_30 != null ? Number(row.deposito_30) : 0;
    if (montoTotal != null && montoTotal > 0) {
      const saldo = Number((montoTotal - deposito).toFixed(2));
      if (saldo > 0) {
        const medioSaldo = mapMetodoPagoVentaToMedioCaja(row.metodo_pago ?? "efectivo");
        const { error: saldoErr } = await supabase.from("movimientos_caja").insert({
          organization_id: DEFAULT_ORG_ID,
          fecha: parsed.data.fechaCierre,
          tipo: "ingreso",
          medio: medioSaldo,
          categoria: "alquiler_bomba_mixer",
          monto: saldo,
          descripcion: `Saldo final contrato ${refCodigo}`,
          modulo_origen: "ventas_alquiler",
          referencia_id: row.id,
          created_by: actor.userId,
          updated_by: actor.userId,
        });
        if (saldoErr) {
          throw new Error(saldoErr.message);
        }
      }
    }
  }
  revalidatePath("/ventas/alquiler-mixer");
  revalidatePath("/alquiler");
  revalidatePath("/caja");
}

// ---------------------------------------------------------------------------
// Sub-flujo 5: Servicio aserradero
// ---------------------------------------------------------------------------

export async function createServicioAserradero(formData: FormData) {
  const actor = await requireMutationAccess(ventasRoles);
  const parsed = servicioAserraderoSchema.safeParse({
    clienteId: formData.get("cliente_id"),
    fecha: formData.get("fecha"),
    piesCubicos: formData.get("pies_cubicos"),
    costoCubicaje: formData.get("costo_cubicaje"),
    precioCobrado: formData.get("precio_cobrado"),
    lineas: formData.get("lineas_json"),
  });
  if (!parsed.success) {
    throw new Error("Datos de servicio inválidos.");
  }

  let lineasJson: Record<string, unknown>[] = [];
  if (parsed.data.lineas) {
    try {
      const parsedLineas = JSON.parse(parsed.data.lineas);
      if (Array.isArray(parsedLineas)) {
        lineasJson = parsedLineas;
      }
    } catch {
      // Ignoramos JSON inválido y dejamos arreglo vacío.
    }
  }

  const utilidad = Number(
    (parsed.data.precioCobrado - parsed.data.costoCubicaje).toFixed(2),
  );

  if (!hasSupabaseEnv()) {
    demoCreateServicioAserradero({
      organization_id: DEFAULT_ORG_ID,
      cliente_id: parsed.data.clienteId,
      fecha: parsed.data.fecha,
      pies_cubicos: parsed.data.piesCubicos,
      costo_cubicaje: parsed.data.costoCubicaje,
      precio_cobrado: parsed.data.precioCobrado,
      utilidad,
      lineas_json: lineasJson,
      correlativo: await nextCorrelativo("servicio_aserradero"),
    });
  } else {
    const supabase = getSupabaseServerClient();
    const correlativo = await nextCorrelativo("servicio_aserradero");
    const lineasPayload = lineasJson as unknown as Json;

    const { data: servicio, error: servicioErr } = await supabase
      .from("servicios_aserradero")
      .insert({
        organization_id: DEFAULT_ORG_ID,
        cliente_id: parsed.data.clienteId,
        fecha: parsed.data.fecha,
        pies_cubicos: parsed.data.piesCubicos,
        costo_cubicaje: parsed.data.costoCubicaje,
        precio_cobrado: parsed.data.precioCobrado,
        utilidad,
        lineas_json: lineasPayload,
        correlativo,
        created_by: actor.userId,
      })
      .select("id")
      .single();

    if (servicioErr || !servicio) {
      throw new Error(servicioErr?.message ?? "No se pudo registrar el servicio.");
    }

    if (parsed.data.precioCobrado > 0) {
      const { error: cajaError } = await supabase.from("movimientos_caja").insert({
        organization_id: DEFAULT_ORG_ID,
        fecha: parsed.data.fecha,
        tipo: "ingreso",
        medio: "efectivo",
        categoria: "servicio_aserradero",
        monto: parsed.data.precioCobrado,
        descripcion: `Servicio aserradero (${parsed.data.piesCubicos.toFixed(2)} pies cúbicos)`,
        modulo_origen: "ventas_aserradero",
        referencia_id: servicio.id,
        created_by: actor.userId,
        updated_by: actor.userId,
      });
      if (cajaError) {
        await supabase.from("servicios_aserradero").delete().eq("id", servicio.id);
        throw new Error(cajaError.message);
      }
    }
  }
  revalidatePath("/ventas");
  revalidatePath("/ventas/aserradero-servicios");
  revalidatePath("/caja");
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
  if (!id || !["activo", "inactivo", "moroso"].includes(estado)) {
    throw new Error("Datos inválidos.");
  }
  if (!hasSupabaseEnv()) {
    demoUpdateClienteEstado(id, estado as "activo" | "inactivo" | "moroso");
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("clientes")
      .update({ estado })
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID);
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
export async function forzarEliminarClienteCompleto(formData: FormData) {
  await requireMutationAccess(["owner_admin"]);
  const id = String(formData.get("id") ?? "").trim();
  const confirmacion = String(formData.get("confirmacion") ?? "").trim();
  const clienteIdParam = id ? `?cliente=${encodeURIComponent(id)}` : "";
  const baseRedirect = `/gerencial${clienteIdParam}`;

  const fail = (msg: string) => redirect(`${baseRedirect}&mensaje=${encodeURIComponent(msg)}`);

  if (!id) fail("Identificador inválido.");
  if (confirmacion !== "ELIMINAR TODO") fail('Escribe "ELIMINAR TODO" en el campo de confirmación.');

  if (!hasSupabaseEnv()) {
    fail("Esta acción solo está disponible con base de datos activa.");
    return;
  }

  const supabase = getSupabaseServerClient();

  // Eliminar en orden para evitar violaciones de FK
  const tablas = [
    "ordenes_produccion",
    "cotizaciones_unificadas",
    "cotizaciones_mueble",
    "ventas_mueble_terminado",
    "ventas_madera",
    "servicios_aserradero",
    "alquileres",
  ] as const;

  for (const tabla of tablas) {
    const { error } = await supabase
      .from(tabla)
      .delete()
      .eq("cliente_id", id)
      .eq("organization_id", DEFAULT_ORG_ID);
    if (error) {
      fail(`Error al limpiar ${tabla}: ${error.message}`);
      return;
    }
  }

  // Ahora eliminar el cliente
  const { error: delError } = await supabase
    .from("clientes")
    .delete()
    .eq("id", id)
    .eq("organization_id", DEFAULT_ORG_ID);

  if (delError) {
    fail(delError.message || "No se pudo eliminar el cliente.");
    return;
  }

  revalidatePath("/ventas/clientes");
  revalidatePath("/gerencial");
  redirect("/gerencial?mensaje=" + encodeURIComponent("Cliente y todos sus registros eliminados correctamente."));
}
