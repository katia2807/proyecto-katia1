"use client";

import { useState } from "react";
import Link from "next/link";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPen } from "@/lib/utils";
import { ClipboardCheck, Trash2, Edit2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteVentaMaderaCortada } from "@/app/actions";
import { useRouter } from "next/navigation";
import {
  maderaCortadaHistoricalStatusLabels,
  reviewMaderaCortadaHistoricalSale,
} from "@/lib/madera-cortada-historical-review";

type VentaMaderaCortadaRow = {
  id: string;
  cliente_id: string;
  fecha: string;
  estado: string;
  total: number | string;
  tipo_corte?: string | null;
  total_pt: number;
  precio_por_pt: number;
  cantidad_piezas: number | null;
  precio_unitario_comercial: number | null;
  lineas_comprobante: unknown;
  tipo_comprobante: string;
};

type VentaMaderaCortadaTableProps = {
  ventas: VentaMaderaCortadaRow[];
  clientesById: Record<string, string>;
  clientesMap: Record<string, { ruc?: string | null }>;
  canMutate: boolean;
  canCorrectHistorical: boolean;
};

export function VentaMaderaCortadaTable({
  ventas,
  clientesById,
  clientesMap,
  canMutate,
  canCorrectHistorical,
}: VentaMaderaCortadaTableProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [ventaAEliminar, setVentaAEliminar] = useState<VentaMaderaCortadaRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const clienteNombre = ventaAEliminar ? (clientesById[ventaAEliminar.cliente_id] ?? "—") : "";
  const fechaFormateada = ventaAEliminar ? formatDate(ventaAEliminar.fecha) : "";
  const montoFormateado = ventaAEliminar ? formatPen(Number(ventaAEliminar.total)) : "";

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <Table>
          <THead>
            <TRow>
              <TH>Fecha</TH>
              <TH>Cliente</TH>
              <TH>Tipo corte</TH>
              <TH>Estado</TH>
              <TH>Revisión de boleta</TH>
              <TH className="text-right">Total</TH>
              <TH className="w-32 text-right">Acciones</TH>
            </TRow>
          </THead>
          <tbody>
            {ventas.slice(0, 30).map((v) => {
              const review = reviewMaderaCortadaHistoricalSale(v);
              return (
              <TRow key={v.id}>
                <TD>{formatDate(v.fecha)}</TD>
                <TD>{clientesById[v.cliente_id] ?? "—"}</TD>
                <TD className="capitalize text-xs">{v.tipo_corte ?? "—"}</TD>
                <TD>
                  <Badge
                    variant={
                      v.estado === "confirmada"
                        ? "success"
                        : v.estado === "anulada"
                        ? "danger"
                        : "neutral"
                    }
                  >
                    {v.estado}
                  </Badge>
                </TD>
                <TD>
                  <Badge
                    variant={
                      review.status === "correcta"
                        ? "success"
                        : review.status === "falta_informacion"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {maderaCortadaHistoricalStatusLabels[review.status]}
                  </Badge>
                </TD>
                <TD className="text-right font-semibold">
                  {formatPen(Number(v.total))}
                </TD>
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-2.5">
                    {/* Imprimir comprobante */}
                    {(() => {
                      const cli = clientesMap[v.cliente_id];
                      const hasRuc = !!(cli?.ruc && cli.ruc.trim().length === 11);
                      const printUrl = `/ventas/comprobante/madera/${v.id}` +
                        `?tipoComprobante=${hasRuc ? "factura" : "boleta"}`;
                      return (
                        <Link
                          href={printUrl}
                          target="_blank"
                          className="p-1 hover:bg-slate-500/10 rounded transition-colors text-slate-400 hover:text-[var(--color-accent)]"
                          title="Imprimir comprobante"
                        >
                          🖨️
                        </Link>
                      );
                    })()}

                    {canMutate && (
                      <>
                        <Link
                          href={`/ventas/madera-cortada/${v.id}/editar`}
                          className="p-1 hover:bg-slate-500/10 rounded transition-colors text-slate-400 hover:text-[var(--color-text-primary)]"
                          title="Editar venta"
                        >
                          <Edit2 className="size-3.5" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => setVentaAEliminar(v)}
                          className="p-1 hover:bg-red-500/10 rounded transition-colors text-slate-400 hover:text-red-500"
                          title="Eliminar venta"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                    {canCorrectHistorical ? (
                      <Link
                        href={`/ventas/madera-cortada/${v.id}/corregir`}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-600"
                        title="Revisar y corregir boleta"
                        aria-label="Revisar y corregir boleta"
                      >
                        <ClipboardCheck className="size-3.5" />
                      </Link>
                    ) : null}
                  </div>
                </TD>
              </TRow>
              );
            })}
            {ventas.length === 0 ? (
              <TRow>
                <TD colSpan={7} className="text-center py-6 text-[var(--color-text-secondary)]">
                  Aún no hay ventas registradas.
                </TD>
              </TRow>
            ) : null}
          </tbody>
        </Table>
      </div>

      <ConfirmDialog
        open={Boolean(ventaAEliminar)}
        onOpenChange={(open) => {
          if (!open) setVentaAEliminar(null);
        }}
        title="¿Eliminar esta venta?"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        confirmVariant="danger"
        tone="caution"
        onConfirm={async () => {
          if (!ventaAEliminar || isDeleting) return false;
          setIsDeleting(true);
          const res = await deleteVentaMaderaCortada(ventaAEliminar.id);
          setIsDeleting(false);
          if (!res.ok) {
            showToast({ message: res.error, variant: "error" });
            return false;
          }
          showToast({ message: "Venta eliminada con éxito.", variant: "success" });
          setVentaAEliminar(null);
          router.refresh();
          return true;
        }}
      >
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          ¿Eliminar la venta de{" "}
          <strong className="text-[var(--color-text-primary)]">{clienteNombre}</strong> del{" "}
          <strong className="text-[var(--color-text-primary)]">{fechaFormateada}</strong> por{" "}
          <strong className="text-[var(--color-text-primary)]">{montoFormateado}</strong>? Esta acción revertirá el movimiento de caja e inventario asociados.
        </p>
      </ConfirmDialog>
    </>
  );
}
