import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  getClientesRows,
  getMueblesCatalogoRows,
} from "@/lib/data";
import { formatDate, formatPen } from "@/lib/utils";
import { getClienteHistorial, resumenClientes, cobrosClientes } from "@/lib/clientes-data";
import { documentoCliente, etiquetaEstadoCliente, etiquetaTipoCliente, importeCliente, safeClientesReturn } from "@/lib/clientes-model";
import { etiquetaEstadoCotizacion } from "@/lib/cotizacion-estados";

type Params = Promise<{ id: string }>;

export default async function ClienteDetallePage({ params, searchParams }: { params: Params; searchParams?: Promise<{ volver?: string | string[] }> }) {
  const { id } = await params;
  const volver = safeClientesReturn((await searchParams)?.volver);
  const [clientes, historial, catalogo] = await Promise.all([
    getClientesRows(),
    getClienteHistorial(id),
    getMueblesCatalogoRows(),
  ]);

  const cliente = clientes.find((c) => c.id === id);
  if (!cliente) notFound();

  const { cotizaciones: cotizCliente, ventasMuebles: vMuebles, ventasMadera: vMadera, contratos: cContratos, servicios: sServicios } = historial;
  const muebleById = new Map(catalogo.map((m) => [m.id, m]));
  const cobrosCliente = cobrosClientes(historial);
  const resumen = resumenClientes(historial).get(id);
  const totalFacturado = resumen?.total ?? 0;
  const totalOperaciones = resumen?.operaciones ?? 0;
  const importeTexto = (monto: unknown) => { const valor = importeCliente(monto); return valor === null ? "Por definir" : formatPen(valor); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            {cliente.nombre}
            {cliente.estado ? (
              <Badge variant={cliente.estado === "activo" ? "success" : cliente.estado === "moroso" ? "danger" : "warning"}>{etiquetaEstadoCliente(cliente.estado)}</Badge>
            ) : null}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {etiquetaTipoCliente(cliente.tipo_persona)} ·{" "}
            {documentoCliente(cliente)} · {cliente.telefono?.trim() || "Sin teléfono"}
          </p>
          {cliente.direccion ? (
            <p className="text-xs text-[var(--color-text-secondary)]">{cliente.direccion}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={volver} className="text-sm font-semibold underline">
            ← Listado
          </Link>
          <Link href={`/gerencial?tab=clientes360&cliente=${cliente.id}`}>
            <Button variant="secondary">Gestionar en Panel Gerencial</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardTitle>Ficha de cliente</CardTitle>
        <CardDescription>Visualización de datos e historial. El estado y la eliminación se gestionan desde el Panel Gerencial.</CardDescription>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Registrado desde</p>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">{formatDate(cliente.created_at)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Tipo</p>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">{etiquetaTipoCliente(cliente.tipo_persona)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Documento</p>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">{documentoCliente(cliente)}</p>
          </div>
          {cliente.documento?.trim() && cliente.ruc?.trim() && cliente.ruc.trim() !== cliente.documento.trim() ? <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">RUC</p>
            <p className="mt-1 text-sm">{cliente.ruc}</p>
          </div> : null}
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Teléfono</p>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">{cliente.telefono ?? "Sin teléfono"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Dirección</p>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">{cliente.direccion ?? "Sin dirección"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Estado</p>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">{etiquetaEstadoCliente(cliente.estado)}</p>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total registrado"
          value={formatPen(totalFacturado)}
          hint={resumen?.importesPorDefinir ? `${resumen.importesPorDefinir} importe(s) por definir, no incluidos en el total` : "Ventas confirmadas, alquileres cerrados, servicios y cotizaciones cobradas"}
        />
        <MetricCard
          label="Operaciones"
          value={String(totalOperaciones)}
          hint="Cotizaciones + ventas + alquileres + servicios"
        />
        <MetricCard
          label="Cotizaciones"
          value={String(cotizCliente.length)}
          hint="Actuales y anteriores"
        />
        <MetricCard
          label="Cobros vencidos"
          value={String(cobrosCliente.length)}
          hint={
            cobrosCliente.length > 0
              ? `${cobrosCliente.some(c => c.monto === null) ? "Importe conocido" : "Total"} ${formatPen(cobrosCliente.reduce((a, c) => a + (c.monto ?? 0), 0))}`
              : "Sin cobros vencidos"
          }
        />
      </section>

      {cobrosCliente.length > 0 ? (
        <Card className="border-[var(--color-danger)] bg-[var(--color-surface)]">
          <CardTitle className="text-[var(--color-danger)]">⚠ Cobros pendientes</CardTitle>
          <CardDescription>Contacta al cliente cuanto antes.</CardDescription>
          <ul className="mt-2 space-y-1 text-sm">
            {cobrosCliente.map((c) => (
              <li key={c.id} className="flex justify-between">
                <span>
                  {c.referencia} · vence {formatDate(c.fecha_vencimiento)}
                </span>
                <span className="font-semibold">{importeTexto(c.monto)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Cotizaciones</CardTitle>
        <CardDescription>{cotizCliente.length} cotizaciones registradas.</CardDescription>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-border)]" tabIndex={0} role="region" aria-label="Cotizaciones del cliente">
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
                  <TD className="font-mono text-xs"><Link className="underline" href={c.href}>{c.correlativo ?? c.id.slice(0, 8)}</Link></TD>
                  <TD>{formatDate(c.fecha)}</TD>
                  <TD className="capitalize">{c.tipo.replace(/_/g, " ")}</TD>
                  <TD>{c.especie_madera}</TD>
                  <TD>
                    <Badge variant={c.estado === "confirmada" ? "success" : "neutral"}>
                      {c.actual ? etiquetaEstadoCotizacion(c.estado) : c.estado === "confirmada" ? "Confirmada" : "Borrador"}
                    </Badge>
                  </TD>
                  <TD className="text-right font-semibold">
                    {importeTexto(c.monto)}
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
        <CardTitle>Ventas de madera</CardTitle>
        <CardDescription>{vMadera.length} operaciones.</CardDescription>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-border)]" tabIndex={0} role="region" aria-label="Ventas de madera del cliente">
          <Table><THead><TRow><TH>N°</TH><TH>Fecha</TH><TH>Tipo</TH><TH>Estado</TH><TH className="text-right">Total</TH></TRow></THead>
            <tbody>{vMadera.map(v => <TRow key={`${v.comprobanteTipo}-${v.id}`}>
              <TD><Link className="underline" href={`/ventas/detalle/${v.comprobanteTipo}/${v.id}`}>{v.correlativo ?? v.id.slice(0, 8)}</Link></TD>
              <TD>{formatDate(v.fecha)}</TD><TD>{v.comprobanteTipo === "madera" ? "Madera cortada" : "Madera"}</TD>
              <TD>{v.estado === "confirmada" ? "Confirmada" : "Borrador"}</TD><TD className="text-right">{importeTexto(v.total)}</TD>
            </TRow>)}{vMadera.length === 0 ? <TRow><TD colSpan={5} className="text-center">Sin ventas de madera.</TD></TRow> : null}</tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Ventas de muebles terminados</CardTitle>
        <CardDescription>{vMuebles.length} operaciones.</CardDescription>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-border)]" tabIndex={0} role="region" aria-label="Ventas de muebles del cliente">
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
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-border)]" tabIndex={0} role="region" aria-label="Alquileres del cliente">
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
                    {importeTexto(c.monto_total)}
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
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-border)]" tabIndex={0} role="region" aria-label="Servicios del cliente">
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
