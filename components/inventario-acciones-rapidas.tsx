import type React from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type InventarioAccionesRapidasProps = {
  canMutate: boolean;
  noPermisoHint: React.ReactNode;
  children: React.ReactNode;
};

/** Barra de botones del inventario (compras, productos, movimientos), mismo estilo que el resto del ERP. */
export function InventarioAccionesRapidas({
  canMutate,
  noPermisoHint,
  children,
}: InventarioAccionesRapidasProps) {
  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0 sm:max-w-xl">
        <CardTitle>Operaciones</CardTitle>
        <CardDescription>Registrar compra, producto o movimiento de stock.</CardDescription>
      </div>
      <div className="flex flex-wrap gap-3">
        {!canMutate ? noPermisoHint : null}
        {canMutate ? children : null}
      </div>
    </Card>
  );
}
