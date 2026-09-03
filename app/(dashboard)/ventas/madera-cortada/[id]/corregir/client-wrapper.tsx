"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { submitCorrectVentaMaderaCortadaHistoricaForm } from "@/app/actions";
import {
  MaderaCortadaCorreccionHistoricaForm,
  type HistoricalMaderaSaleForCorrection,
} from "@/components/sales/madera-cortada-correccion-historica-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { mutationFormInitialState } from "@/lib/mutation-form-state";

type Props = {
  venta: HistoricalMaderaSaleForCorrection;
  clienteNombre: string;
  activeCashMovements: Array<{ id: string; monto: number; periodo_cerrado: boolean }>;
  inventoryMovements: Array<{ id: string; cantidad: number }>;
};

export function CorreccionHistoricaClientWrapper(props: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [state, formAction] = useActionState(
    submitCorrectVentaMaderaCortadaHistoricaForm,
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
  }, [router, showToast, state]);

  return (
    <Card className="mx-auto max-w-5xl">
      <CardTitle>Revisar y corregir boleta histórica</CardTitle>
      <CardDescription className="mb-6">
        Flujo exclusivo para Katia. Compara lo registrado, completa el detalle y confirma los efectos antes de guardar.
      </CardDescription>
      <MaderaCortadaCorreccionHistoricaForm {...props} panelAction={formAction} />
    </Card>
  );
}
