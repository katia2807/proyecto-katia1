"use client";

import { submitContratoAlquilerForm } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { ContratoAlquilerForm } from "@/components/sales/contrato-alquiler-form";
import { useToast } from "@/components/ui/toast";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { useEffect, useState, useActionState } from "react";

type Cliente = { id: string; nombre: string; ruc?: string | null };

type ContratoAlquilerPanelProps = {
  clientes: Cliente[];
  mockData?: boolean;
};

export function ContratoAlquilerPanel({ clientes, mockData = false }: ContratoAlquilerPanelProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const { showToast } = useToast();
  const [state, formAction] = useActionState(submitContratoAlquilerForm, mutationFormInitialState);

  useEffect(() => {
    if (state.success && state.message) {
      showToast({ variant: "success", message: state.message });
      setOpen(false);
      setFormKey((k) => k + 1);
    } else if (state.error) {
      showToast({ variant: "error", message: state.error });
    }
  }, [state, showToast]);

  return (
    <ContextActionPanel
      triggerLabel="Nuevo contrato"
      title="Contrato de alquiler"
      description="Calcula monto total y depósito 30% en vivo. El depósito entra como ingreso al confirmar."
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFormKey((k) => k + 1);
      }}
    >
      <ContratoAlquilerForm
        key={formKey}
        clientes={clientes}
        mockData={mockData}
        panelAction={formAction}
      />
    </ContextActionPanel>
  );
}
