const categorias: Record<string, string> = {
  venta_madera: "Venta de madera",
  venta_madera_cortada: "Venta de madera cortada",
  compra_madera: "Compra de madera",
  compra_inventario: "Compra de inventario",
  compra_insumos: "Compra de insumos",
  adelanto_personal: "Adelanto al personal",
  servicios_basicos: "Servicios básicos",
  personal: "Personal",
  venta_mueble_terminado: "Venta de mueble terminado",
  adelanto_mueble_personalizado: "Adelanto de mueble personalizado",
  servicio_corte_mueble: "Servicio de corte de mueble",
  servicio_aserradero: "Servicio de aserradero",
  alquiler_bomba_mixer: "Alquiler de bomba o mixer",
  penalidad_alquiler: "Penalidad de alquiler",
  cotizaciones: "Cobro de cotización",
  ventas_pdf: "Venta con comprobante",
};

const origenes: Record<string, string> = {
  caja: "Registro manual de Caja",
  ventas_madera: "Ventas de madera",
  ventas_pdf: "Ventas con comprobante",
  ventas_madera_cortada: "Ventas de madera cortada",
  ventas_muebles_terminados: "Ventas de muebles terminados",
  ventas_aserradero: "Servicios de aserradero",
  aserradero: "Servicios de aserradero",
  ventas_alquiler: "Alquileres",
  alquiler: "Alquileres",
  cotizacion_unificada: "Cotizaciones",
  ventas: "Muebles personalizados",
  muebles_corte: "Corte de muebles",
  compras_madera: "Compras de madera",
  inventario: "Inventario",
  personal: "Equipo y personal",
};

const tipos: Record<string, string> = { ingreso: "Ingreso", egreso: "Gasto", transferencia: "Transferencia" };
const medios: Record<string, string> = { efectivo: "Efectivo", banco: "Banco", yape: "Yape", otro: "Otro" };

// Las categorías escritas por el usuario se conservan tal como fueron registradas.
const nombre = (labels: Record<string, string>, value: string) => Object.hasOwn(labels, value) ? labels[value] : value;
export const cajaCategoriaLabel = (value: string) => nombre(categorias, value);
export const cajaOrigenLabel = (value: string | null) => value ? nombre(origenes, value) : origenes.caja;
export const cajaTipoLabel = (value: string) => nombre(tipos, value);
export const cajaMedioLabel = (value: string) => nombre(medios, value);
