"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ContextActionPanel } from "@/components/context-action-panel";
import { MaderaCortadaForm } from "@/components/sales/madera-cortada-form";
import type { ZonaEntregaRow } from "@/lib/demo-store";

type Cliente = { id: string; nombre: string };
type Chofer = { id: string; nombre: string; telefono?: string | null; placa?: string | null };
type Producto = { id: string; nombre: string; unidad: string; stock_actual: number | string; categoria: string };

type Props = {
  clientes: Cliente[];
  choferes: Chofer[];
  productos: Producto[];
  zonas: Pick<ZonaEntregaRow, "id" | "nombre" | "tarifa" | "distancia_km">[];
  mockData?: boolean;
};

export function MaderaCortadaPanel({ clientes, choferes, productos, zonas, mockData }: Props) {
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
      triggerLabel="Vender madera cortada"
      title="Nueva venta de madera cortada"
      description="Cliente, tipo de corte, calculadora PT, entrega y pago."
      open={open}
      onOpenChange={setOpen}
    >
      <MaderaCortadaForm
        key={formKey}
        clientes={clientes}
        choferes={choferes}
        productos={productos}
        zonas={zonas}
        mockData={mockData}
        onSuccess={handleSuccess}
      />
    </ContextActionPanel>
  );
}
