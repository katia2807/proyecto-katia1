import { Card, CardTitle } from "@/components/ui/card";
import { getInventarioResumenValores, type InventarioProductoResumen, type InventarioMovimientoResumen } from "@/lib/inventario-resumen";
import { formatPen } from "@/lib/utils";

const cantidadFormatter = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });

export function InventarioResumenValores({ productos, movimientos }: {
  productos: InventarioProductoResumen[];
  movimientos: InventarioMovimientoResumen[];
}) {
  const resumen = getInventarioResumenValores(productos, movimientos);
  return (
    <>
      <Card>
        <CardTitle>Stock por unidad</CardTitle>
        {resumen.stockPorUnidad.length > 0 ? (
          <dl className="mt-3 space-y-1.5">
            {resumen.stockPorUnidad.map(({ unidad, cantidad }) => (
              <div key={unidad} className="flex min-w-0 items-baseline justify-between gap-3">
                <dt className="min-w-0 break-words text-sm text-[var(--color-text-secondary)]">{unidad}</dt>
                <dd className="shrink-0 text-xl font-black tabular-nums">{cantidadFormatter.format(cantidad)}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="mt-3 text-sm">Sin productos activos.</p>}
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Productos activos, separados por su unidad de medida.</p>
      </Card>
      <Card>
        <CardTitle>Valor registrado del stock</CardTitle>
        <p className={`mt-3 font-black ${resumen.valorRegistrado === null ? "text-lg" : "text-3xl"}`}>
          {resumen.valorRegistrado === null ? "Sin costo en compras" : formatPen(resumen.valorRegistrado)}
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Stock × costo promedio de compras registradas.</p>
        {resumen.productosSinCosto > 0 ? (
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            {resumen.valorRegistrado !== null ? "Valor parcial: " : ""}
            {resumen.productosSinCosto} {resumen.productosSinCosto === 1 ? "producto con stock sin costo en compras." : "productos con stock sin costo en compras."}
          </p>
        ) : null}
      </Card>
      <Card>
        <CardTitle>Costo de salidas del mes</CardTitle>
        <p className={`mt-3 font-black ${resumen.costoSalidas === null ? "text-lg" : "text-3xl"}`}>
          {resumen.costoSalidas === null ? "Sin costo registrado" : formatPen(resumen.costoSalidas)}
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          {resumen.totalSalidas === 0 ? "No hay salidas de venta este mes." : "Costos de las salidas de venta cargadas de este mes. No es ganancia."}
        </p>
        {resumen.salidasSinCosto > 0 ? (
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            {resumen.costoSalidas !== null ? "Costo parcial: " : ""}
            {resumen.salidasSinCosto} {resumen.salidasSinCosto === 1 ? "salida sin costo registrado." : "salidas sin costo registrado."}
          </p>
        ) : null}
      </Card>
    </>
  );
}
