import Link from "next/link";
import { MaderaCortadaPanel } from "@/components/sales/madera-cortada-panel";
import { VentaMaderaPanel } from "@/components/sales/venta-madera-panel";
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
  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";
  const [clientes, choferes, productos, ventas, zonas] = await Promise.all([
    getClientesRows(),
    getChoferesRows(),
    getInventarioProductosRows(),
    getZonasEntregaRows().catch(() => []),
    getVentasRows(),
  ]);
  const role = await getCurrentUserRole();
  const canMutate = canMutateVentas(role);
  const clientesById = new Map(clientes.map((c) => [c.id, c.nombre]));
  const clientesMap = new Map(clientes.map((c) => [c.id, c]));

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
          <CardTitle>Operaciones</CardTitle>
          <CardDescription>Venta de madera (flujo clásico) o venta de madera cortada.</CardDescription>
        </div>
        {canMutate ? (
          <div className="flex flex-wrap gap-2">
            <VentaMaderaPanel
              clientes={clientes}
              productos={productosMadera}
              mockData={comboMock}
            />
            <MaderaCortadaPanel
              clientes={clientes}
              choferes={choferes}
              productos={productosMadera}
              zonas={zonas}
              mockData={comboMock}
            />
          </div>
        ) : (
          <p className="rounded-xl border border-amber-500/20 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-300">
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
                <TH />
              </TRow>
            </THead>
            <tbody>
              {ventas.slice(0, 20).map((venta) => (
                <TRow key={venta.id}>
                  <TD>{formatDate(venta.fecha)}</TD>
                  <TD>{clientesById.get(venta.cliente_id) ?? "—"}</TD>
                  <TD className="capitalize">{venta.estado}</TD>
                  <TD className="text-right font-semibold">{formatPen(Number(venta.total))}</TD>
                  <TD>
                    {(() => {
                      const cli = clientesMap.get(venta.cliente_id);
                      const hasRuc = !!(cli?.ruc && cli.ruc.trim().length === 11);
                      const printUrl = (venta.correlativo !== null
                        ? `/ventas/comprobante/venta-madera/${venta.id}`
                        : `/ventas/comprobante/madera/${venta.id}`) + `?tipoComprobante=${hasRuc ? "factura" : "boleta"}`;
                      return (
                        <Link
                          href={printUrl}
                          target="_blank"
                          className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
                          title="Imprimir comprobante"
                        >
                          🖨️
                        </Link>
                      );
                    })()}
                  </TD>
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
