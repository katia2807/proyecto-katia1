"use client";

import { cambiarEstadoOrden } from "@/app/actions";
import { useOptimistic, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPen } from "@/lib/utils";

type Estado = "en_produccion" | "terminado" | "entregado";

type OrdenCard = {
  id: string;
  estado: Estado;
  cliente: string;
  correlativo: string | null;
  fecha_aprobacion: string | null;
  notas: string | null;
  precio_acordado: number | null;
  especie: string | null;
};

type KanbanOrdenesProps = {
  ordenes: OrdenCard[];
  canMutate: boolean;
};

const columnas: { value: Estado; label: string; color: string }[] = [
  { value: "en_produccion", label: "En producción", color: "warning" },
  { value: "terminado", label: "Terminado", color: "neutral" },
  { value: "entregado", label: "Entregado", color: "success" },
];

export function KanbanOrdenes({ ordenes, canMutate }: KanbanOrdenesProps) {
  const [optimistic, setOptimistic] = useOptimistic(
    ordenes,
    (state, { id, nuevoEstado }: { id: string; nuevoEstado: Estado }) =>
      state.map((o) => (o.id === id ? { ...o, estado: nuevoEstado } : o)),
  );
  const [, startTransition] = useTransition();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overEstado, setOverEstado] = useState<Estado | null>(null);

  function moverOrden(id: string, nuevoEstado: Estado) {
    startTransition(async () => {
      setOptimistic({ id, nuevoEstado });
      const formData = new FormData();
      formData.append("orden_id", id);
      formData.append("nuevo_estado", nuevoEstado);
      await cambiarEstadoOrden(formData);
    });
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {columnas.map((col) => {
        const items = optimistic.filter((o) => o.estado === col.value);
        const activa = overEstado === col.value;
        return (
          <div
            key={col.value}
            onDragOver={(e) => {
              if (!canMutate) return;
              e.preventDefault();
              setOverEstado(col.value);
            }}
            onDragLeave={() => setOverEstado(null)}
            onDrop={(e) => {
              if (!canMutate) return;
              e.preventDefault();
              setOverEstado(null);
              if (draggedId) {
                moverOrden(draggedId, col.value);
                setDraggedId(null);
              }
            }}
            className={`rounded-2xl border bg-[var(--color-surface)] p-3 transition ${
              activa
                ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]"
                : "border-[var(--color-border)]"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{col.label}</p>
              <Badge>{items.length}</Badge>
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Sin órdenes en esta etapa.
                </p>
              ) : null}
              {items.map((orden) => (
                <div
                  key={orden.id}
                  draggable={canMutate}
                  onDragStart={() => setDraggedId(orden.id)}
                  onDragEnd={() => setDraggedId(null)}
                  className={`cursor-${canMutate ? "grab" : "default"} rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 active:cursor-grabbing ${
                    draggedId === orden.id ? "opacity-50" : ""
                  }`}
                >
                  {orden.correlativo ? (
                    <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                      {orden.correlativo}
                    </p>
                  ) : null}
                  <p className="text-sm font-semibold">{orden.cliente}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {orden.fecha_aprobacion
                      ? `Aprobada ${formatDate(orden.fecha_aprobacion)}`
                      : "Sin fecha"}
                  </p>
                  {orden.especie ? (
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {orden.especie}
                      {orden.precio_acordado != null
                        ? ` · ${formatPen(orden.precio_acordado)}`
                        : ""}
                    </p>
                  ) : null}
                  {orden.notas ? (
                    <p className="mt-1 text-xs italic text-[var(--color-text-secondary)]">
                      {orden.notas}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
