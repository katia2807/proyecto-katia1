"use client";

import { useEffect, useActionState } from "react";
import { submitUpdateContratoAlquilerForm } from "@/app/actions";
import { ContratoAlquilerForm } from "@/components/sales/contrato-alquiler-form";
import { useToast } from "@/components/ui/toast";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { useRouter } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type Cliente = { id: string; nombre: string; ruc?: string | null };
type Maquina = { id: string; nombre: string; category?: string };

type ClientWrapperProps = {
  contrato: any;
  clientes: Cliente[];
  maquinas: any[];
  mockData: boolean;
};

export function EditarContratoClientWrapper({
  contrato,
  clientes,
  maquinas,
  mockData,
}: ClientWrapperProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [state, formAction] = useActionState(submitUpdateContratoAlquilerForm, mutationFormInitialState);

  useEffect(() => {
    if (state.success && state.message) {
      showToast({ variant: "success", message: state.message });
      router.push("/ventas/alquiler-mixer");
      router.refresh();
    } else if (state.error) {
      showToast({ variant: "error", message: state.error });
    }
  }, [state, showToast, router]);

  return (
    <Card className="max-w-4xl mx-auto">
      <CardTitle>Editar Contrato {contrato.codigo ?? contrato.id.slice(0, 8)}</CardTitle>
      <CardDescription className="mb-6">
        Modifica los datos del contrato de alquiler. Los cambios afectarán la facturación y penalidades correspondientes.
      </CardDescription>
      <ContratoAlquilerForm
        clientes={clientes}
        maquinas={maquinas}
        mockData={mockData}
        panelAction={formAction}
        contrato={contrato}
      />
    </Card>
  );
}
