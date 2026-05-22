"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ContextActionPanel } from "@/components/context-action-panel";
import { VentaMaderaForm } from "@/components/sales/venta-madera-form";

type Cliente = { id: string; nombre: string };
type Producto = { id: string; nombre: string; unidad: string; stock_actual: number | string; categoria: string };

type Props = {
  clientes: Cliente[];
  productos: Producto[];
  mockData?: boolean;
};

export function VentaMaderaPanel({ clientes, productos, mockData }: Props) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const router = useRouter();

  function handleSuccess() {
    setOpen(false);
    setFormKey((k) => k + 1);
    router.refresh();
  }

  return (
    <ContextActionPanel
      triggerLabel="Vender madera (Clásica)"
      title="Nueva venta de madera (Tradicional)"
      description="Cliente, producto de inventario, cantidad, precio unitario, cobro y confirmación."
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFormKey((k) => k + 1);
      }}
    >
      <VentaMaderaForm
        key={formKey}
        clientes={clientes}
        productos={productos}
        mockData={mockData}
        onSuccess={handleSuccess}
      />
    </ContextActionPanel>
  );
}
