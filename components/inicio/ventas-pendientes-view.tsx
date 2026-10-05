import Link from "next/link";
import { FiltroActivo } from "@/components/inicio/filtro-activo";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getClientesRows } from "@/lib/data";
import { getVentasBorradorRows } from "@/lib/inicio-pendientes";
import { formatDate, formatPen } from "@/lib/utils";

export async function VentasPendientesView() {
  const [ventas, clientes] = await Promise.all([getVentasBorradorRows(), getClientesRows()]);
  const clientesById = new Map(clientes.map((row) => [row.id, row.nombre]));
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">Ventas</h2>
      <FiltroActivo label="Ventas sin confirmar" total={ventas.length} clearHref="/ventas" clearLabel="Ver todas las ventas" />
      <Card>
        <CardTitle>Ventas sin confirmar</CardTitle>
        <CardDescription>Ventas de madera que siguen en borrador, incluidas las más antiguas.</CardDescription>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead><TRow><TH>Fecha</TH><TH>Cliente</TH><TH>Estado</TH><TH className="text-right">Total</TH><TH>Detalle</TH></TRow></THead>
            <tbody>
              {ventas.map((row) => (
                <TRow key={row.id}>
                  <TD>{formatDate(row.fecha)}</TD>
                  <TD>{clientesById.get(row.cliente_id) ?? "—"}</TD>
                  <TD><Badge variant="warning">Sin confirmar</Badge></TD>
                  <TD className="text-right font-semibold">{formatPen(Number(row.total))}</TD>
                  <TD><Link href={`/ventas/detalle/venta-madera/${row.id}`} className="text-[var(--katia-primary)] hover:underline">Ver detalle</Link></TD>
                </TRow>
              ))}
              {ventas.length === 0 ? <TRow><TD colSpan={5} className="py-6 text-center text-[var(--katia-text-secondary)]">No hay ventas sin confirmar.</TD></TRow> : null}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
