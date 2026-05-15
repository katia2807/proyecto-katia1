"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DetailDrawer, DetailField } from "@/components/ui/detail-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatDate, formatPen } from "@/lib/utils";

type Cotizacion = {
  id: string;
  cliente: string;
  fecha: string;
  correlativo: string | null;
  total: number;
  estado_flujo: string;
  tipo_cliente: string;
  detalle: unknown;
  created_at: string;
};

export function CotizacionMasterDetail({ cotizaciones }: { cotizaciones: Cotizacion[] }) {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("cotizacion");
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialId && cotizaciones.some((row) => row.id === initialId) ? initialId : null,
  );
  const [editing, setEditing] = useState(false);
  const selected = useMemo(() => cotizaciones.find((row) => row.id === selectedId) ?? null, [cotizaciones, selectedId]);

  if (cotizaciones.length === 0) {
    return (
      <EmptyState
        title="Aun no hay cotizaciones"
        description="Las cotizaciones ordenan cliente, items, precios, fechas, cobros y produccion."
        actionLabel="Crear cotizacion"
        actionHref="/cotizacion"
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <Table>
          <THead>
            <TRow>
              <TH>Nro.</TH>
              <TH>Fecha</TH>
              <TH>Cliente</TH>
              <TH>Estado</TH>
              <TH className="text-right">Total</TH>
            </TRow>
          </THead>
          <tbody>
            {cotizaciones.map((row) => (
              <TRow key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id)}>
                <TD className="font-mono text-xs">{row.correlativo ?? row.id.slice(0, 8)}</TD>
                <TD>{formatDate(row.fecha)}</TD>
                <TD>{row.cliente}</TD>
                <TD>{row.estado_flujo}</TD>
                <TD className="text-right font-semibold">{formatPen(Number(row.total))}</TD>
              </TRow>
            ))}
          </tbody>
        </Table>
      </div>

      <DetailDrawer
        open={Boolean(selected)}
        title={selected?.correlativo ?? "Cotizacion"}
        description="Detalle completo de cotizacion"
        fullPageHref={selected ? `/cotizacion?cotizacion=${selected.id}` : undefined}
        onClose={() => {
          setSelectedId(null);
          setEditing(false);
        }}
        onEdit={() => setEditing(true)}
      >
        {selected ? (
          <div className="space-y-4">
            <DetailField label="Cliente" value={selected.cliente} />
            <DetailField label="Fecha" value={formatDate(selected.fecha)} />
            <DetailField label="Estado" value={selected.estado_flujo} />
            <DetailField label="Tipo cliente" value={selected.tipo_cliente} />
            <DetailField label="Total" value={formatPen(Number(selected.total))} />
            <DetailField label="Creada" value={formatDate(selected.created_at)} />
            <section>
              <h3 className="text-sm font-semibold">Items y detalle</h3>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--bg-surface)] p-3 text-xs">
                {JSON.stringify(selected.detalle, null, 2)}
              </pre>
            </section>
            <section>
              <h3 className="text-sm font-semibold">Historial de cambios</h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Creada el {formatDate(selected.created_at)}. El estado actual es {selected.estado_flujo}.
              </p>
            </section>
            {editing ? (
              <Link href={`/cotizacion?editar=${selected.id}`} className="inline-flex">
                Abrir formulario de edicion
              </Link>
            ) : null}
          </div>
        ) : null}
      </DetailDrawer>
    </>
  );
}
