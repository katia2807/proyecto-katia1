"use client";

import { submitContratoAlquilerForm } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { ContratoAlquilerForm } from "@/components/sales/contrato-alquiler-form";
import { CierreContratoForm } from "@/components/sales/cierre-contrato-form";
import { useToast } from "@/components/ui/toast";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { useEffect, useState, useActionState } from "react";

type Cliente = { id: string; nombre: string; ruc?: string | null };
type Maquina = { id: string; nombre: string; categoria: string };
type ContratoAbierto = {
  id: string;
  codigo: string | null;
  monto_total: number | null;
  penalidad_retraso_pago_pct: number;
  penalidad_devolucion_tardia_pct: number;
  penalidad_danios_pct: number;
  [key: string]: any;
};

type AlquilerMixerContextPanelsProps = {
  clientes: Cliente[];
  maquinas: Maquina[];
  contratosAbiertos: ContratoAbierto[];
  mockData?: boolean;
};

export function AlquilerMixerContextPanels({
  clientes,
  maquinas,
  contratosAbiertos,
  mockData = false,
}: AlquilerMixerContextPanelsProps) {
  const [openNuevo, setOpenNuevo] = useState(false);
  const [formKeyNuevo, setFormKeyNuevo] = useState(0);
  const [openCierre, setOpenCierre] = useState(false);
  const [formKeyCierre, setFormKeyCierre] = useState(0);
  const { showToast } = useToast();
  const [state, formAction] = useActionState(submitContratoAlquilerForm, mutationFormInitialState);

  useEffect(() => {
    if (state.success && state.message) {
      showToast({ variant: "success", message: state.message });
      setOpenNuevo(false);
      setFormKeyNuevo((k) => k + 1);
    } else if (state.error) {
      showToast({ variant: "error", message: state.error });
    }
  }, [state, showToast]);

  return (
    <>
      {/* Botón 1: Nuevo contrato */}
      <ContextActionPanel
        triggerLabel="Nuevo contrato"
        title="Contrato de alquiler"
        description="Calcula monto total y depósito 30% en vivo. El depósito entra como ingreso al confirmar."
        open={openNuevo}
        onOpenChange={(next) => {
          setOpenNuevo(next);
          if (!next) setFormKeyNuevo((k) => k + 1);
        }}
      >
        <ContratoAlquilerForm
          key={formKeyNuevo}
          clientes={clientes}
          maquinas={maquinas}
          mockData={mockData}
          panelAction={formAction}
        />
      </ContextActionPanel>

      {/* Botón 2: Cerrar contrato */}
      <ContextActionPanel
        triggerLabel="Cerrar contrato"
        title="Cierre de contrato"
        description="Aplica penalidades por retraso, devolución tardía o daños."
        open={openCierre}
        onOpenChange={(next) => {
          setOpenCierre(next);
          if (!next) setFormKeyCierre((k) => k + 1);
        }}
      >
        <CierreContratoForm key={formKeyCierre} contratos={contratosAbiertos} />
      </ContextActionPanel>
    </>
  );
}
