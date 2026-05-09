"use client";

import { createAdelanto, createEmpleado, createSueldo } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { Field, SelectField } from "@/components/ui/field";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";

type EmpleadoOpt = { id: string; nombre: string };

type PersonalContextPanelsProps = {
  empleados: EmpleadoOpt[];
};

export function PersonalContextPanels({ empleados }: PersonalContextPanelsProps) {
  return (
    <>
      <ContextActionPanel
        triggerLabel="Registrar empleado"
        title="Nuevo empleado"
        description="Alta rápida del personal activo."
      >
        <form action={createEmpleado} className="space-y-3">
          <Field name="nombre" label="Nombre completo" required />
          <Field name="rol" label="Rol" placeholder="Chofer / Operario" required />
          <Field name="fecha_ingreso" type="date" label="Fecha de ingreso" required />
          <PendingSubmitButton idleText="Guardar empleado" />
        </form>
      </ContextActionPanel>

      <ContextActionPanel
        triggerLabel="Registrar adelanto"
        title="Nuevo adelanto"
        description="Registra monto y fecha para el empleado seleccionado."
      >
        <form action={createAdelanto} className="space-y-3">
          <SelectField name="empleado_id" label="Empleado" defaultValue="" required>
            <option value="" disabled>
              Selecciona empleado
            </option>
            {empleados.map((empleado) => (
              <option key={empleado.id} value={empleado.id}>
                {empleado.nombre}
              </option>
            ))}
          </SelectField>
          <Field name="fecha" label="Fecha" type="date" required />
          <Field name="monto" label="Monto (S/)" type="number" step="0.01" min="0" required />
          <PendingSubmitButton idleText="Registrar adelanto" />
        </form>
      </ContextActionPanel>

      <ContextActionPanel
        triggerLabel="Registrar sueldo"
        title="Nuevo sueldo"
        description="Neto = bruto - descuentos, sin doble conteo en reportes."
      >
        <form action={createSueldo} className="space-y-3">
          <SelectField name="empleado_id" label="Empleado" defaultValue="" required>
            <option value="" disabled>
              Selecciona empleado
            </option>
            {empleados.map((empleado) => (
              <option key={empleado.id} value={empleado.id}>
                {empleado.nombre}
              </option>
            ))}
          </SelectField>
          <Field name="periodo" label="Periodo (YYYY-MM)" placeholder="2026-04" required />
          <Field name="monto_bruto" label="Bruto (S/)" type="number" step="0.01" min="0" required />
          <Field name="descuentos" label="Descuentos (S/)" type="number" step="0.01" min="0" defaultValue="0" />
          <PendingSubmitButton idleText="Guardar sueldo" />
        </form>
      </ContextActionPanel>
    </>
  );
}
