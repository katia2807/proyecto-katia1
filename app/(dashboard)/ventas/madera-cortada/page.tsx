import { ContextActionPanel } from "@/components/context-action-panel";
import { MaderaCortadaForm } from "@/components/sales/madera-cortada-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getCurrentUserRole } from "@/lib/current-user-role";
import {
  getChoferesRows,
  getClientesRows,
  getInventarioProductosRows,
  getVentasRows,
  getZonasEntregaRows,
} from "@/lib/data";
import { canMutateVentas } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";

export default async function MaderaCortadaPage() {
  const [clientes, choferes, productos, ventas, zonas] = await Promise.all([
    getClientesRows(),
    getChoferesRows(),
    getInventarioProductosRows(),
    getVentasRows(),
    getZonasEntregaRows(),
  ]);
  const role = await getCurrentUserRole();
  const canMutate = canMutateVentas(role);
  const clientesById = new Map(clientes.map((c) => [c.id, c.nombre]));

  const productosMadera = productos.filter((p) =>
    p.categoria.toLowerCase().includes("madera"),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Madera cortada</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Venta por pie tablar con calculadora en vivo. Si seleccionas un producto del inventario, se descuenta automáticamente.
        </p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Acciones rápidas</CardTitle>
          <CardDescription>
            Registrar una venta de madera cortada con cubicaje y entrega.
          </CardDescription>
        </div>
        {canMutate ? (
          <ContextActionPanel
            triggerLabel="Vender madera cortada"
            title="Nueva venta de madera cortada"
            description="Cliente, tipo de corte, calculadora PT, entrega y pago."
          >
            <MaderaCortadaForm
              clientes={clientes}
              choferes={choferes}
              productos={productosMadera}
              zonas={zonas}
            />
          </ContextActionPanel>
        ) : (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Tu rol es de solo lectura.
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Stock disponible de madera</CardTitle>
        <CardDescription>
          {productosMadera.length} productos categorizados como madera.
        </CardDescription>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {productosMadera.map((p) => {
            const stock = Number(p.stock_actual);
            const variant = stock <= 0 ? "danger" : stock <= Number(p.stock_minimo) ? "warning" : "success";
            return (
              <Card key={p.id} className="space-y-1">
                <p className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
                  {p.codigo}
                </p>
                <p className="text-sm font-semibold">{p.nombre}</p>
                <Badge variant={variant}>
                  {stock} {p.unidad}
                </Badge>
              </Card>
            );
          })}
          {productosMadera.length === 0 ? (
            <Card className="md:col-span-2 xl:col-span-3 text-center text-sm text-[var(--color-text-secondary)]">
              Aún no hay productos de madera en inventario.
            </Card>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardTitle>Ventas registradas</CardTitle>
        <CardDescription>
          {ventas.length} ventas en el módulo (incluyendo otros canales).
        </CardDescription>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Fecha</TH>
                <TH>Cliente</TH>
                <TH>Estado</TH>
                <TH className="text-right">Total</TH>
              </TRow>
            </THead>
            <tbody>
              {ventas.slice(0, 20).map((venta) => (
                <TRow key={venta.id}>
                  <TD>{formatDate(venta.fecha)}</TD>
                  <TD>{clientesById.get(venta.cliente_id) ?? "—"}</TD>
                  <TD className="capitalize">{venta.estado}</TD>
                  <TD className="text-right font-semibold">{formatPen(Number(venta.total))}</TD>
                </TRow>
              ))}
              {ventas.length === 0 ? (
                <TRow>
                  <TD colSpan={4} className="text-center text-[var(--color-text-secondary)]">
                    Aún no hay ventas registradas.
                  </TD>
                </TRow>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
