import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Printer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireAuthContext } from "@/lib/auth";
import { canMutateVentas } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";
import { getVentaDetalle, isVentaDetalleTipo } from "@/lib/venta-detalle";
import { safeHistorialHref, withHistorialReturn } from "@/lib/ventas-historial-navigation";

type PageProps = {
  params: Promise<{ tipo: string; id: string }>;
  searchParams?: Promise<{ volver?: string | string[] }>;
};

export default async function VentaDetallePage({ params, searchParams }: PageProps) {
  const { tipo, id } = await params;
  if (!isVentaDetalleTipo(tipo)) notFound();
  const context = await requireAuthContext();
  const detalle = await getVentaDetalle(tipo, id, context.organizationId);
  if (!detalle) notFound();
  const historialHref = safeHistorialHref((await searchParams)?.volver);
  const completarHref = canMutateVentas(context.role, context.uiRole) && detalle.completarHref
    ? withHistorialReturn(detalle.completarHref, historialHref) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={historialHref} scroll={false} className="inline-flex items-center gap-2 text-sm font-medium text-[var(--katia-text-secondary)] hover:text-[var(--katia-primary)]">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver al historial
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--katia-text-primary)]">Detalle de la operación</h2>
          {detalle.referencia ? <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">{detalle.referencia}</p> : null}
        </div>
        <Link href={detalle.impresionHref} prefetch={false} className="inline-flex items-center gap-2 rounded-xl border border-[var(--katia-border-default)] px-4 py-2.5 text-sm font-semibold text-[var(--katia-text-primary)] hover:bg-[var(--color-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--katia-primary)]">
          <Printer className="size-4" aria-hidden="true" />
          {detalle.impresionLabel}
        </Link>
      </div>
      <Card className="space-y-6 !p-6 sm:!p-8">
        <dl className="grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-[var(--katia-text-secondary)]">Cliente</dt>
            <dd className="mt-1 text-lg font-semibold text-[var(--katia-text-primary)]">{detalle.clienteNombre}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--katia-text-secondary)]">Fecha</dt>
            <dd className="mt-1 text-lg font-semibold text-[var(--katia-text-primary)]">{detalle.fecha ? formatDate(detalle.fecha) : "Fecha por definir"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-[var(--katia-text-secondary)]">Operación</dt>
            <dd className="mt-1 text-lg font-semibold text-[var(--katia-text-primary)]">{detalle.operacion}</dd>
          </div>
          {detalle.estado ? (
            <div>
              <dt className="text-sm text-[var(--katia-text-secondary)]">Estado</dt>
              <dd className="mt-1 font-semibold text-[var(--katia-text-primary)]">{detalle.estado}</dd>
            </div>
          ) : null}
          {detalle.descripcion ? (
            <div className="sm:col-span-2">
              <dt className="text-sm text-[var(--katia-text-secondary)]">Descripción</dt>
              <dd className="mt-1 whitespace-pre-line text-[var(--katia-text-primary)]">{detalle.descripcion}</dd>
            </div>
          ) : null}
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--katia-border-default)] pt-6">
          <div>
            <p className="text-sm text-[var(--katia-text-secondary)]">Total de la operación</p>
            <p className="mt-1 text-2xl font-bold text-[var(--katia-text-primary)]">{detalle.total == null ? "Total por definir" : formatPen(detalle.total)}</p>
          </div>
          {completarHref ? (
            <Link href={completarHref} prefetch={false} className="inline-flex items-center gap-2 rounded-xl bg-[var(--katia-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--katia-primary)] focus-visible:ring-offset-2">
              Completar datos <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
