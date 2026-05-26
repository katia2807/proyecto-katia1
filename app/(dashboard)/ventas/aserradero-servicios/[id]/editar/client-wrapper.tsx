"use client";

import { useEffect, useActionState } from "react";
import { submitUpdateServicioAserraderoForm } from "@/app/actions";
import { AserraderoEditarForm } from "@/components/sales/aserradero-editar-form";
import { useToast } from "@/components/ui/toast";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { useRouter } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type Cliente = { id: string; nombre: string; documento?: string | null; ruc?: string | null };

type ClientWrapperProps = {
  servicio: any;
  clientes: Cliente[];
  mockData: boolean;
};

export function EditarServicioClientWrapper({
  servicio,
  clientes,
  mockData,
}: ClientWrapperProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [state, formAction] = useActionState(submitUpdateServicioAserraderoForm, mutationFormInitialState);

  useEffect(() => {
    if (state.success && state.message) {
      showToast({ variant: "success", message: state.message });
      router.push("/ventas/aserradero-servicios");
      router.refresh();
    } else if (state.error) {
      showToast({ variant: "error", message: state.error });
    }
  }, [state, showToast, router]);

  return (
    <Card className="max-w-4xl mx-auto">
      <CardTitle>Editar Servicio {servicio.correlativo ?? servicio.id.slice(0, 8)}</CardTitle>
      <CardDescription className="mb-6">
        Modifica los datos principales de este servicio de aserradero. Los cambios se guardarán en la base de datos de forma transaccional.
      </CardDescription>
      <AserraderoEditarForm
        clientes={clientes}
        mockData={mockData}
        panelAction={formAction}
        servicio={servicio}
      />
    </Card>
  );
}
