"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DetailDrawer, DetailField } from "@/components/ui/detail-drawer";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatDate, formatPen } from "@/lib/utils";
import { Info, LockKeyhole, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteCajaMovimiento } from "@/app/actions";
import type { AppRole } from "@/lib/supabase/types";
import { cajaComprobante, CAJA_COMPROBANTE_LABELS } from "@/lib/caja-filtros";
import { cajaOrigenLink } from "@/lib/caja-origen-navigation";
import { cajaCategoriaLabel, cajaMedioLabel, cajaOrigenLabel, cajaTipoLabel } from "@/lib/caja-presentacion";
import { cajaEliminacionBloqueo } from "@/lib/caja-eliminacion";

type CajaRow = {
  id: string;
  fecha: string;
  tipo: string;
  medio: string;
  categoria: string;
  monto: number;
  descripcion: string | null;
  es_personal: boolean;
  modulo_origen: string | null;
  referencia_id: string | null;
  url_comprobante: string | null;
  tipo_comprobante: string | null;
  periodo_cerrado: boolean;
};

export function CajaMasterDetail({
  rows,
  userRole,
  cajaHref = "/caja#movimientos-caja",
  canOpenOrigen = false,
  emptyMessage = "No hay movimientos que coincidan. Prueba otros filtros o límpialos para ver el historial.",
}: {
  rows: CajaRow[];
  userRole: AppRole | null;
  cajaHref?: string;
  canOpenOrigen?: boolean;
  emptyMessage?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movimientoAEliminar, setMovimientoAEliminar] = useState<CajaRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { showToast } = useToast();

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);
  const origen = selected ? cajaOrigenLink(selected, cajaHref) : null;
  const bloqueo = selected ? cajaEliminacionBloqueo(selected) : null;

  return (
    <>
      <p className="mb-2 text-xs text-[var(--color-text-secondary)] lg:hidden">Desliza la tabla para ver todas las columnas y acciones.</p>
      <div role="region" aria-label="Tabla de movimientos de Caja" tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border border-[var(--color-border)] focus-visible:outline-2 focus-visible:outline-offset-2">
        <Table>
          <THead>
            <TRow>
              <TH>Fecha</TH>
              <TH>Tipo</TH>
              <TH>Medio de pago</TH>
              <TH>Categoría</TH>
              <TH>Empresa / Personal</TH>
              <TH>Comprobante</TH>
              <TH className="text-right">Monto</TH>
              {userRole === "owner_admin" && (
                <TH className="w-28 text-center">Acciones</TH>
              )}
            </TRow>
          </THead>
          <tbody>
            {rows.map((row) => {
              const protegido = cajaEliminacionBloqueo(row);
              return (
              <TRow key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id)}>
                <TD>{formatDate(row.fecha)}</TD>
                <TD>{cajaTipoLabel(row.tipo)}</TD>
                <TD>{cajaMedioLabel(row.medio)}</TD>
                <TD>
                  {cajaCategoriaLabel(row.categoria)}
                  {row.descripcion ? <p className="text-xs text-[var(--color-text-secondary)]">{row.descripcion}</p> : null}
                </TD>
                <TD>{row.es_personal ? "Personal" : "Empresa"}</TD>
                <TD>{CAJA_COMPROBANTE_LABELS[cajaComprobante(row)]}</TD>
                <TD className="text-right font-semibold">{formatPen(Number(row.monto))}</TD>
                {userRole === "owner_admin" && (
                  <TD className="text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (protegido) {
                          setSelectedId(row.id);
                        } else {
                          setDeleteError(null);
                          setMovimientoAEliminar(row);
                        }
                      }}
                      className={protegido ? "inline-flex items-center gap-1 rounded-lg p-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--bg-surface)]" : "p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"}
                      title={protegido || "Eliminar movimiento"}
                      aria-label={`${protegido ? "Ver protección del movimiento" : "Eliminar movimiento"}: ${row.descripcion || cajaCategoriaLabel(row.categoria)}`}
                    >
                      {protegido ? <><LockKeyhole className="size-4" aria-hidden="true" />Protegido</> : <Trash2 className="size-4" aria-hidden="true" />}
                    </button>
                  </TD>
                )}
              </TRow>
              );
            })}
            {rows.length === 0 && (
              <TRow>
                <TD colSpan={userRole === "owner_admin" ? 8 : 7} className="text-center py-6 text-sm text-[var(--color-text-secondary)]">
                  {emptyMessage}
                </TD>
              </TRow>
            )}
          </tbody>
        </Table>
      </div>

      <DetailDrawer
        open={Boolean(selected)}
        title={selected ? `${cajaTipoLabel(selected.tipo)} · ${formatPen(Number(selected.monto))}` : "Movimiento"}
        description="Detalle de caja"
        onClose={() => {
          setSelectedId(null);
        }}
      >
        {selected ? (
          <div className="space-y-3">
            <DetailField label="Fecha" value={formatDate(selected.fecha)} />
            <DetailField label="Tipo" value={cajaTipoLabel(selected.tipo)} />
            <DetailField label="Monto" value={formatPen(Number(selected.monto))} />
            <DetailField label="Medio de pago" value={cajaMedioLabel(selected.medio)} />
            <DetailField label="Empresa / Personal" value={selected.es_personal ? "Personal" : "Empresa"} />
            <DetailField label="Categoría" value={cajaCategoriaLabel(selected.categoria)} />
            <DetailField label="Descripción / notas" value={selected.descripcion?.trim() || "Sin notas"} />
            <DetailField label="Origen" value={cajaOrigenLabel(selected.modulo_origen)} />
            <div className="rounded-xl border border-[var(--color-border)] p-3 space-y-2">
              <p className="text-sm font-semibold">Operación relacionada</p>
              {origen && canOpenOrigen ? (
                <>
                  <Link href={origen.href} target="_blank" rel="noopener noreferrer" prefetch={false} className="inline-flex rounded-lg bg-[var(--katia-primary)] px-3 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2">
                    {origen.label}
                  </Link>
                  <p className="text-xs text-[var(--katia-text-secondary)]">Se abre en otra pestaña. Caja conserva tus filtros y la página actual.</p>
                </>
              ) : (
                <p className="text-sm text-[var(--katia-text-secondary)]">{origen ? "Tu rol permite consultar Caja, pero no abrir la operación relacionada." : "Este movimiento no tiene una venta o cotización enlazada. Consulta su descripción y notas."}</p>
              )}
            </div>
            <DetailField
              label="Comprobante"
              value={CAJA_COMPROBANTE_LABELS[cajaComprobante(selected)]}
            />
            {selected.url_comprobante ? (
              <DetailField
                label="Comprobante adjunto"
                value={
                  <Link className="underline text-[var(--color-accent)]" href={selected.url_comprobante} target="_blank" rel="noopener noreferrer">
                    Ver comprobante adjunto
                  </Link>
                }
              />
            ) : null}
            
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--bg-surface)] p-3 text-xs text-[var(--color-text-secondary)] flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-semibold">{bloqueo ? "Movimiento protegido" : "Si necesitas corregirlo"}</p>
                <p>
                  {bloqueo || `Los datos no se editan desde este detalle. ${userRole === "owner_admin" ? "La eliminación está disponible en la papelera del historial; revisa la confirmación antes de continuar." : "Si encuentras un error, pide al administrador que lo revise."}`}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </DetailDrawer>

      <ConfirmDialog
        open={Boolean(movimientoAEliminar)}
        onOpenChange={(open) => {
          if (!open) setMovimientoAEliminar(null);
        }}
        title="¿Eliminar este movimiento?"
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        confirmVariant="danger"
        tone="caution"
        onConfirm={async () => {
          if (!movimientoAEliminar) return;
          const res = await deleteCajaMovimiento(movimientoAEliminar.id);
          if (!res.ok) {
            setDeleteError(res.error);
            showToast({ message: res.error, variant: "error" });
            return false;
          }
          showToast({ message: "Movimiento eliminado con éxito.", variant: "success" });
          if (selectedId === movimientoAEliminar.id) {
            setSelectedId(null);
          }
          setMovimientoAEliminar(null);
          return true;
        }}
      >
        <p className="text-sm text-[var(--color-text-secondary)]">
          El movimiento dejará de aparecer en el historial y los totales de Caja se actualizarán. Esta acción no se puede deshacer desde el programa.
        </p>
        {deleteError ? <p role="alert" className="text-sm text-[var(--color-danger)]">No se eliminó el movimiento. {deleteError}</p> : null}
        {movimientoAEliminar && (
          <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--bg-surface)] p-3 text-xs space-y-1">
            <p><strong>Fecha:</strong> {formatDate(movimientoAEliminar.fecha)}</p>
            <p><strong>Tipo:</strong> {cajaTipoLabel(movimientoAEliminar.tipo)}</p>
            <p><strong>Medio de pago:</strong> {cajaMedioLabel(movimientoAEliminar.medio)}</p>
            <p><strong>Empresa / Personal:</strong> {movimientoAEliminar.es_personal ? "Personal" : "Empresa"}</p>
            <p><strong>Categoría:</strong> {cajaCategoriaLabel(movimientoAEliminar.categoria)}</p>
            {movimientoAEliminar.descripcion && (
              <p><strong>Descripción:</strong> {movimientoAEliminar.descripcion}</p>
            )}
            <p><strong>Monto:</strong> {formatPen(Number(movimientoAEliminar.monto))}</p>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
