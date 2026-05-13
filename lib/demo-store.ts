import { createHash, randomUUID } from "node:crypto";
import { readStoreFromDisk, writeStoreToDisk } from "@/lib/store-persistence";

export type MetodoPago =
  | "efectivo"
  | "yape"
  | "transferencia"
  | "billetera_digital"
  | "otro";

export type ModalidadPago = "contado" | "adelanto" | "credito";

export type TipoEntrega = "puesto_en_obra" | "entrega_local" | "envio";

export type EstadoEntrega = "pendiente" | "en_proceso" | "entregado";

type CajaRow = {
  id: string;
  organization_id: string;
  fecha: string;
  tipo: "ingreso" | "egreso" | "transferencia";
  medio: "efectivo" | "banco" | "yape" | "otro";
  categoria: string;
  monto: number;
  descripcion: string | null;
  modulo_origen: string | null;
  referencia_id: string | null;
  periodo_cerrado: boolean;
  /**
   * true cuando el movimiento es de uso personal de la dueña (no afecta utilidad
   * empresarial). Permite separar Personal / Empresa / Todos en /caja y reportes.
   */
  es_personal: boolean;
  /** URL local opcional al comprobante adjunto (data/uploads/...). */
  url_comprobante: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
};

type ClienteRow = {
  id: string;
  organization_id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  ruc: string | null;
  direccion: string | null;
  tipo_persona: "natural" | "empresa" | null;
  created_at: string;
};

type ProveedorRow = {
  id: string;
  organization_id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  created_at: string;
};

type RegistroCategoriaRow = {
  id: string;
  organization_id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
};

type RegistroGeneralRow = {
  id: string;
  organization_id: string;
  categoria_id: string;
  fecha: string;
  titulo: string;
  detalle: string | null;
  monto: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
};

type VentaRow = {
  id: string;
  organization_id: string;
  cliente_id: string;
  fecha: string;
  estado: "borrador" | "confirmada";
  total: number;
  correlativo: string | null;
  created_at: string;
  created_by: string | null;
};

type CompraMaderaRow = {
  id: string;
  organization_id: string;
  proveedor_id: string;
  fecha: string;
  especie_madera: string;
  detalle: string | null;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  total: number;
  modalidad_pago: "contado" | "fiado";
  adelanto: number;
  saldo_pendiente: number;
  estado: "borrador" | "confirmada";
  /** URL local opcional al comprobante adjunto (data/uploads/...). */
  url_comprobante: string | null;
  created_at: string;
  created_by: string | null;
};

type CotizacionRow = {
  id: string;
  organization_id: string;
  cliente_id: string;
  fecha: string;
  tipo: "mueble_personalizado" | "servicio_corte";
  especie_madera: string;
  unidad_medida: "cm" | "in" | "otro";
  origen_material: "cliente" | "empresa";
  precio_calculado: number;
  precio_acordado: number;
  motivo_ajuste: string | null;
  estado: "borrador" | "confirmada";
  created_at: string;
  /** Correlativo formateado tipo "N°0025" generado al crear. */
  correlativo: string | null;
};

/** Cotización multi-rubro (pestaña Cotización). */
export type CotizacionUnificadaRow = {
  id: string;
  organization_id: string;
  cliente_id: string;
  fecha: string;
  correlativo: string | null;
  tipo_cliente: "natural" | "empresa";
  total: number;
  estado_flujo: "pendiente" | "lista_produccion" | "en_produccion" | "cobrada";
  detalle: Record<string, unknown>;
  created_at: string;
};

type CorteRow = {
  id: string;
  cotizacion_id: string;
  tipo_pieza: "tabla" | "liston";
  espesor: number;
  ancho: number;
  largo: number;
  cantidad: number;
  valor_calculado: number;
  created_at: string;
};

type AlquilerContratoRow = {
  id: string;
  organization_id: string;
  cliente_id: string;
  activo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  tarifa: number;
  penalidad: number;
  estado: "abierto" | "cerrado";
  created_at: string;
  codigo: string | null;
  representante: string | null;
  ruc_empresa: string | null;
  direccion_ejecucion: string | null;
  fecha_termino: string | null;
  dias_alquiler: number | null;
  tarifa_unidad: "hora_maquina" | "m3" | "dia" | null;
  monto_total: number | null;
  deposito_30: number | null;
  penalidad_retraso_pago_pct: number;
  penalidad_devolucion_tardia_pct: number;
  penalidad_danios_pct: number;
  observaciones_retorno: string | null;
  metodo_pago: MetodoPago | null;
  modalidad_pago: ModalidadPago | null;
  fecha_pago_credito: string | null;
};

/** Alias histórico (Supabase + UI); contrato extendido para mixer/BOMBA. */
export type AlquilerRow = AlquilerContratoRow;

type ChoferRow = {
  id: string;
  organization_id: string;
  nombre: string;
  telefono: string | null;
  placa: string | null;
  activo: boolean;
  created_at: string;
};

type MuebleCatalogoRow = {
  id: string;
  organization_id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precio_lista: number;
  foto_url: string | null;
  stock_disponible: number;
  activo: boolean;
  created_at: string;
};

type VentaMuebleTerminadoRow = {
  id: string;
  organization_id: string;
  cliente_id: string;
  mueble_catalogo_id: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  chofer_id: string | null;
  tipo_entrega: TipoEntrega;
  direccion_entrega: string | null;
  estado_entrega: EstadoEntrega;
  metodo_pago: MetodoPago;
  modalidad_pago: ModalidadPago;
  fecha_pago_credito: string | null;
  correlativo: string | null;
  fecha: string;
  created_at: string;
};

type OrdenProduccionRow = {
  id: string;
  organization_id: string;
  cliente_id: string;
  cotizacion_id: string | null;
  /** Cuando la orden nace desde la cotización unificada (no desde `cotizaciones_mueble`). */
  cotizacion_unificada_id: string | null;
  estado: "en_produccion" | "terminado" | "entregado";
  notas: string | null;
  fecha_aprobacion: string | null;
  created_at: string;
  correlativo: string | null;
};

type ServicioAserraderoRow = {
  id: string;
  organization_id: string;
  cliente_id: string;
  fecha: string;
  pies_cubicos: number;
  costo_cubicaje: number;
  precio_cobrado: number;
  utilidad: number;
  lineas_json: Record<string, unknown>[];
  created_at: string;
  correlativo: string | null;
};

export type ServicioEspecialTarifaRow = {
  id: string;
  organization_id: string;
  codigo: string;
  nombre: string;
  tarifa_por_pieza: number;
  activo: boolean;
  created_at: string;
};

export type ZonaEntregaRow = {
  id: string;
  organization_id: string;
  nombre: string;
  distancia_km: number;
  tarifa: number;
  activo: boolean;
  created_at: string;
};

type EmpleadoRow = {
  id: string;
  organization_id: string;
  nombre: string;
  rol: string;
  activo: boolean;
  fecha_ingreso: string;
  created_at: string;
};

type AdelantoRow = {
  id: string;
  organization_id: string;
  empleado_id: string;
  fecha: string;
  monto: number;
  estado: "pendiente" | "descontado_nomina";
  created_at: string;
};

type SueldoRow = {
  id: string;
  organization_id: string;
  empleado_id: string;
  periodo: string;
  monto_bruto: number;
  descuentos: number;
  monto_neto: number;
  created_at: string;
};

type InventarioProductoRow = {
  id: string;
  organization_id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad: string;
  stock_actual: number;
  stock_minimo: number;
  activo: boolean;
  created_at: string;
};

type InventarioMovimientoRow = {
  id: string;
  organization_id: string;
  producto_id: string;
  fecha: string;
  tipo: "entrada_compra" | "salida_venta" | "ajuste";
  cantidad: number;
  costo_unitario: number | null;
  referencia: string | null;
  created_at: string;
};

type AlertaRow = {
  id: string;
  organization_id: string;
  tipo: "stock_bajo" | "deuda_vencida" | "penalidad_limite" | "anomalia_caja";
  prioridad: "alta" | "media" | "baja";
  estado: "nueva" | "revisada" | "resuelta";
  descripcion: string;
  created_at: string;
};

type UtilidadRow = {
  organization_id: string;
  anio: number;
  mes: number;
  ingresos: number;
  egresos: number;
  sueldos: number;
  utilidad_neta: number;
};

type CierreRow = {
  id: string;
  organization_id: string;
  anio: number;
  mes: number;
  hash_sha256: string;
  reporte_json: Record<string, unknown>;
  closed_at: string;
  closed_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  reopen_reason: string | null;
};

export type SecurityControlItem = {
  id: string;
  title: string;
  completed: boolean;
  owner: string;
  updated_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

const orgId = "00000000-0000-0000-0000-000000000001";
const clienteCarlos = "11111111-1111-4111-8111-111111111111";
const clienteCorte = "22222222-2222-4222-8222-222222222222";
const clienteObra = "44444444-4444-4444-8444-444444444444";
const clienteMixer = "55555555-5555-4555-8555-555555555555";
const clienteLenin = "11111111-1111-4111-8111-000000000025";
const empleado1 = "33333333-3333-4333-8333-333333333333";
const empleado2 = "66666666-6666-4666-8666-666666666666";
const empleado3 = "77777777-7777-4777-8777-777777777777";
const cotizacion1 = "88888888-8888-4888-8888-888888888881";
const cotizacion2 = "88888888-8888-4888-8888-888888888882";
const cotizacionLenin = "88888888-8888-4888-8888-000000000025";
const producto1 = "99999999-1111-4111-8111-111111111111";
const producto2 = "99999999-2222-4222-8222-222222222222";
const producto3 = "99999999-3333-4333-8333-333333333333";
const producto4 = "99999999-4444-4444-8444-444444444444";
const proveedorKatungo = "aaaaaaa1-1111-4111-8111-111111111111";
const proveedorHuillca = "aaaaaaa2-2222-4222-8222-222222222222";
const proveedorBosco = "aaaaaaa3-3333-4333-8333-200522389000";
const choferAndres = "cccccccc-1111-4111-8111-111111111111";
const choferMario = "cccccccc-2222-4222-8222-222222222222";
const muebleRoperoEstandar = "dddddddd-1111-4111-8111-111111111111";
const muebleMesaTV = "dddddddd-2222-4222-8222-222222222222";
const muebleVeladorPino = "dddddddd-3333-4333-8333-333333333333";
const registroCategoriaMadera = "bbbbbbb1-1111-4111-8111-111111111111";
const registroCategoriaMueble = "bbbbbbb2-2222-4222-8222-222222222222";
const registroCategoriaCaja = "bbbbbbb3-3333-4333-8333-333333333333";

type DemoStore = {
  caja: CajaRow[];
  clientes: ClienteRow[];
  proveedores: ProveedorRow[];
  registroCategorias: RegistroCategoriaRow[];
  registrosGenerales: RegistroGeneralRow[];
  ventas: VentaRow[];
  comprasMadera: CompraMaderaRow[];
  cotizaciones: CotizacionRow[];
  cotizacionesUnificadas: CotizacionUnificadaRow[];
  cortes: CorteRow[];
  alquileres: AlquilerContratoRow[];
  empleados: EmpleadoRow[];
  adelantos: AdelantoRow[];
  sueldos: SueldoRow[];
  inventarioProductos: InventarioProductoRow[];
  inventarioMovimientos: InventarioMovimientoRow[];
  alertas: AlertaRow[];
  cierres: CierreRow[];
  securityControls: SecurityControlItem[];
  choferes: ChoferRow[];
  mueblesCatalogo: MuebleCatalogoRow[];
  ventasMuebleTerminado: VentaMuebleTerminadoRow[];
  ordenesProduccion: OrdenProduccionRow[];
  serviciosAserradero: ServicioAserraderoRow[];
  serviciosEspecialesTarifa: ServicioEspecialTarifaRow[];
  zonasEntrega: ZonaEntregaRow[];
  /** Contador autoincrementable por tipo y año (cotización, contrato, orden, etc.). */
  correlativosCounter: Record<string, number>;
};

/** Asigna y persiste el siguiente correlativo del store. */
export function nextCorrelativoFromStore(key: string): number {
  const current = store.correlativosCounter[key] ?? 0;
  const next = current + 1;
  store.correlativosCounter[key] = next;
  persistStore();
  return next;
}

function createDefaultDemoStore(): DemoStore {
  return {
  caja: [
    ...seedCajaIniciales(),
    ...seedGastosExcel(),
  ],
  clientes: [
    {
      id: clienteCarlos,
      organization_id: orgId,
      nombre: "Ropero Carlos",
      documento: null,
      telefono: "930781012",
      ruc: null,
      direccion: null,
      tipo_persona: "natural",
      created_at: nowIso(),
    },
    {
      id: clienteCorte,
      organization_id: orgId,
      nombre: "Cliente Corte Duro",
      documento: null,
      telefono: null,
      ruc: null,
      direccion: null,
      tipo_persona: null,
      created_at: nowIso(),
    },
    {
      id: clienteObra,
      organization_id: orgId,
      nombre: "Inversiones Obra Sur",
      documento: "20609988771",
      telefono: "945112233",
      ruc: "20609988771",
      direccion: null,
      tipo_persona: "empresa",
      created_at: nowIso(),
    },
    {
      id: clienteMixer,
      organization_id: orgId,
      nombre: "Consorcio Mixer Norte",
      documento: "20444555666",
      telefono: "955889900",
      ruc: "20444555666",
      direccion: null,
      tipo_persona: "empresa",
      created_at: nowIso(),
    },
    {
      id: clienteLenin,
      organization_id: orgId,
      nombre: "Lenin (cotización N°0025)",
      documento: null,
      telefono: "987654321",
      ruc: null,
      direccion: "Omaya",
      tipo_persona: "natural",
      created_at: nowIso(),
    },
  ],
  proveedores: [
    {
      id: proveedorKatungo,
      organization_id: orgId,
      nombre: "Katungo Jordi Romero",
      documento: "74120123",
      telefono: "978591269",
      created_at: nowIso(),
    },
    {
      id: proveedorHuillca,
      organization_id: orgId,
      nombre: "Huillca Henry Verástegui",
      documento: "10456789432",
      telefono: "976112545",
      created_at: nowIso(),
    },
    {
      id: proveedorBosco,
      organization_id: orgId,
      nombre: "Consorcio San Juan Bosco",
      documento: "20600522389",
      telefono: null,
      created_at: nowIso(),
    },
  ],
  registroCategorias: [
    {
      id: registroCategoriaMadera,
      organization_id: orgId,
      codigo: "madera",
      nombre: "Madera",
      descripcion: "Troncos, tablones, medidas y compras.",
      activo: true,
      created_at: nowIso(),
    },
    {
      id: registroCategoriaMueble,
      organization_id: orgId,
      codigo: "mueble",
      nombre: "Mueble",
      descripcion: "Pedidos, adelantos, tiempos y costos.",
      activo: true,
      created_at: nowIso(),
    },
    {
      id: registroCategoriaCaja,
      organization_id: orgId,
      codigo: "caja",
      nombre: "Caja",
      descripcion: "Ingresos, egresos y pagos operativos.",
      activo: true,
      created_at: nowIso(),
    },
  ],
  registrosGenerales: [
    {
      id: randomUUID(),
      organization_id: orgId,
      categoria_id: registroCategoriaMadera,
      fecha: "2026-05-01",
      titulo: "Compra de trozas sin procesar",
      detalle: "3 trozas de cedro para corte de tablero.",
      monto: 1350,
      metadata: { proveedor: "Forestal Norte", lote: "L-2026-05-01" },
      created_at: nowIso(),
      created_by: null,
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      categoria_id: registroCategoriaMueble,
      fecha: "2026-05-01",
      titulo: "Adelanto por mueble personalizado",
      detalle: "Cliente deja adelanto para mueble cocina.",
      monto: 500,
      metadata: { cliente: "Ropero Carlos", etapa: "adelanto" },
      created_at: nowIso(),
      created_by: null,
    },
  ],
  ventas: [
    {
      id: randomUUID(),
      organization_id: orgId,
      cliente_id: clienteCarlos,
      fecha: "2026-04-30",
      estado: "confirmada" as const,
      total: 900,
      correlativo: "MA-2026-0001",
      created_at: nowIso(),
      created_by: null,
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      cliente_id: clienteObra,
      fecha: "2026-04-29",
      estado: "confirmada",
      total: 1200,
      correlativo: "MA-2026-0002",
      created_at: nowIso(),
      created_by: null,
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      cliente_id: clienteCorte,
      fecha: "2026-04-26",
      estado: "borrador",
      total: 540,
      correlativo: null,
      created_at: nowIso(),
      created_by: null,
    },
  ],
  comprasMadera: [
    {
      id: randomUUID(),
      organization_id: orgId,
      proveedor_id: proveedorKatungo,
      fecha: "2026-04-25",
      especie_madera: "Listón / Tablas mixtas",
      detalle: "3ra entrega de listones y tablas",
      cantidad: 1,
      unidad: "lote",
      precio_unitario: 9000,
      total: 9000,
      modalidad_pago: "fiado",
      adelanto: 3600,
      saldo_pendiente: 5400,
      estado: "confirmada",
      url_comprobante: null,
      created_at: nowIso(),
      created_by: null,
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      proveedor_id: proveedorHuillca,
      fecha: "2026-04-23",
      especie_madera: "Tornillo",
      detalle: "Corte por medida - lote 901 pie",
      cantidad: 901,
      unidad: "pie",
      precio_unitario: 1.7,
      total: 1531.7,
      modalidad_pago: "contado",
      adelanto: 1531.7,
      saldo_pendiente: 0,
      estado: "confirmada",
      url_comprobante: null,
      created_at: nowIso(),
      created_by: null,
    },
  ],
  cotizaciones: [
    {
      id: cotizacion1,
      organization_id: orgId,
      cliente_id: clienteCorte,
      fecha: "2026-04-30",
      tipo: "servicio_corte" as const,
      especie_madera: "Cedro",
      unidad_medida: "cm" as const,
      origen_material: "cliente" as const,
      precio_calculado: 380,
      precio_acordado: 360,
      motivo_ajuste: "Precio acordado con cliente",
      estado: "confirmada" as const,
      created_at: nowIso(),
      correlativo: "N°0023",
    },
    {
      id: cotizacion2,
      organization_id: orgId,
      cliente_id: clienteCarlos,
      fecha: "2026-04-25",
      tipo: "mueble_personalizado",
      especie_madera: "Tornillo",
      unidad_medida: "cm",
      origen_material: "cliente",
      precio_calculado: 980,
      precio_acordado: 900,
      motivo_ajuste: "Cliente dejó madera, solo mano de obra",
      estado: "confirmada",
      created_at: nowIso(),
      correlativo: "N°0024",
    },
    // Cotización N°0025 — Lenin: 3 puertas contraplacadas con vidrio · S/ 11,700.
    {
      id: cotizacionLenin,
      organization_id: orgId,
      cliente_id: clienteLenin,
      fecha: "2026-04-15",
      tipo: "mueble_personalizado",
      especie_madera: "Tornillo",
      unidad_medida: "cm",
      origen_material: "empresa",
      precio_calculado: 11700,
      precio_acordado: 11700,
      motivo_ajuste: "Cotización N°0025 — 3 puertas contraplacadas con vidrio, instalación incluida hasta Omaya",
      estado: "confirmada",
      created_at: nowIso(),
      correlativo: "N°0025",
    },
  ],
  cotizacionesUnificadas: [] as CotizacionUnificadaRow[],
  cortes: [
    {
      id: randomUUID(),
      cotizacion_id: cotizacion1,
      tipo_pieza: "tabla",
      espesor: 2,
      ancho: 10,
      largo: 240,
      cantidad: 4,
      valor_calculado: 192,
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      cotizacion_id: cotizacion1,
      tipo_pieza: "liston",
      espesor: 2,
      ancho: 5,
      largo: 240,
      cantidad: 6,
      valor_calculado: 144,
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      cotizacion_id: cotizacion2,
      tipo_pieza: "tabla",
      espesor: 3,
      ancho: 12,
      largo: 220,
      cantidad: 3,
      valor_calculado: 237.6,
      created_at: nowIso(),
    },
    // Despiece de la cotización Lenin: 3 puertas (datos resumidos).
    {
      id: randomUUID(),
      cotizacion_id: cotizacionLenin,
      tipo_pieza: "tabla",
      espesor: 2,
      ancho: 6,
      largo: 8,
      cantidad: 6,
      valor_calculado: 3900,
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      cotizacion_id: cotizacionLenin,
      tipo_pieza: "liston",
      espesor: 2,
      ancho: 4,
      largo: 8,
      cantidad: 12,
      valor_calculado: 3900,
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      cotizacion_id: cotizacionLenin,
      tipo_pieza: "tabla",
      espesor: 1,
      ancho: 12,
      largo: 8,
      cantidad: 3,
      valor_calculado: 3900,
      created_at: nowIso(),
    },
  ],
  alquileres: [
    {
      id: randomUUID(),
      organization_id: orgId,
      cliente_id: clienteMixer,
      activo: "Bomba Mixer",
      fecha_inicio: "2026-04-28",
      fecha_fin: null,
      tarifa: 650,
      penalidad: 120,
      estado: "abierto",
      created_at: nowIso(),
      codigo: null,
      representante: null,
      ruc_empresa: null,
      direccion_ejecucion: null,
      fecha_termino: null,
      dias_alquiler: null,
      tarifa_unidad: null,
      monto_total: null,
      deposito_30: null,
      penalidad_retraso_pago_pct: 3,
      penalidad_devolucion_tardia_pct: 3,
      penalidad_danios_pct: 3,
      observaciones_retorno: null,
      metodo_pago: null,
      modalidad_pago: null,
      fecha_pago_credito: null,
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      cliente_id: clienteObra,
      activo: "Camión tolva",
      fecha_inicio: "2026-04-20",
      fecha_fin: "2026-04-24",
      tarifa: 500,
      penalidad: 0,
      estado: "cerrado",
      created_at: nowIso(),
      codigo: null,
      representante: null,
      ruc_empresa: null,
      direccion_ejecucion: null,
      fecha_termino: "2026-04-24",
      dias_alquiler: 4,
      tarifa_unidad: "dia",
      monto_total: null,
      deposito_30: null,
      penalidad_retraso_pago_pct: 3,
      penalidad_devolucion_tardia_pct: 3,
      penalidad_danios_pct: 3,
      observaciones_retorno: null,
      metodo_pago: null,
      modalidad_pago: null,
      fecha_pago_credito: null,
    },
  ],
  empleados: [
    {
      id: empleado1,
      organization_id: orgId,
      nombre: "Operario Demo",
      rol: "Operario",
      activo: true,
      fecha_ingreso: "2026-04-01",
      created_at: nowIso(),
    },
    {
      id: empleado2,
      organization_id: orgId,
      nombre: "Chofer Demo",
      rol: "Chofer",
      activo: true,
      fecha_ingreso: "2026-03-15",
      created_at: nowIso(),
    },
    {
      id: empleado3,
      organization_id: orgId,
      nombre: "Operario Corte",
      rol: "Operario",
      activo: true,
      fecha_ingreso: "2026-02-10",
      created_at: nowIso(),
    },
  ],
  adelantos: [
    {
      id: randomUUID(),
      organization_id: orgId,
      empleado_id: empleado2,
      fecha: "2026-04-27",
      monto: 200,
      estado: "pendiente",
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      empleado_id: empleado1,
      fecha: "2026-03-20",
      monto: 150,
      estado: "descontado_nomina",
      created_at: nowIso(),
    },
  ],
  sueldos: [
    {
      id: randomUUID(),
      organization_id: orgId,
      empleado_id: empleado1,
      periodo: "2026-04",
      monto_bruto: 1600,
      descuentos: 100,
      monto_neto: 1500,
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      empleado_id: empleado2,
      periodo: "2026-04",
      monto_bruto: 1800,
      descuentos: 200,
      monto_neto: 1600,
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      empleado_id: empleado3,
      periodo: "2026-03",
      monto_bruto: 1500,
      descuentos: 80,
      monto_neto: 1420,
      created_at: nowIso(),
    },
  ],
  inventarioProductos: [
    {
      id: producto1,
      organization_id: orgId,
      codigo: "MAD-TOR-01",
      nombre: "Tabla Tornillo 2x10x240",
      categoria: "Madera",
      unidad: "unidad",
      stock_actual: 42,
      stock_minimo: 18,
      activo: true,
      created_at: nowIso(),
    },
    {
      id: producto2,
      organization_id: orgId,
      codigo: "LIS-CED-02",
      nombre: "Listón Cedro 2x5x240",
      categoria: "Madera",
      unidad: "unidad",
      stock_actual: 10,
      stock_minimo: 15,
      activo: true,
      created_at: nowIso(),
    },
    {
      id: producto3,
      organization_id: orgId,
      codigo: "INS-TOR-03",
      nombre: "Tornillo 1 1/2",
      categoria: "Insumo",
      unidad: "caja",
      stock_actual: 8,
      stock_minimo: 6,
      activo: true,
      created_at: nowIso(),
    },
    {
      id: producto4,
      organization_id: orgId,
      codigo: "INS-BAR-04",
      nombre: "Barniz Marino 1L",
      categoria: "Insumo",
      unidad: "lata",
      stock_actual: 3,
      stock_minimo: 5,
      activo: true,
      created_at: nowIso(),
    },
  ],
  inventarioMovimientos: [
    {
      id: randomUUID(),
      organization_id: orgId,
      producto_id: producto1,
      fecha: "2026-04-30",
      tipo: "salida_venta",
      cantidad: 8,
      costo_unitario: null,
      referencia: "Venta ropero Carlos",
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      producto_id: producto1,
      fecha: "2026-04-28",
      tipo: "entrada_compra",
      cantidad: 20,
      costo_unitario: 38,
      referencia: "Compra semanal",
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      producto_id: producto2,
      fecha: "2026-04-30",
      tipo: "salida_venta",
      cantidad: 14,
      costo_unitario: null,
      referencia: "Servicio corte duro",
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      producto_id: producto3,
      fecha: "2026-04-29",
      tipo: "salida_venta",
      cantidad: 5,
      costo_unitario: null,
      referencia: "Uso en armado",
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      producto_id: producto4,
      fecha: "2026-04-27",
      tipo: "salida_venta",
      cantidad: 3,
      costo_unitario: null,
      referencia: "Acabado mueble",
      created_at: nowIso(),
    },
  ],
  alertas: [
    {
      id: randomUUID(),
      organization_id: orgId,
      tipo: "stock_bajo" as const,
      prioridad: "media" as const,
      estado: "nueva" as const,
      descripcion: "Stock de tornillo por debajo del umbral",
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      tipo: "penalidad_limite" as const,
      prioridad: "alta" as const,
      estado: "nueva" as const,
      descripcion: "Contrato con penalidad acumulada alta",
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      tipo: "deuda_vencida",
      prioridad: "alta",
      estado: "revisada",
      descripcion: "Cliente con pago pendiente de 10 días",
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      tipo: "anomalia_caja",
      prioridad: "media",
      estado: "nueva",
      descripcion: "Egreso alto fuera de rango semanal",
      created_at: nowIso(),
    },
  ],
  cierres: [] as CierreRow[],
  securityControls: [
    {
      id: "sec-1",
      title: "RLS habilitado en tablas críticas",
      completed: true,
      owner: "Equipo técnico",
      updated_at: nowIso(),
    },
    {
      id: "sec-2",
      title: "MFA activo para owner_admin y gerencia",
      completed: false,
      owner: "Katia",
      updated_at: nowIso(),
    },
    {
      id: "sec-3",
      title: "Anulación lógica con motivo obligatoria",
      completed: true,
      owner: "Equipo técnico",
      updated_at: nowIso(),
    },
    {
      id: "sec-4",
      title: "Backups y restore drill trimestral verificado",
      completed: false,
      owner: "Equipo técnico",
      updated_at: nowIso(),
    },
  ],
  choferes: [
    {
      id: choferAndres,
      organization_id: orgId,
      nombre: "Andrés Quispe",
      telefono: "987112233",
      placa: "ABC-123",
      activo: true,
      created_at: nowIso(),
    },
    {
      id: choferMario,
      organization_id: orgId,
      nombre: "Mario Huamán",
      telefono: "987445566",
      placa: "DEF-456",
      activo: true,
      created_at: nowIso(),
    },
  ] as ChoferRow[],
  mueblesCatalogo: [
    {
      id: muebleRoperoEstandar,
      organization_id: orgId,
      codigo: "MT-001",
      nombre: "Ropero estándar 2 puertas",
      descripcion: "1.20 × 1.80 m, color natural, barniz tipo cera.",
      precio_lista: 1200,
      foto_url: null,
      stock_disponible: 3,
      activo: true,
      created_at: nowIso(),
    },
    {
      id: muebleMesaTV,
      organization_id: orgId,
      codigo: "MT-002",
      nombre: "Mesa para TV 50 pulgadas",
      descripcion: "Tornillo, 1.50 × 0.50 × 0.55 m, 2 cajones.",
      precio_lista: 650,
      foto_url: null,
      stock_disponible: 2,
      activo: true,
      created_at: nowIso(),
    },
    {
      id: muebleVeladorPino,
      organization_id: orgId,
      codigo: "MT-003",
      nombre: "Velador de pino con cajón",
      descripcion: "0.45 × 0.40 × 0.55 m, acabado natural.",
      precio_lista: 280,
      foto_url: null,
      stock_disponible: 5,
      activo: true,
      created_at: nowIso(),
    },
  ] as MuebleCatalogoRow[],
  ventasMuebleTerminado: [] as VentaMuebleTerminadoRow[],
  ordenesProduccion: [
    {
      id: randomUUID(),
      organization_id: orgId,
      cliente_id: clienteLenin,
      cotizacion_id: cotizacionLenin,
      cotizacion_unificada_id: null,
      estado: "en_produccion",
      notas: "3 puertas contraplacadas con vidrio para entregar en Omaya. Cliente acepta plazo 21 días.",
      fecha_aprobacion: "2026-04-16",
      created_at: nowIso(),
      correlativo: "OP-2026-0001",
    },
  ] as OrdenProduccionRow[],
  serviciosAserradero: [] as ServicioAserraderoRow[],
  serviciosEspecialesTarifa: [
    {
      id: randomUUID(),
      organization_id: orgId,
      codigo: "SE-CEP",
      nombre: "Cepillado",
      tarifa_por_pieza: 2,
      activo: true,
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      codigo: "SE-TRA",
      nombre: "Traslapado",
      tarifa_por_pieza: 2.5,
      activo: true,
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      codigo: "SE-MAC",
      nombre: "Machembrado",
      tarifa_por_pieza: 3,
      activo: true,
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      codigo: "SE-CV",
      nombre: "Corte vertical",
      tarifa_por_pieza: 1.5,
      activo: true,
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      codigo: "SE-CH",
      nombre: "Corte horizontal",
      tarifa_por_pieza: 1.5,
      activo: true,
      created_at: nowIso(),
    },
  ] as ServicioEspecialTarifaRow[],
  zonasEntrega: [
    {
      id: randomUUID(),
      organization_id: orgId,
      nombre: "Local taller",
      distancia_km: 0,
      tarifa: 0,
      activo: true,
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      nombre: "Lima centro",
      distancia_km: 8,
      tarifa: 40,
      activo: true,
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      nombre: "Cono norte",
      distancia_km: 18,
      tarifa: 80,
      activo: true,
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      nombre: "Cono sur",
      distancia_km: 22,
      tarifa: 100,
      activo: true,
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      organization_id: orgId,
      nombre: "Provincia / fuera de Lima",
      distancia_km: 60,
      tarifa: 200,
      activo: true,
      created_at: nowIso(),
    },
  ] as ZonaEntregaRow[],
  // Contadores iniciales: la cotización N°0025 (Lenin) ya está consumida y la
  // primera orden de producción del año 2026 también.
  correlativosCounter: { "cotizacion": 25, "orden_produccion_2026": 1 },
  };
}

/** Egresos del Excel "muebles.xlsx" (gastos reales del taller, marzo-abril 2026). */
function seedCajaIniciales(): CajaRow[] {
  const base = (
    fecha: string,
    tipo: CajaRow["tipo"],
    medio: CajaRow["medio"],
    categoria: string,
    monto: number,
    descripcion: string,
    moduloOrigen: string,
    periodoCerrado = false,
  ): CajaRow => ({
    id: randomUUID(),
    organization_id: orgId,
    fecha,
    tipo,
    medio,
    categoria,
    monto,
    descripcion,
    modulo_origen: moduloOrigen,
    referencia_id: null,
    periodo_cerrado: periodoCerrado,
    es_personal: false,
    url_comprobante: null,
    created_at: nowIso(),
    created_by: null,
    updated_at: nowIso(),
    updated_by: null,
    voided_at: null,
    voided_by: null,
    void_reason: null,
  });
  return [
    base("2026-04-30", "ingreso", "yape", "venta_madera", 900, "Ropero Carlos", "ventas"),
    base("2026-04-29", "egreso", "efectivo", "compra_insumos", 180, "Tornillos y barniz", "caja"),
    base("2026-04-28", "ingreso", "banco", "alquiler_bomba_mixer", 650, "Pago alquiler obra Sur", "alquiler"),
    base("2026-04-27", "egreso", "yape", "adelanto_personal", 200, "Adelanto chofer", "personal"),
    base("2026-03-30", "ingreso", "efectivo", "servicio_corte_mueble", 420, "Corte y armado mueble", "muebles_corte", true),
  ];
}

function seedGastosExcel(): CajaRow[] {
  const base = (
    fecha: string,
    categoria: string,
    monto: number,
    descripcion: string,
    esPersonal = false,
  ): CajaRow => ({
    id: randomUUID(),
    organization_id: orgId,
    fecha,
    tipo: "egreso",
    medio: "efectivo",
    categoria,
    monto,
    descripcion,
    modulo_origen: "caja",
    referencia_id: null,
    periodo_cerrado: false,
    es_personal: esPersonal,
    url_comprobante: null,
    created_at: nowIso(),
    created_by: null,
    updated_at: nowIso(),
    updated_by: null,
    voided_at: null,
    voided_by: null,
    void_reason: null,
  });
  return [
    base("2026-04-05", "servicios_basicos", 335, "Pago de luz - mes abril"),
    base("2026-04-10", "personal", 900, "Pago a personal jornal semana 14"),
    base("2026-04-12", "compra_madera", 2100, "Madera Fatner — tornillo cepillado"),
    base("2026-04-12", "compra_madera", 1500, "Madera Bosco — pino para muebles"),
    base("2026-04-15", "personal", 3470, "Pensión Katia (gasto personal)", true),
    base("2026-04-20", "personal", 2800, "Pago de planilla quincena"),
    base("2026-04-25", "compra_insumos", 480, "Cola, lijas, barniz, herrajes"),
  ];
}

function normalizeCompraMadera(raw: unknown): CompraMaderaRow {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mp = r.modalidad_pago === "fiado" ? "fiado" : "contado";
  const est = r.estado === "borrador" ? "borrador" : "confirmada";
  return {
    id: String(r.id ?? randomUUID()),
    organization_id: String(r.organization_id ?? orgId),
    proveedor_id: String(r.proveedor_id ?? ""),
    fecha: String(r.fecha ?? new Date().toISOString().slice(0, 10)),
    especie_madera: String(r.especie_madera ?? ""),
    detalle: r.detalle != null ? String(r.detalle) : null,
    cantidad: Number(r.cantidad ?? 0),
    unidad: String(r.unidad ?? "pie"),
    precio_unitario: Number(r.precio_unitario ?? 0),
    total: Number(r.total ?? 0),
    modalidad_pago: mp,
    adelanto: Number(r.adelanto ?? 0),
    saldo_pendiente: Number(r.saldo_pendiente ?? 0),
    estado: est,
    url_comprobante: r.url_comprobante != null ? String(r.url_comprobante) : null,
    created_at: String(r.created_at ?? nowIso()),
    created_by: r.created_by != null ? String(r.created_by) : null,
  };
}

function normalizeCaja(raw: unknown): CajaRow {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? randomUUID()),
    organization_id: String(r.organization_id ?? orgId),
    fecha: String(r.fecha ?? new Date().toISOString().slice(0, 10)),
    tipo: (r.tipo === "ingreso" || r.tipo === "egreso" || r.tipo === "transferencia"
      ? r.tipo
      : "egreso") as CajaRow["tipo"],
    medio: (r.medio === "efectivo" || r.medio === "banco" || r.medio === "yape" || r.medio === "otro"
      ? r.medio
      : "efectivo") as CajaRow["medio"],
    categoria: String(r.categoria ?? "general"),
    monto: Number(r.monto ?? 0),
    descripcion: r.descripcion != null ? String(r.descripcion) : null,
    modulo_origen: r.modulo_origen != null ? String(r.modulo_origen) : null,
    referencia_id: r.referencia_id != null ? String(r.referencia_id) : null,
    periodo_cerrado: Boolean(r.periodo_cerrado ?? false),
    es_personal: Boolean(r.es_personal ?? false),
    url_comprobante: r.url_comprobante != null ? String(r.url_comprobante) : null,
    created_at: String(r.created_at ?? nowIso()),
    created_by: r.created_by != null ? String(r.created_by) : null,
    updated_at: String(r.updated_at ?? nowIso()),
    updated_by: r.updated_by != null ? String(r.updated_by) : null,
    voided_at: r.voided_at != null ? String(r.voided_at) : null,
    voided_by: r.voided_by != null ? String(r.voided_by) : null,
    void_reason: r.void_reason != null ? String(r.void_reason) : null,
  };
}

function isValidDemoStore(data: unknown): data is DemoStore {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  const keys: (keyof DemoStore)[] = [
    "caja",
    "clientes",
    "proveedores",
    "zonasEntrega",
    "registroCategorias",
    "registrosGenerales",
    "ventas",
    "comprasMadera",
    "cotizaciones",
    "cotizacionesUnificadas",
    "cortes",
    "alquileres",
    "empleados",
    "adelantos",
    "sueldos",
    "inventarioProductos",
    "inventarioMovimientos",
    "alertas",
    "cierres",
    "securityControls",
    "choferes",
    "mueblesCatalogo",
    "ventasMuebleTerminado",
    "ordenesProduccion",
    "serviciosAserradero",
    "serviciosEspecialesTarifa",
  ];
  return keys.every((k) => Array.isArray(o[k as string]));
}

export function readCorrelativoCounter(key: string): number {
  return store.correlativosCounter[key] ?? 0;
}

const PENALIDAD_ALQUILER_PCT_DEFAULT = 3;

function normalizeVenta(raw: unknown): VentaRow {
  if (!raw || typeof raw !== "object") {
    throw new Error("Fila de venta inválida en store JSON.");
  }
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id),
    organization_id: String(r.organization_id),
    cliente_id: String(r.cliente_id),
    fecha: String(r.fecha),
    estado: r.estado === "confirmada" ? "confirmada" : "borrador",
    total: Number(r.total),
    correlativo: r.correlativo != null ? String(r.correlativo) : null,
    created_at: String(r.created_at ?? nowIso()),
    created_by: r.created_by != null ? String(r.created_by) : null,
  };
}

function normalizeCliente(raw: unknown): ClienteRow {
  if (!raw || typeof raw !== "object") {
    throw new Error("Fila de cliente inválida en store JSON.");
  }
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id),
    organization_id: String(r.organization_id),
    nombre: String(r.nombre),
    documento: r.documento != null ? String(r.documento) : null,
    telefono: r.telefono != null ? String(r.telefono) : null,
    created_at: String(r.created_at ?? nowIso()),
    ruc: r.ruc != null ? String(r.ruc) : null,
    direccion: r.direccion != null ? String(r.direccion) : null,
    tipo_persona:
      r.tipo_persona === "natural" || r.tipo_persona === "empresa" ? r.tipo_persona : null,
  };
}

function normalizeAlquiler(raw: unknown): AlquilerContratoRow {
  if (!raw || typeof raw !== "object") {
    throw new Error("Fila de alquiler inválida en store JSON.");
  }
  const r = raw as Record<string, unknown>;
  const tu = r.tarifa_unidad;
  const mp = r.metodo_pago;
  const mo = r.modalidad_pago;
  return {
    id: String(r.id),
    organization_id: String(r.organization_id),
    cliente_id: String(r.cliente_id),
    activo: String(r.activo),
    fecha_inicio: String(r.fecha_inicio),
    fecha_fin: r.fecha_fin != null ? String(r.fecha_fin) : null,
    tarifa: Number(r.tarifa),
    penalidad: Number(r.penalidad ?? 0),
    estado: r.estado === "cerrado" ? "cerrado" : "abierto",
    created_at: String(r.created_at ?? nowIso()),
    codigo: r.codigo != null ? String(r.codigo) : null,
    representante: r.representante != null ? String(r.representante) : null,
    ruc_empresa: r.ruc_empresa != null ? String(r.ruc_empresa) : null,
    direccion_ejecucion: r.direccion_ejecucion != null ? String(r.direccion_ejecucion) : null,
    fecha_termino: r.fecha_termino != null ? String(r.fecha_termino) : null,
    dias_alquiler: r.dias_alquiler != null ? Number(r.dias_alquiler) : null,
    tarifa_unidad:
      tu === "hora_maquina" || tu === "m3" || tu === "dia" ? tu : null,
    monto_total: r.monto_total != null ? Number(r.monto_total) : null,
    deposito_30: r.deposito_30 != null ? Number(r.deposito_30) : null,
    penalidad_retraso_pago_pct: Number(r.penalidad_retraso_pago_pct ?? PENALIDAD_ALQUILER_PCT_DEFAULT),
    penalidad_devolucion_tardia_pct: Number(
      r.penalidad_devolucion_tardia_pct ?? PENALIDAD_ALQUILER_PCT_DEFAULT,
    ),
    penalidad_danios_pct: Number(r.penalidad_danios_pct ?? PENALIDAD_ALQUILER_PCT_DEFAULT),
    observaciones_retorno: r.observaciones_retorno != null ? String(r.observaciones_retorno) : null,
    metodo_pago:
      mp === "efectivo" ||
      mp === "yape" ||
      mp === "transferencia" ||
      mp === "billetera_digital" ||
      mp === "otro"
        ? mp
        : null,
    modalidad_pago: mo === "contado" || mo === "adelanto" || mo === "credito" ? mo : null,
    fecha_pago_credito: r.fecha_pago_credito != null ? String(r.fecha_pago_credito) : null,
  };
}

function normalizeOrdenProduccion(raw: unknown): OrdenProduccionRow {
  if (!raw || typeof raw !== "object") {
    throw new Error("Fila de orden de producción inválida en store JSON.");
  }
  const r = raw as Record<string, unknown>;
  const est = r.estado;
  return {
    id: String(r.id),
    organization_id: String(r.organization_id),
    cliente_id: String(r.cliente_id),
    cotizacion_id: r.cotizacion_id != null ? String(r.cotizacion_id) : null,
    cotizacion_unificada_id: r.cotizacion_unificada_id != null ? String(r.cotizacion_unificada_id) : null,
    estado: est === "terminado" || est === "entregado" ? est : "en_produccion",
    notas: r.notas != null ? String(r.notas) : null,
    fecha_aprobacion: r.fecha_aprobacion != null ? String(r.fecha_aprobacion) : null,
    created_at: String(r.created_at ?? nowIso()),
    correlativo: r.correlativo != null ? String(r.correlativo) : null,
  };
}

function normalizeCotizacionUnificada(raw: unknown): CotizacionUnificadaRow {
  if (!raw || typeof raw !== "object") {
    throw new Error("Fila de cotización unificada inválida en store JSON.");
  }
  const r = raw as Record<string, unknown>;
  const ef = r.estado_flujo;
  return {
    id: String(r.id),
    organization_id: String(r.organization_id),
    cliente_id: String(r.cliente_id),
    fecha: String(r.fecha),
    correlativo: r.correlativo != null ? String(r.correlativo) : null,
    tipo_cliente: r.tipo_cliente === "empresa" ? "empresa" : "natural",
    total: Number(r.total ?? 0),
    estado_flujo:
      ef === "lista_produccion" || ef === "en_produccion" || ef === "cobrada"
        ? ef
        : "pendiente",
    detalle: r.detalle && typeof r.detalle === "object" ? (r.detalle as Record<string, unknown>) : {},
    created_at: String(r.created_at ?? nowIso()),
  };
}

function migrateDemoStore(raw: Record<string, unknown>): DemoStore {
  const defaults = createDefaultDemoStore();
  const pick = <T>(key: keyof DemoStore, fallback: T[]): T[] => {
    const v = raw[key as string];
    return Array.isArray(v) ? (v as T[]) : fallback;
  };
  /** Para tablas nuevas: si la clave NO existía en el JSON antiguo, sembramos defaults; si está vacía a propósito, respetamos. */
  const seed = <T>(key: keyof DemoStore, fallback: T[]): T[] => {
    if (!(key in raw)) return fallback;
    const v = raw[key as string];
    return Array.isArray(v) ? (v as T[]) : fallback;
  };

  return {
    caja: pick<unknown>("caja", defaults.caja).map((row) => normalizeCaja(row)),
    clientes: pick<unknown>("clientes", defaults.clientes).map((row) => normalizeCliente(row)),
    proveedores: pick("proveedores", defaults.proveedores),
    registroCategorias: pick("registroCategorias", defaults.registroCategorias),
    registrosGenerales: pick("registrosGenerales", defaults.registrosGenerales),
    ventas: pick("ventas", defaults.ventas).map((row) => normalizeVenta(row)),
    comprasMadera: pick<unknown>("comprasMadera", defaults.comprasMadera).map(normalizeCompraMadera),
    cotizaciones: pick("cotizaciones", defaults.cotizaciones),
    cotizacionesUnificadas: seed<unknown>("cotizacionesUnificadas", defaults.cotizacionesUnificadas).map(
      (row) => normalizeCotizacionUnificada(row),
    ),
    cortes: pick("cortes", defaults.cortes),
    alquileres: pick<unknown>("alquileres", defaults.alquileres).map((row) => normalizeAlquiler(row)),
    empleados: pick("empleados", defaults.empleados),
    adelantos: pick("adelantos", defaults.adelantos),
    sueldos: pick("sueldos", defaults.sueldos),
    inventarioProductos: pick("inventarioProductos", defaults.inventarioProductos),
    inventarioMovimientos: pick("inventarioMovimientos", defaults.inventarioMovimientos),
    alertas: pick("alertas", defaults.alertas),
    cierres: pick("cierres", defaults.cierres),
    securityControls: pick("securityControls", defaults.securityControls),
    choferes: seed("choferes", defaults.choferes),
    mueblesCatalogo: seed("mueblesCatalogo", defaults.mueblesCatalogo),
    ventasMuebleTerminado: seed("ventasMuebleTerminado", defaults.ventasMuebleTerminado),
    ordenesProduccion: seed<unknown>("ordenesProduccion", defaults.ordenesProduccion).map((row) =>
      normalizeOrdenProduccion(row),
    ),
    serviciosAserradero: seed("serviciosAserradero", defaults.serviciosAserradero),
    serviciosEspecialesTarifa: seed(
      "serviciosEspecialesTarifa",
      defaults.serviciosEspecialesTarifa,
    ),
    zonasEntrega: seed("zonasEntrega", defaults.zonasEntrega),
    correlativosCounter:
      raw.correlativosCounter && typeof raw.correlativosCounter === "object"
        ? (raw.correlativosCounter as Record<string, number>)
        : defaults.correlativosCounter,
  };
}

function loadPersistedStore(): DemoStore {
  const fromDisk = readStoreFromDisk<unknown>();
  if (!fromDisk || typeof fromDisk !== "object") {
    const fresh = createDefaultDemoStore();
    writeStoreToDisk(fresh);
    return fresh;
  }
  try {
    const migrated = migrateDemoStore(fromDisk as Record<string, unknown>);
    if (!isValidDemoStore(migrated)) {
      const fresh = createDefaultDemoStore();
      writeStoreToDisk(fresh);
      return fresh;
    }
    return migrated;
  } catch {
    const fresh = createDefaultDemoStore();
    writeStoreToDisk(fresh);
    return fresh;
  }
}

const store: DemoStore = loadPersistedStore();

function persistStore() {
  writeStoreToDisk(store);
}

/** Devuelve una copia serializable del store local. Para respaldo / soporte. */
export function demoExportStore(): DemoStore {
  return JSON.parse(JSON.stringify(store)) as DemoStore;
}

/**
 * Reemplaza el store local con el snapshot recibido tras pasarlo por las mismas
 * normalizaciones que se aplican al cargar desde disco. Útil para restaurar un
 * respaldo desde la UI.
 */
export function demoImportStore(rawJson: string): { creados: number } {
  const parsed = JSON.parse(rawJson) as Record<string, unknown>;
  const migrated = migrateDemoStore(parsed);
  const counts =
    migrated.caja.length +
    migrated.clientes.length +
    migrated.proveedores.length +
    migrated.ventas.length +
    migrated.alquileres.length +
    migrated.cotizaciones.length +
    migrated.empleados.length +
    migrated.cierres.length +
    migrated.choferes.length +
    migrated.mueblesCatalogo.length +
    migrated.serviciosAserradero.length;
  Object.assign(store, migrated);
  persistStore();
  return { creados: counts };
}

/** Reinicia el store local a su estado base (demo inicial). */
export function demoResetStore(): { eliminados: number } {
  const snapshot = demoExportStore();
  const eliminados =
    snapshot.caja.length +
    snapshot.clientes.length +
    snapshot.proveedores.length +
    snapshot.ventas.length +
    snapshot.alquileres.length +
    snapshot.cotizaciones.length +
    snapshot.cotizacionesUnificadas.length +
    snapshot.cortes.length +
    snapshot.empleados.length +
    snapshot.adelantos.length +
    snapshot.sueldos.length +
    snapshot.cierres.length +
    snapshot.alertas.length +
    snapshot.comprasMadera.length +
    snapshot.inventarioProductos.length +
    snapshot.inventarioMovimientos.length +
    snapshot.registrosGenerales.length +
    snapshot.securityControls.length +
    snapshot.choferes.length +
    snapshot.mueblesCatalogo.length +
    snapshot.ventasMuebleTerminado.length +
    snapshot.ordenesProduccion.length +
    snapshot.serviciosAserradero.length +
    snapshot.serviciosEspecialesTarifa.length +
    snapshot.zonasEntrega.length;
  const fresh = createDefaultDemoStore();
  Object.assign(store, fresh);
  persistStore();
  return { eliminados };
}

const DELETABLE_COLLECTIONS = [
  "caja",
  "clientes",
  "proveedores",
  "registroCategorias",
  "registrosGenerales",
  "ventas",
  "comprasMadera",
  "cotizaciones",
  "cotizacionesUnificadas",
  "cortes",
  "alquileres",
  "empleados",
  "adelantos",
  "sueldos",
  "inventarioProductos",
  "inventarioMovimientos",
  "alertas",
  "cierres",
  "securityControls",
  "choferes",
  "mueblesCatalogo",
  "ventasMuebleTerminado",
  "ordenesProduccion",
  "serviciosAserradero",
  "serviciosEspecialesTarifa",
  "zonasEntrega",
] as const;

export type DemoDeletableCollection = (typeof DELETABLE_COLLECTIONS)[number];

function isDeletableCollection(value: string): value is DemoDeletableCollection {
  return (DELETABLE_COLLECTIONS as readonly string[]).includes(value);
}

export function demoDeleteByCategory(category: string): { eliminados: number } {
  if (!isDeletableCollection(category)) {
    throw new Error("Categoría inválida para eliminación.");
  }
  const rows = store[category] as unknown[];
  const eliminados = rows.length;
  rows.length = 0;
  persistStore();
  return { eliminados };
}

export function demoDeleteOneById(category: string, id: string): { eliminados: number } {
  if (!isDeletableCollection(category)) {
    throw new Error("Categoría inválida para eliminación.");
  }
  const rows = store[category] as Array<{ id?: string }>;
  const idx = rows.findIndex((row) => row.id === id);
  if (idx < 0) return { eliminados: 0 };
  rows.splice(idx, 1);
  persistStore();
  return { eliminados: 1 };
}

export function demoSnapshot() {
  const now = new Date();
  const utilidadRows = demoUtilidad();
  const mesRow = utilidadRows.find(
    (u) => u.anio === now.getFullYear() && u.mes === now.getMonth() + 1,
  );
  return {
    caja: [...store.caja].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8),
    ventas: [...store.ventas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8),
    alquileres: [...store.alquileres].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio)).slice(0, 8),
    empleados: [...store.empleados],
    alertas: [...store.alertas].slice(0, 8),
    utilidad: utilidadRows.slice(0, 6),
    ingresosMesActual: Number(mesRow?.ingresos ?? 0),
    egresosMesActual: Number(mesRow?.egresos ?? 0),
  };
}

export function demoCajaRows() {
  return [...store.caja].sort((a, b) => b.fecha.localeCompare(a.fecha));
}
export function demoVentasRows() {
  return [...store.ventas].sort((a, b) => b.fecha.localeCompare(a.fecha));
}
export function demoClientesRows() {
  return [...store.clientes].sort((a, b) => a.nombre.localeCompare(b.nombre));
}
export function demoProveedoresRows() {
  return [...store.proveedores].sort((a, b) => a.nombre.localeCompare(b.nombre));
}
export function demoRegistroCategoriasRows() {
  return [...store.registroCategorias]
    .filter((row) => row.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}
export function demoRegistrosGeneralesRows() {
  return [...store.registrosGenerales].sort((a, b) => b.fecha.localeCompare(a.fecha));
}
export function demoCotizacionesRows() {
  return [...store.cotizaciones].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function demoCotizacionesUnificadasRows() {
  return [...store.cotizacionesUnificadas].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function demoGetCotizacionUnificada(id: string): CotizacionUnificadaRow | undefined {
  return store.cotizacionesUnificadas.find((c) => c.id === id);
}

export function demoCreateCotizacionUnificada(
  input: Omit<CotizacionUnificadaRow, "id" | "created_at"> & { correlativo?: string | null },
) {
  const row: CotizacionUnificadaRow = {
    id: randomUUID(),
    created_at: nowIso(),
    correlativo: input.correlativo ?? null,
    organization_id: input.organization_id,
    cliente_id: input.cliente_id,
    fecha: input.fecha,
    tipo_cliente: input.tipo_cliente,
    total: input.total,
    estado_flujo: input.estado_flujo,
    detalle: input.detalle,
  };
  store.cotizacionesUnificadas.unshift(row);
  persistStore();
  return row;
}

export function demoUpdateCotizacionUnificada(
  id: string,
  patch: Partial<
    Pick<
      CotizacionUnificadaRow,
      "total" | "estado_flujo" | "detalle" | "fecha" | "correlativo" | "cliente_id" | "tipo_cliente"
    >
  >,
) {
  const row = store.cotizacionesUnificadas.find((c) => c.id === id);
  if (!row) return null;
  Object.assign(row, patch);
  persistStore();
  return row;
}

export function demoDeleteCotizacionUnificada(id: string) {
  const idx = store.cotizacionesUnificadas.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  const row = store.cotizacionesUnificadas[idx];
  if (row.estado_flujo !== "pendiente") return false;
  store.cotizacionesUnificadas.splice(idx, 1);
  persistStore();
  return true;
}
export function demoCortesRows(cotizacionId?: string) {
  const rows = cotizacionId
    ? store.cortes.filter((row) => row.cotizacion_id === cotizacionId)
    : store.cortes;
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function demoAlquilerRows() {
  return [...store.alquileres].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
}
export function demoComprasMaderaRows() {
  return [...store.comprasMadera].sort((a, b) => b.fecha.localeCompare(a.fecha));
}
export function demoPersonalRows() {
  return {
    empleados: [...store.empleados],
    adelantos: [...store.adelantos].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    sueldos: [...store.sueldos].sort((a, b) => b.periodo.localeCompare(a.periodo)),
  };
}
export function demoUtilidadRows() {
  return demoUtilidad();
}
export function demoCierresRows() {
  return [...store.cierres].sort((a, b) => `${b.anio}${b.mes}`.localeCompare(`${a.anio}${a.mes}`));
}

export function demoSecurityControlRows() {
  return [...store.securityControls];
}

export function demoInventarioProductosRows() {
  return [...store.inventarioProductos].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export function demoInventarioMovimientosRows() {
  return [...store.inventarioMovimientos].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function demoInventarioResumen() {
  const productos = demoInventarioProductosRows();
  const movimientos = demoInventarioMovimientosRows();

  const vendidos = new Map<string, number>();
  for (const m of movimientos) {
    if (m.tipo !== "salida_venta") continue;
    vendidos.set(m.producto_id, (vendidos.get(m.producto_id) ?? 0) + Number(m.cantidad));
  }

  const ranking = productos.map((p) => ({
    ...p,
    vendido: vendidos.get(p.id) ?? 0,
  }));

  const masVendidos = [...ranking].sort((a, b) => b.vendido - a.vendido).slice(0, 5);
  const menosVendidos = [...ranking].sort((a, b) => a.vendido - b.vendido).slice(0, 5);
  const stockBajo = ranking.filter((p) => p.stock_actual <= p.stock_minimo);

  return { productos, movimientos, masVendidos, menosVendidos, stockBajo };
}

function demoUtilidad(): UtilidadRow[] {
  const grouped = new Map<string, UtilidadRow>();
  for (const row of store.caja.filter((x) => x.voided_at === null)) {
    const [anio, mes] = row.fecha.split("-").map(Number);
    const key = `${anio}-${mes}`;
    const current = grouped.get(key) ?? {
      organization_id: orgId,
      anio,
      mes,
      ingresos: 0,
      egresos: 0,
      sueldos: 0,
      utilidad_neta: 0,
    };
    if (row.tipo === "ingreso") current.ingresos += Number(row.monto);
    if (row.tipo === "egreso") current.egresos += Number(row.monto);
    grouped.set(key, current);
  }
  for (const row of store.sueldos) {
    const [anio, mes] = row.periodo.split("-").map(Number);
    const key = `${anio}-${mes}`;
    const current = grouped.get(key) ?? {
      organization_id: orgId,
      anio,
      mes,
      ingresos: 0,
      egresos: 0,
      sueldos: 0,
      utilidad_neta: 0,
    };
    current.sueldos += Number(row.monto_neto);
    grouped.set(key, current);
  }
  return [...grouped.values()]
    .map((row) => ({ ...row, utilidad_neta: row.ingresos - row.egresos - row.sueldos }))
    .sort((a, b) => `${b.anio}${b.mes}`.localeCompare(`${a.anio}${a.mes}`));
}

type DemoCreateCajaInput = Omit<
  CajaRow,
  | "id"
  | "created_at"
  | "updated_at"
  | "periodo_cerrado"
  | "voided_at"
  | "voided_by"
  | "void_reason"
  | "created_by"
  | "updated_by"
  | "referencia_id"
  | "es_personal"
  | "url_comprobante"
> & {
  referencia_id?: string | null;
  es_personal?: boolean;
  url_comprobante?: string | null;
};

export function demoCreateCaja(input: DemoCreateCajaInput) {
  const row: CajaRow = {
    id: randomUUID(),
    created_at: nowIso(),
    updated_at: nowIso(),
    created_by: null,
    updated_by: null,
    periodo_cerrado: false,
    voided_at: null,
    voided_by: null,
    void_reason: null,
    referencia_id: input.referencia_id ?? null,
    es_personal: input.es_personal ?? false,
    url_comprobante: input.url_comprobante ?? null,
    ...input,
  };
  store.caja.unshift(row);
  persistStore();
}

export function demoCreateCliente(input: Omit<ClienteRow, "id" | "created_at">): string {
  const id = randomUUID();
  store.clientes.unshift({
    id,
    created_at: nowIso(),
    ...input,
    ruc: input.ruc ?? null,
    direccion: input.direccion ?? null,
    tipo_persona: input.tipo_persona ?? null,
  });
  persistStore();
  return id;
}

export function demoCreateProveedor(input: Omit<ProveedorRow, "id" | "created_at">) {
  store.proveedores.unshift({ id: randomUUID(), created_at: nowIso(), ...input });
  persistStore();
}

export function demoCreateRegistroGeneral(
  input: Omit<RegistroGeneralRow, "id" | "created_at" | "created_by" | "metadata"> & {
    metadata?: Record<string, unknown>;
  },
) {
  store.registrosGenerales.unshift({
    id: randomUUID(),
    created_at: nowIso(),
    created_by: null,
    metadata: input.metadata ?? {},
    ...input,
  });
  persistStore();
}

export function demoCreateVenta(input: Omit<VentaRow, "id" | "created_at" | "created_by">) {
  const row: VentaRow = {
    id: randomUUID(),
    created_at: nowIso(),
    created_by: null,
    ...input,
    correlativo: input.correlativo ?? null,
  };
  store.ventas.unshift(row);
  if (row.estado === "confirmada") {
    demoCreateCaja({
      organization_id: row.organization_id,
      fecha: row.fecha,
      tipo: "ingreso",
      medio: "efectivo",
      categoria: "venta_madera",
      monto: row.total,
      descripcion: row.correlativo ? `Venta madera ${row.correlativo}` : "Venta madera",
      modulo_origen: "ventas_madera",
      referencia_id: row.id,
    });
  }
  persistStore();
}

export function demoCreateCompraMadera(
  input: Omit<CompraMaderaRow, "id" | "created_at" | "created_by" | "url_comprobante"> & {
    url_comprobante?: string | null;
  },
) {
  const row: CompraMaderaRow = {
    id: randomUUID(),
    created_at: nowIso(),
    created_by: null,
    url_comprobante: input.url_comprobante ?? null,
    ...input,
  };
  store.comprasMadera.unshift(row);

  if (row.estado === "confirmada") {
    const egreso = row.modalidad_pago === "fiado" ? row.adelanto : row.total;
    if (egreso > 0) {
      demoCreateCaja({
        organization_id: row.organization_id,
        fecha: row.fecha,
        tipo: "egreso",
        medio: "efectivo",
        categoria: "compra_madera",
        monto: egreso,
        descripcion:
          row.modalidad_pago === "fiado"
            ? "Egreso por adelanto de compra fiada"
            : "Egreso por compra de madera al contado",
        modulo_origen: "compras_madera",
        referencia_id: row.id,
      });
    }
  }
  persistStore();
}

/** Elimina cotización `mueble_personalizado` si no tiene orden de producción vinculada (misma regla que Supabase `ON DELETE RESTRICT`). */
export function demoDeleteCotizacionMueblePersonalizada(
  id: string,
): { ok: true } | { ok: false; error: string } {
  const idx = store.cotizaciones.findIndex((c) => c.id === id);
  if (idx === -1) {
    return { ok: false, error: "Cotización no encontrada." };
  }
  const row = store.cotizaciones[idx];
  if (row.tipo !== "mueble_personalizado") {
    return {
      ok: false,
      error: "Solo se pueden eliminar cotizaciones de mueble personalizado desde este listado.",
    };
  }
  const tieneOrden = store.ordenesProduccion.some((o) => o.cotizacion_id === id);
  if (tieneOrden) {
    return {
      ok: false,
      error:
        "No se puede eliminar: hay una orden de producción vinculada. Quitá o completá esa orden desde el tablero Kanban antes de borrar la cotización.",
    };
  }
  store.cortes = store.cortes.filter((c) => c.cotizacion_id !== id);
  store.cotizaciones.splice(idx, 1);
  persistStore();
  return { ok: true };
}

export function demoCreateCotizacion(
  input: Omit<CotizacionRow, "id" | "created_at" | "correlativo"> & {
    correlativo?: string | null;
  },
) {
  const { correlativo: correlativoOpt, ...rest } = input;
  const row: CotizacionRow = {
    id: randomUUID(),
    created_at: nowIso(),
    correlativo: correlativoOpt ?? null,
    ...rest,
  };
  store.cotizaciones.unshift(row);
  if (row.estado === "confirmada") {
    demoCreateCaja({
      organization_id: row.organization_id,
      fecha: row.fecha,
      tipo: "ingreso",
      medio: "efectivo",
      categoria: "servicio_corte_mueble",
      monto: row.precio_acordado,
      descripcion: "Ingreso automático por servicio confirmado",
      modulo_origen: "muebles_corte",
      referencia_id: row.id,
    });
  }
  persistStore();
}

export function demoCreateCorte(input: Omit<CorteRow, "id" | "created_at">) {
  store.cortes.unshift({ id: randomUUID(), created_at: nowIso(), ...input });
  persistStore();
}

export function demoCreateAlquiler(
  input: Pick<
    AlquilerContratoRow,
    "organization_id" | "cliente_id" | "activo" | "fecha_inicio" | "tarifa" | "penalidad" | "estado"
  > &
    Partial<
      Omit<
        AlquilerContratoRow,
        | "id"
        | "created_at"
        | "fecha_fin"
        | "organization_id"
        | "cliente_id"
        | "activo"
        | "fecha_inicio"
        | "tarifa"
        | "penalidad"
        | "estado"
      >
    >,
) {
  store.alquileres.unshift({
    id: randomUUID(),
    created_at: nowIso(),
    fecha_fin: null,
    codigo: null,
    representante: null,
    ruc_empresa: null,
    direccion_ejecucion: null,
    fecha_termino: null,
    dias_alquiler: null,
    tarifa_unidad: null,
    monto_total: null,
    deposito_30: null,
    penalidad_retraso_pago_pct: PENALIDAD_ALQUILER_PCT_DEFAULT,
    penalidad_devolucion_tardia_pct: PENALIDAD_ALQUILER_PCT_DEFAULT,
    penalidad_danios_pct: PENALIDAD_ALQUILER_PCT_DEFAULT,
    observaciones_retorno: null,
    metodo_pago: null,
    modalidad_pago: null,
    fecha_pago_credito: null,
    ...input,
  });
  persistStore();
}

export function demoCreateEmpleado(input: Omit<EmpleadoRow, "id" | "created_at" | "activo">) {
  store.empleados.unshift({ id: randomUUID(), created_at: nowIso(), activo: true, ...input });
  persistStore();
}

export function demoCreateAdelanto(input: Omit<AdelantoRow, "id" | "created_at" | "estado">) {
  store.adelantos.unshift({ id: randomUUID(), created_at: nowIso(), estado: "pendiente", ...input });
  persistStore();
}

export function demoCreateSueldo(input: Omit<SueldoRow, "id" | "created_at">) {
  store.sueldos.unshift({ id: randomUUID(), created_at: nowIso(), ...input });
  persistStore();
}

export function demoCreateInventarioProducto(
  input: Omit<InventarioProductoRow, "id" | "created_at" | "stock_actual" | "activo">,
) {
  store.inventarioProductos.unshift({
    id: randomUUID(),
    created_at: nowIso(),
    stock_actual: 0,
    activo: true,
    ...input,
  });
  persistStore();
}

export function demoUpdateInventarioProducto(
  id: string,
  patch: Partial<
    Pick<InventarioProductoRow, "codigo" | "nombre" | "categoria" | "unidad" | "stock_minimo" | "activo">
  >,
) {
  const row = store.inventarioProductos.find((p) => p.id === id);
  if (!row) return null;
  Object.assign(row, patch);
  persistStore();
  return row;
}

export function demoToggleInventarioProductoActivo(id: string, activo: boolean) {
  return demoUpdateInventarioProducto(id, { activo });
}

export function demoDeleteInventarioProducto(id: string): { ok: true } | { ok: false; error: string } {
  const movs = store.inventarioMovimientos.filter((m) => m.producto_id === id);
  if (movs.length > 0) {
    return {
      ok: false,
      error:
        "No se puede eliminar: este producto tiene movimientos en el kardex. Eliminá primero esos movimientos o desactivá el producto.",
    };
  }
  const idx = store.inventarioProductos.findIndex((p) => p.id === id);
  if (idx < 0) return { ok: false, error: "Producto no encontrado." };
  store.inventarioProductos.splice(idx, 1);
  persistStore();
  return { ok: true };
}

export function demoCreateInventarioMovimiento(
  input: Omit<InventarioMovimientoRow, "id" | "created_at">,
) {
  const row: InventarioMovimientoRow = {
    id: randomUUID(),
    created_at: nowIso(),
    ...input,
  };
  store.inventarioMovimientos.unshift(row);

  const producto = store.inventarioProductos.find((p) => p.id === row.producto_id);
  if (!producto) return;

  if (row.tipo === "entrada_compra") producto.stock_actual += Number(row.cantidad);
  if (row.tipo === "salida_venta") producto.stock_actual -= Number(row.cantidad);
  if (row.tipo === "ajuste") producto.stock_actual += Number(row.cantidad);
  persistStore();
}

function reverseMovimientoStock(producto: InventarioProductoRow, row: InventarioMovimientoRow) {
  if (row.tipo === "entrada_compra") producto.stock_actual -= Number(row.cantidad);
  if (row.tipo === "salida_venta") producto.stock_actual += Number(row.cantidad);
  if (row.tipo === "ajuste") producto.stock_actual -= Number(row.cantidad);
}

export function demoDeleteInventarioMovimiento(id: string) {
  const idx = store.inventarioMovimientos.findIndex((m) => m.id === id);
  if (idx < 0) return false;
  const row = store.inventarioMovimientos[idx];
  const producto = store.inventarioProductos.find((p) => p.id === row.producto_id);
  if (producto) {
    reverseMovimientoStock(producto, row);
    if (producto.stock_actual < 0) producto.stock_actual = 0;
  }
  store.inventarioMovimientos.splice(idx, 1);
  persistStore();
  return true;
}

export function demoRegistrarConteoInventario(
  productoId: string,
  stockContado: number,
  fecha: string,
  referencia: string,
) {
  const producto = store.inventarioProductos.find((p) => p.id === productoId);
  if (!producto) return { ok: false as const, error: "Producto no encontrado." };
  const diferencia = Number((stockContado - Number(producto.stock_actual)).toFixed(2));
  if (Math.abs(diferencia) < 0.0001) {
    return { ok: true as const, diferencia: 0 };
  }
  demoCreateInventarioMovimiento({
    organization_id: producto.organization_id,
    producto_id: productoId,
    fecha,
    tipo: "ajuste",
    cantidad: diferencia,
    costo_unitario: null,
    referencia,
  });
  return { ok: true as const, diferencia };
}

export function demoCerrarMes(organizationId: string, anio: number, mes: number) {
  const report = demoUtilidad().find((row) => row.anio === anio && row.mes === mes) ?? {
    organization_id: organizationId,
    anio,
    mes,
    ingresos: 0,
    egresos: 0,
    sueldos: 0,
    utilidad_neta: 0,
  };
  const hash = createHash("sha256").update(JSON.stringify(report)).digest("hex");

  store.cierres = store.cierres.filter((x) => !(x.organization_id === organizationId && x.anio === anio && x.mes === mes));
  store.cierres.unshift({
    id: randomUUID(),
    organization_id: organizationId,
    anio,
    mes,
    hash_sha256: hash,
    reporte_json: report,
    closed_at: nowIso(),
    closed_by: null,
    reopened_at: null,
    reopened_by: null,
    reopen_reason: null,
  });

  for (const row of store.caja) {
    const [y, m] = row.fecha.split("-").map(Number);
    if (y === anio && m === mes) row.periodo_cerrado = true;
  }
  persistStore();
}

export function demoToggleSecurityControl(id: string) {
  const row = store.securityControls.find((item) => item.id === id);
  if (!row) return;
  row.completed = !row.completed;
  row.updated_at = nowIso();
  persistStore();
}

export function demoChoferesRows() {
  return [...store.choferes].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export function demoCreateChofer(
  input: Pick<ChoferRow, "organization_id" | "nombre"> & Partial<Omit<ChoferRow, "id" | "created_at" | "organization_id" | "nombre">>,
) {
  store.choferes.unshift({
    id: randomUUID(),
    organization_id: input.organization_id,
    nombre: input.nombre,
    telefono: input.telefono ?? null,
    placa: input.placa ?? null,
    activo: input.activo ?? true,
    created_at: nowIso(),
  });
  persistStore();
}

export function demoMueblesCatalogoRows() {
  return [...store.mueblesCatalogo].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export function demoCreateMuebleCatalogo(
  input: Pick<MuebleCatalogoRow, "organization_id" | "codigo" | "nombre" | "precio_lista"> &
    Partial<Omit<MuebleCatalogoRow, "id" | "created_at" | "organization_id" | "codigo" | "nombre" | "precio_lista">>,
) {
  store.mueblesCatalogo.unshift({
    id: randomUUID(),
    organization_id: input.organization_id,
    codigo: input.codigo,
    nombre: input.nombre,
    precio_lista: input.precio_lista,
    descripcion: input.descripcion ?? null,
    foto_url: input.foto_url ?? null,
    stock_disponible: input.stock_disponible ?? 0,
    activo: input.activo ?? true,
    created_at: nowIso(),
  });
  persistStore();
}

export function demoUpdateMuebleCatalogo(
  id: string,
  patch: Pick<MuebleCatalogoRow, "precio_lista"> & Partial<Pick<MuebleCatalogoRow, "descripcion" | "foto_url">>,
) {
  const row = store.mueblesCatalogo.find((m) => m.id === id);
  if (!row) return null;
  row.precio_lista = patch.precio_lista;
  row.descripcion = patch.descripcion ?? null;
  row.foto_url = patch.foto_url ?? null;
  persistStore();
  return row;
}

export function demoToggleMuebleCatalogoActivo(id: string, activo: boolean) {
  const row = store.mueblesCatalogo.find((m) => m.id === id);
  if (!row) return null;
  row.activo = activo;
  persistStore();
  return row;
}

export function demoVentasMuebleTerminadoRows() {
  return [...store.ventasMuebleTerminado].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function demoCreateVentaMuebleTerminado(
  input: Omit<VentaMuebleTerminadoRow, "id" | "created_at" | "correlativo"> & {
    correlativo?: string | null;
    /** Si se confirma, dispara ingreso automático en caja por el monto cobrado. */
    confirmaIngreso?: boolean;
  },
) {
  const { confirmaIngreso = true, correlativo, ...row } = input;
  const newRow: VentaMuebleTerminadoRow = {
    id: randomUUID(),
    created_at: nowIso(),
    correlativo: correlativo ?? null,
    ...row,
  };
  store.ventasMuebleTerminado.unshift(newRow);

  // Descuenta del stock disponible del catálogo.
  const mueble = store.mueblesCatalogo.find((m) => m.id === newRow.mueble_catalogo_id);
  if (mueble) {
    mueble.stock_disponible = Math.max(0, mueble.stock_disponible - newRow.cantidad);
  }

  if (confirmaIngreso) {
    const monto =
      newRow.modalidad_pago === "credito" ? 0 : newRow.total;
    if (monto > 0) {
      const medioCaja = mapMetodoPagoToMedio(newRow.metodo_pago);
      demoCreateCaja({
        organization_id: newRow.organization_id,
        fecha: newRow.fecha,
        tipo: "ingreso",
        medio: medioCaja,
        categoria: "venta_mueble_terminado",
        monto,
        descripcion: `Venta de ${newRow.cantidad} × ${mueble?.nombre ?? "mueble"}`,
        modulo_origen: "ventas_muebles_terminados",
        referencia_id: newRow.id,
      });
    }
  }
  persistStore();
}

export function demoMarcarEntregaMueble(id: string, nuevoEstado: EstadoEntrega) {
  const row = store.ventasMuebleTerminado.find((v) => v.id === id);
  if (!row) return;
  row.estado_entrega = nuevoEstado;
  persistStore();
}

export function demoOrdenesProduccionRows() {
  return [...store.ordenesProduccion].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function demoCreateOrdenProduccion(
  input: Pick<OrdenProduccionRow, "organization_id" | "cliente_id"> &
    Partial<Omit<OrdenProduccionRow, "id" | "created_at" | "organization_id" | "cliente_id">>,
) {
  const newRow: OrdenProduccionRow = {
    id: randomUUID(),
    organization_id: input.organization_id,
    cliente_id: input.cliente_id,
    cotizacion_id: input.cotizacion_id ?? null,
    cotizacion_unificada_id: input.cotizacion_unificada_id ?? null,
    estado: input.estado ?? "en_produccion",
    notas: input.notas ?? null,
    fecha_aprobacion: input.fecha_aprobacion ?? new Date().toISOString().slice(0, 10),
    created_at: nowIso(),
    correlativo: input.correlativo ?? null,
  };
  store.ordenesProduccion.unshift(newRow);
  persistStore();
  return newRow;
}

export function demoCambiarEstadoOrden(id: string, nuevoEstado: OrdenProduccionRow["estado"]) {
  const row = store.ordenesProduccion.find((o) => o.id === id);
  if (!row) return;
  row.estado = nuevoEstado;
  persistStore();
}

export function demoServiciosAserraderoRows() {
  return [...store.serviciosAserradero].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function demoCreateServicioAserradero(
  input: Omit<ServicioAserraderoRow, "id" | "created_at" | "correlativo"> & {
    correlativo?: string | null;
    confirmaIngreso?: boolean;
  },
) {
  const { confirmaIngreso = true, correlativo, ...row } = input;
  const newRow: ServicioAserraderoRow = {
    id: randomUUID(),
    created_at: nowIso(),
    correlativo: correlativo ?? null,
    ...row,
  };
  store.serviciosAserradero.unshift(newRow);
  if (confirmaIngreso && newRow.precio_cobrado > 0) {
    demoCreateCaja({
      organization_id: newRow.organization_id,
      fecha: newRow.fecha,
      tipo: "ingreso",
      medio: "efectivo",
      categoria: "servicio_aserradero",
      monto: newRow.precio_cobrado,
      descripcion: `Servicio aserradero (${newRow.pies_cubicos.toFixed(2)} pies cúbicos)`,
      modulo_origen: "ventas_aserradero",
      referencia_id: newRow.id,
    });
  }
  persistStore();
}

export function demoServiciosEspecialesTarifaRows() {
  return [...store.serviciosEspecialesTarifa].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export function demoCreateServicioEspecialTarifa(
  input: Pick<ServicioEspecialTarifaRow, "organization_id" | "codigo" | "nombre" | "tarifa_por_pieza"> &
    Partial<Pick<ServicioEspecialTarifaRow, "activo">>,
) {
  store.serviciosEspecialesTarifa.unshift({
    id: randomUUID(),
    organization_id: input.organization_id,
    codigo: input.codigo,
    nombre: input.nombre,
    tarifa_por_pieza: input.tarifa_por_pieza,
    activo: input.activo ?? true,
    created_at: nowIso(),
  });
  persistStore();
}

export function demoZonasEntregaRows() {
  return [...store.zonasEntrega]
    .filter((z) => z.activo)
    .sort((a, b) => a.distancia_km - b.distancia_km);
}

export function demoCreateZonaEntrega(
  input: Pick<ZonaEntregaRow, "organization_id" | "nombre" | "distancia_km" | "tarifa"> &
    Partial<Pick<ZonaEntregaRow, "activo">>,
) {
  const newRow: ZonaEntregaRow = {
    id: randomUUID(),
    organization_id: input.organization_id,
    nombre: input.nombre,
    distancia_km: input.distancia_km,
    tarifa: input.tarifa,
    activo: input.activo ?? true,
    created_at: nowIso(),
  };
  store.zonasEntrega.unshift(newRow);
  persistStore();
  return newRow;
}

export function demoCreateContratoAlquiler(
  input: Pick<
    AlquilerContratoRow,
    "organization_id" | "cliente_id" | "activo" | "fecha_inicio" | "tarifa"
  > &
    Partial<Omit<AlquilerContratoRow, "id" | "created_at" | "organization_id" | "cliente_id" | "activo" | "fecha_inicio" | "tarifa">>,
) {
  const monto = input.monto_total ?? input.tarifa * (input.dias_alquiler ?? 1);
  const deposito = Number((monto * 0.3).toFixed(2));

  const newRow: AlquilerContratoRow = {
    id: randomUUID(),
    organization_id: input.organization_id,
    cliente_id: input.cliente_id,
    activo: input.activo,
    fecha_inicio: input.fecha_inicio,
    fecha_fin: input.fecha_fin ?? null,
    tarifa: input.tarifa,
    penalidad: input.penalidad ?? 0,
    estado: input.estado ?? "abierto",
    created_at: nowIso(),
    codigo: input.codigo ?? null,
    representante: input.representante ?? null,
    ruc_empresa: input.ruc_empresa ?? null,
    direccion_ejecucion: input.direccion_ejecucion ?? null,
    fecha_termino: input.fecha_termino ?? null,
    dias_alquiler: input.dias_alquiler ?? null,
    tarifa_unidad: input.tarifa_unidad ?? null,
    monto_total: monto,
    deposito_30: input.deposito_30 ?? deposito,
    penalidad_retraso_pago_pct: input.penalidad_retraso_pago_pct ?? PENALIDAD_ALQUILER_PCT_DEFAULT,
    penalidad_devolucion_tardia_pct:
      input.penalidad_devolucion_tardia_pct ?? PENALIDAD_ALQUILER_PCT_DEFAULT,
    penalidad_danios_pct: input.penalidad_danios_pct ?? PENALIDAD_ALQUILER_PCT_DEFAULT,
    observaciones_retorno: input.observaciones_retorno ?? null,
    metodo_pago: input.metodo_pago ?? null,
    modalidad_pago: input.modalidad_pago ?? null,
    fecha_pago_credito: input.fecha_pago_credito ?? null,
  };

  store.alquileres.unshift(newRow);

  if (newRow.estado === "abierto" && newRow.deposito_30 && newRow.deposito_30 > 0) {
    demoCreateCaja({
      organization_id: newRow.organization_id,
      fecha: newRow.fecha_inicio,
      tipo: "ingreso",
      medio: mapMetodoPagoToMedio(newRow.metodo_pago ?? "efectivo"),
      categoria: "alquiler_bomba_mixer",
      monto: newRow.deposito_30,
      descripcion: `Depósito 30% contrato ${newRow.codigo ?? newRow.id.slice(0, 8)}`,
      modulo_origen: "ventas_alquiler",
      referencia_id: newRow.id,
    });
  }

  persistStore();
  return newRow;
}

type PenalidadFlags = {
  retraso_pago: boolean;
  devolucion_tardia: boolean;
  danios: boolean;
};

export function demoCerrarContratoAlquiler(
  id: string,
  input: { fechaCierre: string; observaciones?: string | null; penalidades: PenalidadFlags },
) {
  const row = store.alquileres.find((a) => a.id === id);
  if (!row) return;

  let penalidadTotal = 0;
  if (row.monto_total) {
    if (input.penalidades.retraso_pago) {
      penalidadTotal += (row.monto_total * row.penalidad_retraso_pago_pct) / 100;
    }
    if (input.penalidades.devolucion_tardia) {
      penalidadTotal += (row.monto_total * row.penalidad_devolucion_tardia_pct) / 100;
    }
    if (input.penalidades.danios) {
      penalidadTotal += (row.monto_total * row.penalidad_danios_pct) / 100;
    }
  }
  penalidadTotal = Number(penalidadTotal.toFixed(2));

  row.estado = "cerrado";
  row.fecha_fin = input.fechaCierre;
  row.observaciones_retorno = input.observaciones ?? row.observaciones_retorno;
  row.penalidad = (row.penalidad ?? 0) + penalidadTotal;

  if (penalidadTotal > 0) {
    demoCreateCaja({
      organization_id: row.organization_id,
      fecha: input.fechaCierre,
      tipo: "ingreso",
      medio: "efectivo",
      categoria: "penalidad_alquiler",
      monto: penalidadTotal,
      descripcion: `Penalidad cierre contrato ${row.codigo ?? row.id.slice(0, 8)}`,
      modulo_origen: "ventas_alquiler",
      referencia_id: row.id,
    });
  }

  // Si quedaba saldo (monto_total - depósito), lo registra como ingreso al cerrar.
  if (row.monto_total) {
    const saldo = Number(((row.monto_total - (row.deposito_30 ?? 0))).toFixed(2));
    if (saldo > 0) {
      demoCreateCaja({
        organization_id: row.organization_id,
        fecha: input.fechaCierre,
        tipo: "ingreso",
        medio: mapMetodoPagoToMedio(row.metodo_pago ?? "efectivo"),
        categoria: "alquiler_bomba_mixer",
        monto: saldo,
        descripcion: `Saldo final contrato ${row.codigo ?? row.id.slice(0, 8)}`,
        modulo_origen: "ventas_alquiler",
        referencia_id: row.id,
      });
    }
  }

  persistStore();
}

export function demoCreateVentaMaderaCortada(input: {
  organization_id: string;
  cliente_id: string;
  fecha: string;
  tipo_corte: "tabla" | "liston" | "cuarton" | "poste";
  total_pt: number;
  precio_por_pt: number;
  total: number;
  metodo_pago: MetodoPago;
  modalidad_pago: ModalidadPago;
  fecha_pago_credito: string | null;
  chofer_id: string | null;
  tipo_entrega: TipoEntrega;
  direccion_entrega: string | null;
  estado_entrega: EstadoEntrega;
  inventario_producto_id: string | null;
}) {
  // Reusamos VentaRow para listado simple.
  const venta: VentaRow = {
    id: randomUUID(),
    organization_id: input.organization_id,
    cliente_id: input.cliente_id,
    fecha: input.fecha,
    estado: "confirmada",
    total: input.total,
    correlativo: null,
    created_at: nowIso(),
    created_by: null,
  };
  store.ventas.unshift(venta);

  if (input.modalidad_pago !== "credito" && input.total > 0) {
    demoCreateCaja({
      organization_id: input.organization_id,
      fecha: input.fecha,
      tipo: "ingreso",
      medio: mapMetodoPagoToMedio(input.metodo_pago),
      categoria: "venta_madera_cortada",
      monto: input.total,
      descripcion: `Venta ${input.total_pt.toFixed(2)} PT (${input.tipo_corte})`,
      modulo_origen: "ventas_madera_cortada",
      referencia_id: venta.id,
    });
  }

  if (input.inventario_producto_id) {
    demoCreateInventarioMovimiento({
      organization_id: input.organization_id,
      producto_id: input.inventario_producto_id,
      fecha: input.fecha,
      tipo: "salida_venta",
      cantidad: input.total_pt,
      costo_unitario: input.precio_por_pt,
      referencia: `venta_madera_cortada:${venta.id}`,
    });
  }

  persistStore();
  return venta;
}

function mapMetodoPagoToMedio(metodo: MetodoPago): CajaRow["medio"] {
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
