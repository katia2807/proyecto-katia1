"use client";

import { useState } from "react";
import Link from "next/link";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPen } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteAlquilerContrato } from "@/app/actions";
import { useRouter } from "next/navigation";

type AlquilerContratoRow = {
  id: string;
  cliente_id: string;
  activo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  tarifa: number;
  penalidad: number | null;
  estado: string;
  codigo: string | null;
  monto_total: number | null;
  deposito_30: number | null;
};

type AlquilerMixerTableProps = {
  contratos: AlquilerContratoRow[];
  clientesById: Record<string, string>;
  canMutate: boolean;
};

export function AlquilerMixerTable({
  contratos,
  clientesById,
  canMutate,
}: AlquilerMixerTableProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [contratoAEliminar, setContratoAEliminar] = useState<AlquilerContratoRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const clienteNombre = contratoAEliminar ? (clientesById[contratoAEliminar.cliente_id] ?? "—") : "";
  const fechaFormateada = contratoAEliminar ? formatDate(contratoAEliminar.fecha_inicio) : "";
  const montoFormateado = contratoAEliminar ? formatPen(Number(contratoAEliminar.monto_total ?? 0)) : "";

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <Table>
          <THead>
            <TRow>
              <TH>Código</TH>
              <TH>Inicio</TH>
              <TH>Cliente</TH>
              <TH>Equipo</TH>
              <TH>Estado</TH>
              <TH className="text-right">Monto</TH>
              <TH className="text-right">Depósito</TH>
              <TH className="text-right">Penalidad</TH>
              <TH className="w-28 text-right">Acciones</TH>
            </TRow>
          </THead>
          <tbody>
            {contratos.map((c) => (
              <TRow key={c.id}>
                <TD className="font-mono text-xs">{c.codigo ?? `—`}</TD>
                <TD>{formatDate(c.fecha_inicio)}</TD>
                <TD>{clientesById[c.cliente_id] ?? "—"}</TD>
                <TD>{c.activo}</TD>
                <TD>
                  <Badge variant={c.estado === "abierto" ? "warning" : "success"}>
                    {c.estado}
                  </Badge>
                </TD>
                <TD className="text-right font-semibold">
                  {c.monto_total != null ? formatPen(c.monto_total) : "—"}
                </TD>
                <TD className="text-right">
                  {c.deposito_30 != null ? formatPen(c.deposito_30) : "—"}
                </TD>
                <TD className="text-right text-[var(--color-danger)] font-semibold">
                  {formatPen(Number(c.penalidad ?? 0))}
                </TD>
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-2.5">
                    <Link
                      href={`/ventas/alquiler-mixer/${c.id}/pdf`}
                      target="_blank"
                      className="p-1 hover:bg-slate-500/10 rounded transition-colors text-slate-400 hover:text-[var(--color-accent)] text-xs font-semibold underline"
                      title="Imprimir contrato"
                    >
                      Imprimir
                    </Link>
                    {canMutate && c.estado === "abierto" && (
                      <Link
                        href={`/ventas/alquiler-mixer/${c.id}/editar`}
                        className="p-1 hover:bg-slate-500/10 rounded transition-colors text-slate-400 hover:text-[var(--color-text-primary)] text-xs font-semibold underline"
                        title="Editar contrato"
                      >
                        Editar
                      </Link>
                    )}
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => setContratoAEliminar(c)}
                        className="p-1 hover:bg-red-500/10 rounded transition-colors text-slate-400 hover:text-red-500"
                        title="Eliminar contrato"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </TD>
              </TRow>
            ))}
            {contratos.length === 0 ? (
              <TRow>
                <TD colSpan={9} className="text-center py-6 text-[var(--color-text-secondary)]">
                  Aún no hay contratos. Crea uno con &quot;Nuevo contrato&quot;.
                </TD>
              </TRow>
            ) : null}
          </tbody>
        </Table>
      </div>

      <ConfirmDialog
        open={Boolean(contratoAEliminar)}
        onOpenChange={(open) => {
          if (!open) setContratoAEliminar(null);
        }}
        title="¿Eliminar este contrato?"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        confirmVariant="danger"
        tone="caution"
        onConfirm={async () => {
          if (!contratoAEliminar || isDeleting) return false;
          setIsDeleting(true);
          const res = await deleteAlquilerContrato(contratoAEliminar.id);
          setIsDeleting(false);
          if (!res.ok) {
            showToast({ message: res.error, variant: "error" });
            return false;
          }
          showToast({ message: "Contrato eliminado con éxito.", variant: "success" });
          setContratoAEliminar(null);
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
