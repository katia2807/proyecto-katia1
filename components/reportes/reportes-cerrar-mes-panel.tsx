"use client";

import { cerrarMes } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { Field } from "@/components/ui/field";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";

type ReportesCerrarMesPanelProps = {
  anio: number;
  mes: number;
  token: string;
};

export function ReportesCerrarMesPanel({ anio, mes, token }: ReportesCerrarMesPanelProps) {
  return (
    <ContextActionPanel
      triggerLabel="Cerrar mes"
      title="Cierre mensual irreversible"
      description="Doble confirmación anti-error. Luego del cierre no se puede editar ese período."
    >
      <form action={cerrarMes} className="grid gap-3 md:grid-cols-2">
        <Field name="anio" label="Año" type="number" defaultValue={String(anio)} required />
        <Field name="mes" label="Mes" type="number" min="1" max="12" defaultValue={String(mes)} required />
        <Field
          name="confirmacion"
          label={`Confirmación (escribe: ${token})`}
          placeholder={token}
          required
          className="md:col-span-2"
        />
        <div className="md:col-span-2">
          <PendingSubmitButton idleText="Cerrar mes" />
        </div>
      </form>
    </ContextActionPanel>
  );
}
