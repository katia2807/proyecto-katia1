"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DetailDrawer, DetailField } from "@/components/ui/detail-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatDate, formatPen } from "@/lib/utils";

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
};

export function CajaMasterDetail({ rows }: { rows: CajaRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
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
            </TRow>
          </THead>
          <tbody>
            {rows.map((row) => (
              <TRow key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id)}>
                <TD>{formatDate(row.fecha)}</TD>
                <TD className="capitalize">{row.tipo}</TD>
                <TD className="capitalize">{row.medio}</TD>
                <TD>
                  {row.categoria}
                  {row.descripcion ? <p className="text-xs text-[var(--color-text-secondary)]">{row.descripcion}</p> : null}
                </TD>
                <TD>{row.es_personal ? "Personal" : "Empresa"}</TD>
                <TD>{row.url_comprobante ? "Si" : "No"}</TD>
                <TD className="text-right font-semibold">{formatPen(Number(row.monto))}</TD>
              </TRow>
            ))}
          </tbody>
        </Table>
      </div>

      <DetailDrawer
        open={Boolean(selected)}
        title={selected ? `${selected.tipo} · ${formatPen(Number(selected.monto))}` : "Movimiento"}
        description="Detalle de caja"
        onClose={() => {
          setSelectedId(null);
          setEditing(false);
        }}
        onEdit={() => setEditing(true)}
      >
        {selected ? (
          <div className="space-y-3">
            <DetailField label="Fecha" value={formatDate(selected.fecha)} />
            <DetailField label="Tipo" value={selected.tipo} />
            <DetailField label="Monto" value={formatPen(Number(selected.monto))} />
            <DetailField label="Categoria" value={selected.categoria} />
            <DetailField label="Descripcion / notas" value={selected.descripcion ?? "Sin notas"} />
            <DetailField label="Modulo origen" value={selected.modulo_origen ?? "Manual"} />
            <DetailField label="Comprobante" value={selected.url_comprobante ? <Link className="underline" href={selected.url_comprobante} target="_blank">Ver comprobante</Link> : "Sin comprobante"} />
            {editing ? (
              <p className="rounded-lg border border-[var(--color-border)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--color-text-secondary)]">
                La edicion de movimientos cerrados se mantiene en el flujo autorizado de Caja para preservar auditoria.
              </p>
            ) : null}
          </div>
        ) : null}
      </DetailDrawer>
    </>
  );
}
