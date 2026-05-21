"use client";

import { cancelarVentaMueble } from "@/app/actions";
import { Button } from "@/components/ui/button";

type CancelarVentaButtonProps = {
  ventaId: string;
};

export function CancelarVentaButton({ ventaId }: CancelarVentaButtonProps) {
  const handleCancel = async () => {
    const confirmado = window.confirm(
      "¿Cancelar esta venta? El stock será devuelto al inventario y quedará registrado en el kardex."
    );
    if (!confirmado) return;

    const formData = new FormData();
    formData.append("id", ventaId);
    try {
      await cancelarVentaMueble(formData);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error al cancelar la venta.");
    }
  };

  return (
    <Button
      type="button"
      variant="danger"
      className="h-8 px-3 text-xs"
      onClick={handleCancel}
    >
      Cancelar venta
    </Button>
  );
}
