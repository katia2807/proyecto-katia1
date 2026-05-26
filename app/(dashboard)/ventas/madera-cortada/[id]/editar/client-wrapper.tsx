"use client";

import { useEffect, useActionState } from "react";
import { submitUpdateVentaMaderaCortadaForm } from "@/app/actions";
import { MaderaCortadaEditarForm } from "@/components/sales/madera-cortada-editar-form";
import { useToast } from "@/components/ui/toast";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { useRouter } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type Cliente = { id: string; nombre: string; documento?: string | null; ruc?: string | null };

type ClientWrapperProps = {
  venta: any;
  clientes: Cliente[];
  mockData: boolean;
};

export function EditarVentaMaderaCortadaClientWrapper({
  venta,
  clientes,
  mockData,
}: ClientWrapperProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [state, formAction] = useActionState(
    submitUpdateVentaMaderaCortadaForm,
    mutationFormInitialState,
  );

  useEffect(() => {
    if (state.success && state.message) {
      showToast({ variant: "success", message: state.message });
      router.push("/ventas/madera-cortada");
      router.refresh();
    } else if (state.error) {
      showToast({ variant: "error", message: state.error });
    }
  }, [state, showToast, router]);

  return (
    <Card className="max-w-4xl mx-auto">
      <CardTitle>Editar Venta {venta.correlativo ?? venta.id.slice(0, 8)}</CardTitle>
      <CardDescription className="mb-6">
        Modifica los datos principales de esta venta de madera cortada. Los cambios actualizarán el movimiento de caja asociado.
      </CardDescription>
      <MaderaCortadaEditarForm
        venta={venta}
        clientes={clientes}
        mockData={mockData}
        panelAction={formAction}
      />
    </Card>
  );
}
