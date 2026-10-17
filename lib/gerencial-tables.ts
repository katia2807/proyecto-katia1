export const GERENCIAL_TABLES = ["movimientos_caja", "clientes", "ventas_madera", "ventas_madera_cortada", "ventas_mueble_terminado", "cotizaciones_unificadas", "alquileres", "servicios_aserradero", "ordenes_produccion", "inventario_productos", "inventario_movimientos"] as const;
export type GerencialTable = typeof GERENCIAL_TABLES[number];
export const GERENCIAL_LABELS: Record<GerencialTable, string> = {
  movimientos_caja: "Caja", clientes: "Clientes", ventas_madera: "Ventas de madera", ventas_madera_cortada: "Madera cortada", ventas_mueble_terminado: "Muebles terminados", cotizaciones_unificadas: "Cotizaciones", alquileres: "Alquileres", servicios_aserradero: "Aserradero", ordenes_produccion: "Producción", inventario_productos: "Productos", inventario_movimientos: "Movimientos de inventario",
};
