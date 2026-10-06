"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatPen } from "@/lib/utils";
import { documentoCliente, etiquetaEstadoCliente, etiquetaTipoCliente } from "@/lib/clientes-model";

type Cliente = {
  id: string;
  nombre: string;
  documento: string | null;
  ruc?: string | null;
  telefono: string | null;
  tipo_persona: "natural" | "empresa" | null;
  estado?: "activo" | "inactivo" | "moroso" | "vip" | null;
  created_at: string;
};

type ClienteDetail = Cliente & {
  operaciones: number;
  facturado: number;
  importesPorDefinir: number;
  pedidosActivos: number;
  pagosPendientes: number;
};

export function ClientesMasterDetail({ clientes, volver = "/ventas/clientes" }: { clientes: ClienteDetail[]; volver?: string }) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      {clientes.length === 0 ? (
        <EmptyState
          title="Aun no hay clientes"
          description="Los clientes sirven para enlazar cotizaciones, ventas, pagos pendientes e historial de pedidos."
          actionLabel="Crear desde ventas"
          actionHref="/ventas"
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" tabIndex={0} role="region" aria-label="Listado de clientes">
            <Table>
              <THead>
                <TRow>
                  <TH>Nombre</TH>
                  <TH>Documento</TH>
                  <TH>Teléfono</TH>
                  <TH>Tipo</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Pedidos activos</TH>
                  <TH className="text-right">Cobros vencidos</TH>
                  <TH className="text-right">Operaciones</TH>
                  <TH className="text-right">Total registrado</TH>
                </TRow>
              </THead>
              <tbody>
                {clientes.map((c) => (
                  <TRow
                    key={c.id}
                    className="cursor-pointer hover:bg-[var(--color-primary-soft)]"
                    onClick={() => router.push(`/ventas/clientes/${c.id}?volver=${encodeURIComponent(volver)}`)}
                  >
                    <TD className="font-semibold"><Link href={`/ventas/clientes/${c.id}?volver=${encodeURIComponent(volver)}`} onClick={event => event.stopPropagation()} className="hover:underline focus-visible:underline">{c.nombre}</Link></TD>
                    <TD>{documentoCliente(c)}</TD>
                    <TD>{c.telefono?.trim() || "Sin teléfono"}</TD>
                    <TD>{etiquetaTipoCliente(c.tipo_persona)}</TD>
                    <TD>
                      <Badge variant={c.estado === "activo" ? "success" : c.estado === "moroso" ? "danger" : "warning"}>
                        {etiquetaEstadoCliente(c.estado)}
                      </Badge>
                    </TD>
                    <TD className="text-right">{c.pedidosActivos}</TD>
                    <TD className="text-right">{c.pagosPendientes}</TD>
                    <TD className="text-right">{c.operaciones}</TD>
                    <TD className="text-right font-semibold">{formatPen(c.facturado)}{c.importesPorDefinir > 0 ? <span className="block text-xs font-normal">{c.importesPorDefinir} importe(s) por definir</span> : null}</TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            Haz clic en una fila para abrir la ficha completa del cliente.
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] sm:hidden">Desliza la tabla para ver todas las columnas.</p>
        </>
      )}
    </div>
  );
}
