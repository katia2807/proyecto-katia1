"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteCotizacionMueblePersonalizada } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const CONFIRM_BODY =
  "Vas a eliminar esta cotización de muebles personalizados de forma permanente.\n\n" +
  "El registro se borrará del sistema (base de datos). No hay papelera ni forma de recuperar la información una vez confirmado.\n\n" +
  "¿Seguro que querés continuar?";

type EliminarCotizacionMuebleButtonProps = {
  id: string;
  correlativo: string | null;
};

export function EliminarCotizacionMuebleButton({ id, correlativo }: EliminarCotizacionMuebleButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleEliminar() {
    const ref = correlativo?.trim() || "esta cotización";
    if (!window.confirm(`${CONFIRM_BODY}\n\nReferencia: ${ref}`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await deleteCotizacionMueblePersonalizada(id);
      if (!res.ok) {
        showToast({ message: res.error, variant: "error" });
        return;
      }
      showToast({ message: "Cotización eliminada.", variant: "success" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="danger"
      className="h-8 min-w-0 px-2 text-xs"
      disabled={busy}
      onClick={handleEliminar}
    >
      {busy ? "…" : "Eliminar"}
    </Button>
  );
}
