"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatPen } from "@/lib/utils";

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
                  <TRow
                    key={c.id}
                    className="cursor-pointer hover:bg-[var(--color-primary-soft)]"
                    onClick={() => router.push(`/ventas/clientes/${c.id}`)}
                  >
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
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            Haz clic en una fila para abrir la ficha completa del cliente.
          </p>
        </>
      )}
    </div>
  );
}
