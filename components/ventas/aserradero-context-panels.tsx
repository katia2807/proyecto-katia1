"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ContextActionPanel } from "@/components/context-action-panel";
import { AserraderoForm } from "@/components/sales/aserradero-form";

type Cliente = { id: string; nombre: string };
type ServicioEspecial = {
  id: string;
  codigo: string;
  nombre: string;
  tarifa_por_pieza: number;
};

type AserraderoContextPanelsProps = {
  clientes: Cliente[];
  serviciosEspeciales: ServicioEspecial[];
  margenGananciaDefaultPct?: number;
  mockData?: boolean;
};

export function AserraderoContextPanels({
  clientes,
  serviciosEspeciales,
  margenGananciaDefaultPct,
  mockData = false,
}: AserraderoContextPanelsProps) {
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
      triggerLabel="Registrar servicio"
      title="Nuevo servicio de aserradero"
      description="Cubicaje + servicios especiales con cálculo en vivo de utilidad."
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFormKey((k) => k + 1);
      }}
    >
      <AserraderoForm
        key={formKey}
        clientes={clientes}
        serviciosEspeciales={serviciosEspeciales}
        margenGananciaDefaultPct={margenGananciaDefaultPct}
        mockData={mockData}
        onSuccess={handleSuccess}
      />
    </ContextActionPanel>
  );
}
