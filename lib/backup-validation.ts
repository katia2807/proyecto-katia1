import { z } from "zod";

const text = z.string().trim().min(1);
const date = z.iso.date();
const money = z.number().finite();
const schemas: Record<string, z.ZodType> = {
  caja: z.object({ fecha: date, tipo: z.enum(["ingreso", "egreso", "transferencia"]), medio: text, monto: money.nonnegative() }),
  clientes: z.object({ nombre: text }), proveedores: z.object({ nombre: text }),
  registroCategorias: z.object({ codigo: text, nombre: text, activo: z.boolean() }),
  registrosGenerales: z.object({ categoria_id: text, fecha: date, titulo: text, monto: money.nullable(), metadata: z.record(z.string(), z.unknown()) }),
  ventas: z.object({ cliente_id: text, fecha: date, estado: z.enum(["borrador", "confirmada"]), total: money.nonnegative() }),
  comprasMadera: z.object({ proveedor_id: text, fecha: date, especie_madera: text, cantidad: money.nonnegative(), precio_unitario: money.nonnegative(), total: money.nonnegative() }),
  cotizaciones: z.object({ cliente_id: text, fecha: date, precio_acordado: money.nonnegative(), estado: text }),
  cotizacionesUnificadas: z.object({ cliente_id: text, fecha: date, total: money.nonnegative(), estado_flujo: text, detalle: z.record(z.string(), z.unknown()) }),
  cortes: z.object({ cotizacion_id: text, tipo_pieza: text, espesor: money, ancho: money, largo: money, cantidad: money }),
  alquileres: z.object({ cliente_id: text, activo: text, fecha_inicio: date, tarifa: money.nonnegative(), estado: z.enum(["abierto", "cerrado"]) }),
  empleados: z.object({ nombre: text, rol: text, activo: z.boolean(), fecha_ingreso: date }),
  adelantos: z.object({ empleado_id: text, fecha: date, monto: money.nonnegative(), estado: text }),
  // Los sueldos históricos se conservan, incluso si requieren una corrección posterior.
  sueldos: z.object({ empleado_id: text, periodo: text, monto_bruto: money, descuentos: money, monto_neto: money }),
  inventarioProductos: z.object({ codigo: text, nombre: text, categoria: text, unidad: text, stock_actual: money, stock_minimo: money.nonnegative(), activo: z.boolean() }),
  inventarioMovimientos: z.object({ producto_id: text, fecha: date, tipo: z.enum(["entrada_compra", "salida_venta", "ajuste"]), cantidad: money }),
  alertas: z.object({ tipo: text, prioridad: text, estado: text, descripcion: text }),
  cierres: z.object({ anio: z.number().int(), mes: z.number().int().min(1).max(12), hash_sha256: text, reporte_json: z.record(z.string(), z.unknown()) }),
  securityControls: z.object({ title: text, completed: z.boolean(), owner: z.string() }),
  choferes: z.object({ nombre: text, activo: z.boolean() }),
  mueblesCatalogo: z.object({ codigo: text, nombre: text, precio_lista: money.nonnegative(), stock_disponible: money, activo: z.boolean() }),
  ventasMuebleTerminado: z.object({ cliente_id: text, mueble_catalogo_id: text, fecha: date, cantidad: money.positive(), total: money.nonnegative(), estado_entrega: text }),
  ordenesProduccion: z.object({ cliente_id: text, estado: text }),
  serviciosAserradero: z.object({ cliente_id: text, fecha: date, pies_cubicos: money, precio_cobrado: money.nonnegative(), lineas_json: z.array(z.record(z.string(), z.unknown())) }),
  serviciosEspecialesTarifa: z.object({ codigo: text, nombre: text, tarifa_por_pieza: money.nonnegative(), activo: z.boolean() }),
  zonasEntrega: z.object({ nombre: text, distancia_km: money.nonnegative(), tarifa: money.nonnegative(), activo: z.boolean() }),
};

/** Valida el contenido sin completarlo con datos de muestra ni modificarlo. */
export function validateBackupRow(table: string, row: Record<string, unknown>) {
  const schema = schemas[table];
  if (!schema || !schema.safeParse(row).success) throw new Error(`La tabla ${table} contiene datos incompletos o inválidos. No se restauró el archivo.`);
  for (const [key, value] of Object.entries(row)) {
    if (key.endsWith("_id") && value !== null && (typeof value !== "string" || !value.trim())) throw new Error(`La tabla ${table} contiene una referencia inválida.`);
  }
}

export function validateBackupReferences(snapshot: Record<string, unknown>) {
  const relations: [string,string,string][] = [
    ["registrosGenerales","categoria_id","registroCategorias"], ["adelantos","empleado_id","empleados"], ["sueldos","empleado_id","empleados"],
    ["inventarioMovimientos","producto_id","inventarioProductos"], ["cortes","cotizacion_id","cotizaciones"], ["comprasMadera","proveedor_id","proveedores"],
    ["ventas","cliente_id","clientes"], ["cotizaciones","cliente_id","clientes"], ["cotizacionesUnificadas","cliente_id","clientes"], ["alquileres","cliente_id","clientes"],
    ["ventasMuebleTerminado","cliente_id","clientes"], ["ventasMuebleTerminado","mueble_catalogo_id","mueblesCatalogo"], ["ordenesProduccion","cliente_id","clientes"],
    ["ordenesProduccion","cotizacion_id","cotizaciones"], ["ordenesProduccion","cotizacion_unificada_id","cotizacionesUnificadas"], ["serviciosAserradero","cliente_id","clientes"],
  ];
  for(const [table,field,parent] of relations) {
    const ids=new Set((snapshot[parent] as Record<string,unknown>[]).map(row=>row.id));
    if((snapshot[table] as Record<string,unknown>[]).some(row=>row[field]!=null && !ids.has(row[field]))) throw new Error(`El respaldo contiene referencias incompletas en ${table}. No se restauraron datos.`);
  }
}
