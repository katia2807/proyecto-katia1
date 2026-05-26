"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DetailDrawer, DetailField } from "@/components/ui/detail-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatDate, formatPen } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteCajaMovimiento } from "@/app/actions";
import type { AppRole } from "@/lib/supabase/types";

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
};

export function CajaMasterDetail({
  rows,
  userRole,
}: {
  rows: CajaRow[];
  userRole: AppRole | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movimientoAEliminar, setMovimientoAEliminar] = useState<CajaRow | null>(null);
  const { showToast } = useToast();

  // Local state for voucher type filtering (defaults to "todos")
  const [filterComprobante, setFilterComprobante] = useState<"todos" | "factura" | "boleta" | "ninguno">("todos");

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filterComprobante === "todos") return true;
      if (filterComprobante === "factura") return row.tipo_comprobante === "factura";
      if (filterComprobante === "boleta") return row.tipo_comprobante === "boleta";
      if (filterComprobante === "ninguno") {
        return !row.tipo_comprobante || row.tipo_comprobante === "ninguno";
      }
      return true;
    });
  }, [rows, filterComprobante]);

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Aun no hay movimientos de caja"
        description="Caja registra ingresos, egresos, comprobantes y notas para auditoria diaria."
        actionLabel="Registrar movimiento"
        actionHref="/caja"
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label htmlFor="tipo-comprobante-filter" className="text-sm font-medium text-[var(--color-text-secondary)]">
            Filtrar por Comprobante:
          </label>
          <select
            id="tipo-comprobante-filter"
            value={filterComprobante}
            onChange={(e) => setFilterComprobante(e.target.value as any)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
          >
            <option value="todos">Todos los comprobantes</option>
            <option value="factura">Factura</option>
            <option value="boleta">Boleta</option>
            <option value="ninguno">Sin comprobante (No)</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <Table>
          <THead>
            <TRow>
              <TH>Fecha</TH>
              <TH>Tipo</TH>
              <TH>Medio</TH>
              <TH>Categoria</TH>
              <TH>Marca</TH>
              <TH>Comprobante</TH>
              <TH className="text-right">Monto</TH>
              {userRole === "owner_admin" && (
                <TH className="w-12 text-center">Acciones</TH>
              )}
            </TRow>
          </THead>
          <tbody>
            {filteredRows.map((row) => (
              <TRow key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id)}>
                <TD>{formatDate(row.fecha)}</TD>
                <TD className="capitalize">{row.tipo}</TD>
                <TD className="capitalize">{row.medio}</TD>
                <TD>
                  {row.categoria}
                  {row.descripcion ? <p className="text-xs text-[var(--color-text-secondary)]">{row.descripcion}</p> : null}
                </TD>
                <TD>{row.es_personal ? "Personal" : "Empresa"}</TD>
                <TD>
                  {row.tipo_comprobante === "factura"
                    ? "Factura"
                    : row.tipo_comprobante === "boleta"
                      ? "Boleta"
                      : "No"}
                </TD>
                <TD className="text-right font-semibold">{formatPen(Number(row.monto))}</TD>
                {userRole === "owner_admin" && (
                  <TD className="text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMovimientoAEliminar(row);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Eliminar movimiento"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </TD>
                )}
              </TRow>
            ))}
            {filteredRows.length === 0 && (
              <TRow>
                <TD colSpan={userRole === "owner_admin" ? 8 : 7} className="text-center py-6 text-sm text-[var(--color-text-secondary)]">
                  Sin resultados para el filtro seleccionado.
                </TD>
              </TRow>
            )}
          </tbody>
        </Table>
      </div>

      <DetailDrawer
        open={Boolean(selected)}
        title={selected ? `${selected.tipo} · ${formatPen(Number(selected.monto))}` : "Movimiento"}
        description="Detalle de caja"
        onClose={() => {
          setSelectedId(null);
        }}
      >
        {selected ? (
          <div className="space-y-3">
            <DetailField label="Fecha" value={formatDate(selected.fecha)} />
            <DetailField label="Tipo" value={selected.tipo} />
            <DetailField label="Monto" value={formatPen(Number(selected.monto))} />
            <DetailField label="Categoria" value={selected.categoria} />
            <DetailField label="Descripcion / notas" value={selected.descripcion ?? "Sin notas"} />
            <DetailField label="Modulo origen" value={selected.modulo_origen ?? "Manual"} />
            <DetailField
              label="Comprobante"
              value={
                selected.tipo_comprobante === "factura"
                  ? "Factura"
                  : selected.tipo_comprobante === "boleta"
                    ? "Boleta"
                    : "Ninguno"
              }
            />
            {selected.url_comprobante ? (
              <DetailField
                label="Archivo Comprobante"
                value={
                  <Link className="underline text-[var(--color-accent)]" href={selected.url_comprobante} target="_blank">
                    Ver comprobante adjunto
                  </Link>
                }
              />
            ) : null}
            
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--bg-surface)] p-3 text-xs text-[var(--color-text-secondary)] flex items-center gap-2">
              <span>🔒</span>
              <p>
                Este movimiento está cerrado. Los registros de caja son inmutables para preservar la auditoría y control de flujo del negocio. Para correcciones, realice un contra-movimiento o anulación autorizada.
              </p>
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
          ¿Eliminar este movimiento? Esta acción no se puede deshacer.
        </p>
        {movimientoAEliminar && (
          <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--bg-surface)] p-3 text-xs space-y-1">
            <p><strong>Fecha:</strong> {formatDate(movimientoAEliminar.fecha)}</p>
            <p className="capitalize"><strong>Tipo:</strong> {movimientoAEliminar.tipo}</p>
            <p><strong>Categoría:</strong> {movimientoAEliminar.categoria}</p>
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
