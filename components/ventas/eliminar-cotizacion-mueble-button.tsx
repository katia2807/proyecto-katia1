"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteCotizacionMueblePersonalizada } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

type EliminarCotizacionMuebleButtonProps = {
  id: string;
  correlativo: string | null;
  clienteId: string;
};

export function EliminarCotizacionMuebleButton({ id, correlativo, clienteId }: EliminarCotizacionMuebleButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const refLabel = correlativo?.trim() || "Sin número asignado";

  return (
    <>
      <Button
        type="button"
        variant="danger"
        className="h-8 min-w-0 px-2 text-xs"
        onClick={() => setOpen(true)}
      >
        Eliminar
      </Button>

      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Sí, eliminar definitivamente"
        confirmVariant="danger"
        open={open}
        onOpenChange={setOpen}
        title="Eliminar cotización"
        onConfirm={async () => {
          const res = await deleteCotizacionMueblePersonalizada(id);
          if (!res.ok) {
            if (res.error.toLowerCase().includes("activo")) {
              showToast({ message: res.error, variant: "error" });
              router.push(`/ventas/clientes/${clienteId}`);
              return true;
            }
            showToast({ message: res.error, variant: "error" });
            return false;
          }
          showToast({ message: "Cotización eliminada.", variant: "success" });
          router.refresh();
          return true;
        }}
      >
        <p>
          Vas a eliminar esta cotización de <strong className="text-[var(--text-primary)]">muebles personalizados</strong>{" "}
          de forma <strong className="text-[var(--text-primary)]">permanente</strong>.
        </p>
        <p>
          El registro se borrará del sistema (<strong className="text-[var(--text-primary)]">base de datos</strong>). No hay
          papelera ni forma de recuperar la información una vez confirmado.
        </p>
        <p className="text-[var(--text-primary)]">¿Seguro que querés continuar?</p>
        <p className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)]">
          Referencia: {refLabel}
        </p>
      </ConfirmDialog>
    </>
  );
}
