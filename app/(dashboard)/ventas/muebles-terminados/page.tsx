import Image from "next/image";
import Link from "next/link";
import { IconPhoto } from "@tabler/icons-react";
import { cancelarVentaMueble, marcarEntregaMueble } from "@/app/actions";
import { CancelarVentaButton } from "@/components/ventas/cancelar-venta-button";
import { MueblesTerminadosContextPanels } from "@/components/ventas/muebles-terminados-context-panels";
import { Badge } from "@/components/ui/badge";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getCurrentUserRole } from "@/lib/current-user-role";
import {
  getChoferesRows,
  getClientesRows,
  getMueblesCatalogoRows,
  getVentasMuebleTerminadoRows,
  getZonasEntregaRows,
} from "@/lib/data";
import { canMutateVentas } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";

export default async function MueblesTerminadosPage() {
  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";
  const [muebles, clientes, choferes, ventas, zonas] = await Promise.all([
    getMueblesCatalogoRows(),
    getClientesRows(),
    getChoferesRows(),
    getVentasMuebleTerminadoRows(),
    getZonasEntregaRows(),
  ]);
  const role = await getCurrentUserRole();
  const canMutate = canMutateVentas(role);
  const clientesById = new Map(clientes.map((c) => [c.id, c.nombre]));
  const clientesMap = new Map(clientes.map((c) => [c.id, c]));
  const choferesById = new Map(choferes.map((c) => [c.id, c.nombre]));
  const muebleHelpers = new Map(muebles.map((m) => [m.id, m]));

  const hoy = new Date().toISOString().slice(0, 10);
  const mueblesDisponibles = muebles.filter((m) => m.stock_disponible > 0).length;
  const stockBajo = muebles.filter((m) => m.stock_disponible > 0 && m.stock_disponible <= 2).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Muebles terminados</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Registra ventas de muebles listos, revisa el historial del módulo y usa el catálogo como apoyo. Los productos se administran en{" "}
          <Link href="/inventario?tab=muebles" className="font-semibold text-[var(--color-accent)] underline underline-offset-2">
            Inventario
          </Link>
          .
        </p>
      </div>

      <Card id="vender-mueble" className="scroll-mt-24 border-2 border-[var(--katia-primary)] bg-[var(--katia-primary)]/5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center rounded-full bg-[var(--katia-primary)] px-2.5 py-1 text-xs font-bold text-white">
              Acción principal
            </div>
            <CardTitle className="mt-3 text-xl">Vender mueble</CardTitle>
            <CardDescription className="mt-2">Registra una venta desde el catálogo de muebles terminados.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {canMutate ? (
              <MueblesTerminadosContextPanels
                clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre, ruc: c.ruc || null, documento: c.documento || null }))}
                muebles={muebles.map((m) => ({
                  id: m.id,
                  codigo: m.codigo,
                  nombre: m.nombre,
                  precio_lista: m.precio_lista,
                  stock_disponible: m.stock_disponible,
                }))}
                choferes={choferes.map((c) => ({
                  id: c.id,
                  nombre: c.nombre,
                  telefono: c.telefono,
                  placa: c.placa,
                }))}
                zonas={zonas.map((z) => ({
                  id: z.id,
                  nombre: z.nombre,
                  tarifa: z.tarifa,
                  distancia_km: z.distancia_km,
                }))}
                fechaDefault={hoy}
                mockData={comboMock}
              />
            ) : (
              <p className="rounded-xl border border-amber-500/20 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-300">
                Tu rol es de solo lectura.
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card className="border border-[var(--color-border)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Catálogo disponible</CardTitle>
            <CardDescription>
              Muebles listos para vender. {muebles.length} productos registrados.
            </CardDescription>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {muebles.map((mueble) => (
            <article
              key={mueble.id}
              className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {mueble.foto_url ? (
                <Image
                  src={mueble.foto_url}
                  alt={mueble.nombre}
                  width={360}
                  height={200}
                  className="h-32 w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-32 items-center justify-center bg-[var(--color-primary-soft)]/45">
                  <div className="flex flex-col items-center gap-1 text-[var(--color-text-secondary)]">
                    <IconPhoto className="size-7 opacity-40" aria-hidden />
                    <span className="text-xs">Sin imagen</span>
                  </div>
                </div>
              )}

              <div className="space-y-3 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {mueble.codigo ? (
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                        {mueble.codigo}
                      </p>
                    ) : null}
                    <h3 className="line-clamp-2 text-sm font-bold text-[var(--color-text-primary)]">
                      {mueble.nombre}
                    </h3>
                  </div>
                  <Badge variant={mueble.stock_disponible > 0 ? "success" : "danger"}>
                    Stock: {mueble.stock_disponible}
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                  <p className="text-lg font-black text-[var(--color-text-primary)]">
                    {formatPen(mueble.precio_lista)}
                  </p>
                  {canMutate && mueble.stock_disponible > 0 ? (
                    <Link
                      href="#vender-mueble"
                      className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] px-3 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
                    >
                      Vender mueble
                    </Link>
                  ) : (
                    <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text-secondary)]">
                      {canMutate ? "Sin stock" : "Solo lectura"}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
          {muebles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-text-secondary)] sm:col-span-2 xl:col-span-3">
              No hay muebles terminados registrados en el catálogo.
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardTitle>Ventas registradas</CardTitle>
        <CardDescription>
          {ventas.length} ventas registradas de muebles terminados. Marca el estado de entrega cuando corresponda.
        </CardDescription>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Fecha</TH>
                <TH>Cliente</TH>
                <TH>Mueble</TH>
                <TH className="text-right">Cant.</TH>
                <TH className="text-right">Total</TH>
                <TH>Pago</TH>
                <TH>Entrega</TH>
                <TH className="text-right">Acciones</TH>
              </TRow>
            </THead>
            <tbody>
               {ventas.map((venta) => {
                const mueble = muebleHelpers.get(venta.mueble_catalogo_id);
                const chofer = venta.chofer_id ? choferesById.get(venta.chofer_id) : null;
                const cli = clientesMap.get(venta.cliente_id);
                const hasRuc = !!(cli?.ruc && cli.ruc.trim().length === 11);
                const printUrl = `/ventas/comprobante/mueble/${venta.id}${hasRuc ? "?tipoComprobante=factura" : "?tipoComprobante=boleta"}`;
                return (
                  <TRow key={venta.id}>
                    <TD>{formatDate(venta.fecha)}</TD>
                    <TD>{clientesById.get(venta.cliente_id) ?? "-"}</TD>
                    <TD>{mueble?.nombre ?? "-"}</TD>
                    <TD className="text-right">{venta.cantidad}</TD>
                    <TD className="text-right font-semibold">{formatPen(Number(venta.total))}</TD>
                    <TD>
                      <span className="capitalize">{venta.modalidad_pago}</span>
                      <p className="text-xs text-[var(--color-text-secondary)] capitalize">
                        {venta.metodo_pago.replace(/_/g, " ")}
                      </p>
                    </TD>
                    <TD>
                      <Badge
                        variant={
                          venta.estado_entrega === "entregado"
                            ? "success"
                            : venta.estado_entrega === "en_proceso"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {venta.estado_entrega.replace(/_/g, " ")}
                      </Badge>
                      {chofer ? (
                        <p className="text-xs text-[var(--color-text-secondary)]">{chofer}</p>
                      ) : null}
                    </TD>
                    <TD className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={printUrl}
                          target="_blank"
                          className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
                          title="Imprimir comprobante"
                        >
                          Imprimir
                        </Link>
                        {canMutate && venta.estado_entrega !== "entregado" ? (
                          <form action={marcarEntregaMueble} className="inline-flex">
                            <input type="hidden" name="id" value={venta.id} />
                            <input
                              type="hidden"
                              name="nuevo_estado"
                              value={
                                venta.estado_entrega === "pendiente" ? "en_proceso" : "entregado"
                              }
                            />
                            <PendingSubmitButton
                              variant="secondary"
                              className="h-8 px-3 text-xs"
                              idleText={
                                venta.estado_entrega === "pendiente"
                                  ? "Marcar en proceso"
                                  : "Marcar entregado"
                              }
                            />
                          </form>
                        ) : null}
                        {canMutate && venta.estado_entrega !== "pendiente" ? (
                          <form action={marcarEntregaMueble} className="inline-flex">
                            <input type="hidden" name="id" value={venta.id} />
                            <input type="hidden" name="nuevo_estado" value="pendiente" />
                            <PendingSubmitButton
                              variant="secondary"
                              className="h-8 px-3 text-xs"
                              idleText="Retroceder"
                            />
                          </form>
                        ) : null}
                        {canMutate ? (
                          <CancelarVentaButton ventaId={venta.id} />
                        ) : null}
                      </div>
                    </TD>
                  </TRow>
                );
              })}
              {ventas.length === 0 ? (
                <TRow>
                  <TD colSpan={8} className="text-center text-[var(--color-text-secondary)]">
                    Aún no hay ventas. Usa "Vender mueble" para registrar una.
                  </TD>
                </TRow>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card className="py-4">
        <CardTitle className="text-base">Resumen del módulo</CardTitle>
        <CardDescription>Información secundaria para seguimiento rápido.</CardDescription>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border)] px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Muebles disponibles</p>
            <p className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">{mueblesDisponibles}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Ventas registradas</p>
            <p className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">{ventas.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Stock bajo</p>
            <p className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">{stockBajo}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
