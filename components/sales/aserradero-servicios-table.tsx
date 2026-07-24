"use client";

import { useState } from "react";
import Link from "next/link";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatDate, formatPen } from "@/lib/utils";
import { Trash2, Edit2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteServicioAserradero } from "@/app/actions";
import { useRouter } from "next/navigation";

type ServicioAserraderoRow = {
  id: string;
  cliente_id: string;
  fecha: string;
  pies_cubicos: number;
  costo_cubicaje: number;
  precio_cobrado: number;
  lineas_json: any;
  correlativo: string | null;
};

type AserraderoServiciosTableProps = {
  servicios: ServicioAserraderoRow[];
  clientesById: Record<string, string>;
  clientesMap: Record<string, any>;
  canMutate: boolean;
};

export function AserraderoServiciosTable({
  servicios,
  clientesById,
  clientesMap,
  canMutate,
}: AserraderoServiciosTableProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [servicioAEliminar, setServicioAEliminar] = useState<ServicioAserraderoRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const clienteNombre = servicioAEliminar ? (clientesById[servicioAEliminar.cliente_id] ?? "—") : "";
  const fechaFormateada = servicioAEliminar ? formatDate(servicioAEliminar.fecha) : "";
  const montoFormateado = servicioAEliminar ? formatPen(Number(servicioAEliminar.precio_cobrado)) : "";

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <Table>
          <THead>
            <TRow>
              <TH>Fecha</TH>
              <TH>Cliente</TH>
              <TH className="text-right">Pies cúbicos</TH>
              <TH className="text-right">Costo</TH>
              <TH className="text-right">Cobrado</TH>
              <TH className="w-24 text-right">Acciones</TH>
            </TRow>
          </THead>
          <tbody>
            {servicios.map((s) => (
              <TRow key={s.id}>
                <TD>{formatDate(s.fecha)}</TD>
                <TD>
                  <div className="font-medium">{clientesById[s.cliente_id] ?? "—"}</div>
                  {clientesMap[s.cliente_id]?.documento?.startsWith("PEND-") ? (
                    <div className="mt-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      {clientesMap[s.cliente_id].documento}
                    </div>
                  ) : null}
                  {(() => {
                    try {
                      const lineas = Array.isArray(s.lineas_json)
                        ? s.lineas_json
                        : typeof s.lineas_json === "string"
                        ? JSON.parse(s.lineas_json)
                        : [];
                      const nota = lineas?.find((l: any) => l?.tipo === "nota_interna");
                      if (nota?.observaciones) {
                        return (
                          <div className="mt-1 max-w-[200px] truncate text-[11px] font-semibold text-amber-600 dark:text-amber-400" title={nota.observaciones}>
                            📝 {nota.observaciones}
                          </div>
                        );
                      }
                    } catch (e) {}
                    return null;
                  })()}
                </TD>
                <TD className="text-right">{Number(s.pies_cubicos).toFixed(2)}</TD>
                <TD className="text-right">{formatPen(Number(s.costo_cubicaje))}</TD>
                <TD className="text-right font-semibold">
                  {formatPen(Number(s.precio_cobrado))}
                </TD>
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-2.5">
                    {(() => {
                      const cli = clientesMap[s.cliente_id];
                      const hasRuc = !!(cli?.ruc && cli.ruc.trim().length === 11);
                      const printUrl = `/ventas/comprobante/aserradero/${s.id}?tipoComprobante=${hasRuc ? "factura" : "boleta"}`;
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
                          href={`/ventas/aserradero-servicios/${s.id}/editar`}
                          className="p-1 hover:bg-slate-500/10 rounded transition-colors text-slate-400 hover:text-[var(--color-text-primary)]"
                          title="Editar servicio"
                        >
                          <Edit2 className="size-3.5" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => setServicioAEliminar(s)}
                          className="p-1 hover:bg-red-500/10 rounded transition-colors text-slate-400 hover:text-red-500"
                          title="Eliminar servicio"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </TD>
              </TRow>
            ))}
            {servicios.length === 0 ? (
              <TRow>
                <TD colSpan={6} className="text-center py-6 text-[var(--color-text-secondary)]">
                  Aún no hay servicios registrados.
                </TD>
              </TRow>
            ) : null}
          </tbody>
        </Table>
      </div>

      <ConfirmDialog
        open={Boolean(servicioAEliminar)}
        onOpenChange={(open) => {
          if (!open) setServicioAEliminar(null);
        }}
        title="¿Eliminar este servicio?"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        confirmVariant="danger"
        tone="caution"
        onConfirm={async () => {
          if (!servicioAEliminar || isDeleting) return false;
          setIsDeleting(true);
          const res = await deleteServicioAserradero(servicioAEliminar.id);
          setIsDeleting(false);
          if (!res.ok) {
            showToast({ message: res.error, variant: "error" });
            return false;
          }
          showToast({ message: "Servicio eliminado con éxito.", variant: "success" });
          setServicioAEliminar(null);
          router.refresh();
          return true;
        }}
      >
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          ¿Eliminar servicio de <strong className="text-[var(--color-text-primary)]">{clienteNombre}</strong> del <strong className="text-[var(--color-text-primary)]">{fechaFormateada}</strong> por <strong className="text-[var(--color-text-primary)]">{montoFormateado}</strong>? Esta acción revertirá el movimiento de caja asociado.
        </p>
      </ConfirmDialog>
    </>
  );
}
