"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer, DetailField } from "@/components/ui/detail-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatDate, formatPen } from "@/lib/utils";

type Cliente = {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  tipo_persona: "natural" | "empresa" | null;
  estado?: "activo" | "inactivo" | "moroso" | null;
  created_at: string;
};

type ClienteDetail = Cliente & {
  operaciones: number;
  facturado: number;
  pedidosActivos: number;
  pagosPendientes: number;
  cotizaciones: { id: string; fecha: string; monto: number; estado: string; href: string }[];
};

export function ClientesMasterDetail({ clientes }: { clientes: ClienteDetail[] }) {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("cliente");
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialId && clientes.some((cliente) => cliente.id === initialId) ? initialId : null,
  );
  const [editing, setEditing] = useState(false);
  const selected = useMemo(() => clientes.find((c) => c.id === selectedId) ?? null, [clientes, selectedId]);

  if (clientes.length === 0) {
    return (
      <EmptyState
        title="Aun no hay clientes"
        description="Los clientes sirven para enlazar cotizaciones, ventas, pagos pendientes e historial de pedidos."
        actionLabel="Crear desde ventas"
        actionHref="/ventas"
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <Table>
          <THead>
            <TRow>
              <TH>Nombre</TH>
              <TH>Documento</TH>
              <TH>Telefono</TH>
              <TH>Tipo</TH>
              <TH>Estado</TH>
              <TH className="text-right">Pedidos activos</TH>
              <TH className="text-right">Pagos pendientes</TH>
              <TH className="text-right">Operaciones</TH>
              <TH className="text-right">Facturado</TH>
            </TRow>
          </THead>
          <tbody>
            {clientes.map((c) => (
              <TRow key={c.id} className="cursor-pointer" onClick={() => setSelectedId(c.id)}>
                <TD className="font-semibold">{c.nombre}</TD>
                <TD>{c.documento ?? "Sin documento"}</TD>
                <TD>{c.telefono ?? "Sin telefono"}</TD>
                <TD>{c.tipo_persona ? <Badge variant="neutral">{c.tipo_persona}</Badge> : "No definido"}</TD>
                <TD>
                  <Badge variant={c.estado === "activo" ? "success" : c.estado === "moroso" ? "danger" : "warning"}>
                    {c.estado ?? "desconocido"}
                  </Badge>
                </TD>
                <TD className="text-right">{c.pedidosActivos}</TD>
                <TD className="text-right">{c.pagosPendientes}</TD>
                <TD className="text-right">{c.operaciones}</TD>
                <TD className="text-right font-semibold">{formatPen(c.facturado)}</TD>
              </TRow>
            ))}
          </tbody>
        </Table>
      </div>

      <DetailDrawer
        open={Boolean(selected)}
        title={selected?.nombre ?? "Cliente"}
        description="Vista 360 del cliente"
        fullPageHref={selected ? `/ventas/clientes/${selected.id}` : undefined}
        onClose={() => {
          setSelectedId(null);
          setEditing(false);
        }}
        onEdit={() => setEditing(true)}
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid gap-2">
              <DetailField label="Tipo" value={selected.tipo_persona ?? "No definido"} />
              <DetailField label="Telefono" value={selected.telefono ?? "Sin telefono"} />
              <DetailField label="Documento" value={selected.documento ?? "Sin documento"} />
              <DetailField label="Fecha registro" value={formatDate(selected.created_at)} />
              <DetailField label="Estado" value={selected.estado ?? "desconocido"} />
              <DetailField label="Pedidos activos" value={selected.pedidosActivos} />
              <DetailField label="Pagos pendientes" value={selected.pagosPendientes} />
            </div>

            {editing ? (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--bg-surface)] p-3">
                <p className="text-sm font-semibold">Edicion centralizada</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  La ficha completa mantiene el formulario de edicion para no duplicar acciones.
                </p>
                <Link href={`/ventas/clientes/${selected.id}`} className="mt-3 inline-flex">
                  <Button type="button">Abrir formulario</Button>
                </Link>
              </div>
            ) : null}

            <section>
              <h3 className="text-sm font-semibold">Ultimas 5 cotizaciones</h3>
              <div className="mt-2 space-y-2">
                {selected.cotizaciones.length > 0 ? (
                  selected.cotizaciones.map((cot) => (
                    <Link
                      href={cot.href}
                      key={cot.id}
                      className="block rounded-lg border border-[var(--color-border)] p-3 hover:bg-[var(--bg-surface)]"
                    >
                      <p className="text-sm font-semibold">{formatPen(cot.monto)}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {formatDate(cot.fecha)} · {cot.estado}
                      </p>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)]">No hay cotizaciones registradas.</p>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </DetailDrawer>
    </>
  );
}
