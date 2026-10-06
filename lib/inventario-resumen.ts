import { roundMoney } from "@/lib/utils";

export type InventarioProductoResumen = {
  activo?: boolean;
  unidad: string | null;
  stock_actual: number;
  costo_unitario_promedio: number;
  valor_stock: number;
};

export type InventarioMovimientoResumen = {
  fecha: string;
  tipo: string;
  cantidad: number;
  costo_unitario: number | null;
};

/** Presenta lo registrado sin convertir unidades, inferir costos ni calcular ganancias. */
export function getInventarioResumenValores(
  productos: InventarioProductoResumen[],
  movimientos: InventarioMovimientoResumen[],
  ahora = new Date(),
) {
  const stock = new Map<string, number>();
  let valorRegistrado = 0;
  let productosSinCosto = 0;
  let productosConCosto = 0;
  for (const producto of productos) {
    if (producto.activo === false) continue;
    const unidad = producto.unidad?.trim().toLowerCase() || "Sin unidad";
    stock.set(unidad, (stock.get(unidad) ?? 0) + producto.stock_actual);
    if (producto.stock_actual === 0) continue;
    if (Number.isFinite(producto.costo_unitario_promedio) && producto.costo_unitario_promedio > 0) {
      valorRegistrado += producto.valor_stock;
      productosConCosto++;
    } else {
      productosSinCosto++;
    }
  }

  const partes = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima", year: "numeric", month: "2-digit",
  }).formatToParts(ahora);
  const mes = `${partes.find(p => p.type === "year")!.value}-${partes.find(p => p.type === "month")!.value.padStart(2, "0")}`;
  let costoSalidas = 0;
  let salidasConCosto = 0;
  let salidasSinCosto = 0;
  for (const movimiento of movimientos) {
    if (movimiento.tipo !== "salida_venta" || !movimiento.fecha.startsWith(`${mes}-`)) continue;
    if (movimiento.costo_unitario !== null && Number.isFinite(movimiento.costo_unitario) && movimiento.costo_unitario >= 0) {
      costoSalidas += movimiento.cantidad * movimiento.costo_unitario;
      salidasConCosto++;
    } else {
      salidasSinCosto++;
    }
  }

  return {
    stockPorUnidad: [...stock].sort(([a], [b]) => a.localeCompare(b, "es")).map(([unidad, cantidad]) => ({ unidad, cantidad })),
    valorRegistrado: productosConCosto === 0 && productosSinCosto > 0 ? null : roundMoney(valorRegistrado),
    productosSinCosto,
    costoSalidas: salidasConCosto === 0 && salidasSinCosto > 0 ? null : roundMoney(costoSalidas),
    salidasSinCosto,
    totalSalidas: salidasConCosto + salidasSinCosto,
  };
}
