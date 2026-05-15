import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { updateClienteEstado } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/field";
import {
  getAlquilerRows,
  getClientesRows,
  getCobrosVencidos,
  getCotizacionesRows,
  getMueblesCatalogoRows,
  getServiciosAserraderoRows,
  getVentasMuebleTerminadoRows,
  getVentasRows,
} from "@/lib/data";
import { formatDate, formatPen } from "@/lib/utils";

type Params = Promise<{ id: string }>;

export default async function ClienteDetallePage({ params }: { params: Params }) {
  const { id } = await params;
  const [
    clientes,
    cotizaciones,
    ventasMuebles,
    ventasMadera,
    alquilerBundle,
    servicios,
    catalogo,
    cobrosVencidos,
  ] = await Promise.all([
    getClientesRows(),
    getCotizacionesRows(),
    getVentasMuebleTerminadoRows(),
    getVentasRows(),
    getAlquilerRows(),
    getServiciosAserraderoRows(),
    getMueblesCatalogoRows(),
    getCobrosVencidos(),
  ]);

  const cliente = clientes.find((c) => c.id === id);
  if (!cliente) notFound();

  const contratos = alquilerBundle.rows;

  const cotizCliente = cotizaciones.filter((c) => c.cliente_id === id);
  const vMuebles = ventasMuebles.filter((v) => v.cliente_id === id);
  const vMadera = ventasMadera.filter((v) => v.cliente_id === id);
  const cContratos = contratos.filter((c) => c.cliente_id === id);
  const sServicios = servicios.filter((s) => s.cliente_id === id);
  const muebleById = new Map(catalogo.map((m) => [m.id, m]));
  const cobrosCliente = cobrosVencidos.filter((c) => c.cliente_id === id);

  const totalFacturado =
    vMuebles.reduce((a, v) => a + Number(v.total), 0) +
    vMadera.reduce((a, v) => a + Number(v.total), 0) +
    cContratos.reduce((a, c) => a + Number(c.monto_total ?? c.tarifa), 0) +
    sServicios.reduce((a, s) => a + Number(s.precio_cobrado), 0);

  const totalOperaciones =
    cotizCliente.length + vMuebles.length + vMadera.length + cContratos.length + sServicios.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            {cliente.nombre}
            {cliente.estado ? (
              <Badge variant={cliente.estado === "activo" ? "success" : cliente.estado === "moroso" ? "danger" : "warning"}>{cliente.estado}</Badge>
            ) : null}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {cliente.tipo_persona === "empresa" ? "Empresa" : "Persona natural"} ·{" "}
            {cliente.documento ?? "Sin documento"} · {cliente.telefono ?? "Sin teléfono"}
          </p>
          {cliente.direccion ? (
            <p className="text-xs text-[var(--color-text-secondary)]">{cliente.direccion}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Link href="/ventas/clientes" className="text-sm font-semibold underline">
            ← Listado
          </Link>
        </div>
      </div>

      <Card>
        <CardTitle>Estado del cliente</CardTitle>
        <CardDescription>Cambia el estado manualmente si hay algún problema (ej. moroso, inactivo).</CardDescription>
        <form action={updateClienteEstado} className="mt-3 flex items-end gap-3 max-w-sm">
          <input type="hidden" name="id" value={cliente.id} />
          <SelectField name="estado" label="Estado" defaultValue={cliente.estado ?? "activo"} className="flex-1">
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="moroso">Moroso</option>
          </SelectField>
          <Button type="submit">Actualizar</Button>
        </form>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total facturado"
          value={formatPen(totalFacturado)}
          hint="Suma de todas las operaciones cerradas"
        />
        <MetricCard
          label="Operaciones"
          value={String(totalOperaciones)}
          hint="Cotizaciones + ventas + alquileres + servicios"
        />
        <MetricCard
          label="Cotizaciones"
          value={String(cotizCliente.length)}
          hint="Personalizadas y de corte"
        />
        <MetricCard
          label="Cobros vencidos"
          value={String(cobrosCliente.length)}
          hint={
            cobrosCliente.length > 0
              ? `Total ${formatPen(cobrosCliente.reduce((a, c) => a + c.monto, 0))}`
              : "Sin pendientes"
          }
        />
      </section>

      {cobrosCliente.length > 0 ? (
        <Card className="border-[var(--color-danger)] bg-red-50">
          <CardTitle className="text-[var(--color-danger)]">⚠ Cobros pendientes</CardTitle>
          <CardDescription>Contacta al cliente cuanto antes.</CardDescription>
          <ul className="mt-2 space-y-1 text-sm">
            {cobrosCliente.map((c) => (
              <li key={c.id} className="flex justify-between">
                <span>
                  {c.referencia} · vence {formatDate(c.fecha_vencimiento)}
                </span>
                <span className="font-semibold">{formatPen(c.monto)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Cotizaciones</CardTitle>
        <CardDescription>{cotizCliente.length} cotizaciones registradas.</CardDescription>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>N°</TH>
                <TH>Fecha</TH>
                <TH>Tipo</TH>
                <TH>Especie</TH>
                <TH>Estado</TH>
                <TH className="text-right">Acordado</TH>
              </TRow>
            </THead>
            <tbody>
              {cotizCliente.map((c) => (
                <TRow key={c.id}>
                  <TD className="font-mono text-xs">{c.correlativo ?? "—"}</TD>
                  <TD>{formatDate(c.fecha)}</TD>
                  <TD className="capitalize">{c.tipo.replace(/_/g, " ")}</TD>
                  <TD>{c.especie_madera}</TD>
                  <TD>
                    <Badge variant={c.estado === "confirmada" ? "success" : "neutral"}>
                      {c.estado}
                    </Badge>
                  </TD>
                  <TD className="text-right font-semibold">
                    {formatPen(Number(c.precio_acordado))}
                  </TD>
                </TRow>
              ))}
              {cotizCliente.length === 0 ? (
                <TRow>
                  <TD colSpan={6} className="text-center text-[var(--color-text-secondary)]">
                    Sin cotizaciones.
                  </TD>
                </TRow>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Ventas de muebles terminados</CardTitle>
        <CardDescription>{vMuebles.length} operaciones.</CardDescription>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Fecha</TH>
                <TH>Mueble</TH>
                <TH className="text-right">Cantidad</TH>
                <TH>Pago</TH>
                <TH>Entrega</TH>
                <TH className="text-right">Total</TH>
              </TRow>
            </THead>
            <tbody>
              {vMuebles.map((v) => (
                <TRow key={v.id}>
                  <TD>{formatDate(v.fecha)}</TD>
                  <TD>{muebleById.get(v.mueble_catalogo_id)?.nombre ?? "—"}</TD>
                  <TD className="text-right">{v.cantidad}</TD>
                  <TD className="capitalize">{v.modalidad_pago}</TD>
                  <TD className="capitalize">{v.estado_entrega.replace(/_/g, " ")}</TD>
                  <TD className="text-right font-semibold">{formatPen(Number(v.total))}</TD>
                </TRow>
              ))}
              {vMuebles.length === 0 ? (
                <TRow>
                  <TD colSpan={6} className="text-center text-[var(--color-text-secondary)]">
                    Sin compras de muebles.
                  </TD>
                </TRow>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Contratos de alquiler Mixer</CardTitle>
        <CardDescription>{cContratos.length} contratos.</CardDescription>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Código</TH>
                <TH>Inicio</TH>
                <TH>Estado</TH>
                <TH className="text-right">Tarifa</TH>
                <TH className="text-right">Monto total</TH>
              </TRow>
            </THead>
            <tbody>
              {cContratos.map((c) => (
                <TRow key={c.id}>
                  <TD className="font-mono text-xs">{c.codigo ?? c.id.slice(0, 8)}</TD>
                  <TD>{formatDate(c.fecha_inicio)}</TD>
                  <TD className="capitalize">{c.estado}</TD>
                  <TD className="text-right">{formatPen(Number(c.tarifa))}</TD>
                  <TD className="text-right font-semibold">
                    {formatPen(Number(c.monto_total ?? c.tarifa))}
                  </TD>
                </TRow>
              ))}
              {cContratos.length === 0 ? (
                <TRow>
                  <TD colSpan={5} className="text-center text-[var(--color-text-secondary)]">
                    Sin contratos.
                  </TD>
                </TRow>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Servicios de aserradero</CardTitle>
        <CardDescription>{sServicios.length} servicios.</CardDescription>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Fecha</TH>
                <TH className="text-right">Pies cúbicos</TH>
                <TH className="text-right">Costo</TH>
                <TH className="text-right">Cobrado</TH>
              </TRow>
            </THead>
            <tbody>
              {sServicios.map((s) => (
                <TRow key={s.id}>
                  <TD>{formatDate(s.fecha)}</TD>
                  <TD className="text-right">{Number(s.pies_cubicos).toFixed(2)}</TD>
                  <TD className="text-right">{formatPen(Number(s.costo_cubicaje))}</TD>
                  <TD className="text-right font-semibold">{formatPen(Number(s.precio_cobrado))}</TD>
                </TRow>
              ))}
              {sServicios.length === 0 ? (
                <TRow>
                  <TD colSpan={4} className="text-center text-[var(--color-text-secondary)]">
                    Sin servicios.
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
